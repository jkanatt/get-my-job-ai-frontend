import { RulesEngine } from '../engines/rulesEngine';
import { AlgorithmicEngine } from '../engines/algorithmicEngine';
import { AIEngine } from '../engines/aiEngine';
import { getTrackingDb } from '@/infrastructure/database/tracking-db';

export class TrackingArbiter {
  /**
   * Processes an incoming event through all three engines and determines the final action.
   * @param {Object} event - The new event to process
   * @param {Object} application - The application document
   * @param {Array} history - Previous events
   */
  static async processEvent(event, application, history) {
    console.log(`[Arbiter] Processing ${event.event_type} for app ${application.id}`);
    
    const db = await getTrackingDb();
    
    // 1. Synchronous Engines
    const rulesResult = RulesEngine.evaluate(event, history);
    const algoResult = AlgorithmicEngine.evaluate(event, history);
    
    // 2. Asynchronous AI Engine (Only runs for specific types to save cost)
    let aiResult = { confidence: 0.5, intent: 'NOT_APPLICABLE', extractedEntities: {} };
    if (event.event_type === 'REPLY_RECEIVED' || event.metadata?.messagePreview) {
      aiResult = await AIEngine.evaluate(event, history);
    }
    
    // 3. Consensus & Merging (Dynamic Weighting)
    let rulesWeight = 0.5;
    let algoWeight = 0.3;
    let aiWeight = 0.2;

    // Dynamic weight adjustment based on event entropy / type
    if (event.event_type === 'REPLY_RECEIVED' || event.event_type === 'LINK_CLICKED') {
       rulesWeight = 0.2;
       algoWeight = 0.2;
       aiWeight = 0.6; // Heavy AI/Algo focus for deliberate actions
    } else if (event.event_type === 'OPENED') {
       rulesWeight = 0.6;
       algoWeight = 0.4;
       aiWeight = 0.0; // AI not useful for pixel opens
    }

    let finalConfidence = (rulesResult.confidence * rulesWeight) + (algoResult.confidence * algoWeight) + (aiResult.confidence * aiWeight);
    
    // If rules found a HARD bot, override to 0
    if (rulesResult.flags.includes('HARD_BOT_OR_RELAY') || rulesResult.suggestedAction === 'SUPPRESS_SILENTLY') {
      finalConfidence = 0.0;
    }
    
    // If AI found an explicit intent, map it to a potential status or event promotion
    let finalEventType = event.event_type;
    let finalIntent = aiResult.intent !== 'NOT_APPLICABLE' && aiResult.intent !== 'UNKNOWN' ? aiResult.intent : null;
    
    if (finalIntent === 'INTERVIEW_INVITE') {
      finalEventType = 'INTERVIEW_INVITE';
      finalConfidence = Math.max(finalConfidence, 0.9); // High human probability
    } else if (finalIntent === 'REJECTION') {
      finalEventType = 'REJECTED';
      finalConfidence = Math.max(finalConfidence, 0.9);
    }

    // --- Self-Healing Mechanism (Backfill missing OPENED) ---
    // If the event is a deliberate action (CLICK or REPLY) but there is no prior OPENED in history,
    // we backfill an OPENED event since it's causally required.
    const hasPriorOpen = history.some(h => ['OPENED', 'VIEWED', 'MULTIPLE_OPENS'].includes(h.event_type));
    if (!hasPriorOpen && ['LINK_CLICKED', 'REPLY_RECEIVED'].includes(event.event_type)) {
      console.log(`[Arbiter] Self-healing: Backfilling inferred OPENED event for app ${application.id}`);
      await db.collection('tracking_events').add({
        application_id: application.id,
        email_id: event.email_id,
        event_type: 'OPENED',
        source: 'arbiter_inferred',
        user_id: event.user_id || 'system',
        metadata: {
           is_inferred: true,
           inferred_reason: `Precedes ${event.event_type}`
        },
        ai_confidence_score: 1.0, // Definitively human action caused this
        created_at: new Date(new Date(event.created_at).getTime() - 1000).toISOString(), // 1 second prior
        updated_at: new Date().toISOString()
      });
      
      // Update history so state transitions downstream can see it
      history.push({ event_type: 'OPENED', metadata: { is_inferred: true } });
    }
    // --------------------------------------------------------

    // 4. Update Event Document (Merge insights)
    const enrichedEvent = {
      ...event,
      event_type: finalEventType,
      ai_confidence_score: finalConfidence,
      engine_metadata: {
        rules: rulesResult,
        algorithmic: algoResult,
        ai: aiResult
      }
    };
    
    // Persist enriched event (this assumes event hasn't been saved yet, or we're creating it now)
    // If we're called from an async worker *after* initial insert, we should update the existing document.
    // In our fire-and-forget setup from API route, we are creating it here.
    const trackingRef = db.collection('tracking_events');
    const newEventRef = await trackingRef.add(enrichedEvent);
    
    // 5. State Machine Update for Application
    if (finalConfidence >= 0.3) {
      const currentStatus = application.status || 'Applied';
      const nextStatus = RulesEngine.getNextValidStatus(currentStatus, finalEventType, finalConfidence);
      
      const appUpdates = {
        updated_at: new Date().toISOString()
      };
      
      if (nextStatus !== currentStatus) {
        appUpdates.status = nextStatus;
      }
      
      if (aiResult.extractedEntities?.recruiter_name) {
        // Safe append notes or specific fields if they exist
        appUpdates.notes = (application.notes || '') + `\n--- AI Interview Metadata ---\n${JSON.stringify(aiResult.extractedEntities)}`;
      }

      // Calculate aggregated confidence for the app based on all its events
      appUpdates.confidence_score = Math.min(1.0, (application.confidence_score || 0.5) + (finalConfidence * 0.1));
      
      if (finalIntent) {
         appUpdates.ai_intent = finalIntent;
      }
      
      await db.collection('applications').doc(application.id).update(appUpdates);
      console.log(`[Arbiter] App ${application.id} transitioned ${currentStatus} -> ${nextStatus}`);
    } else {
      console.log(`[Arbiter] Event suppressed due to low confidence (${finalConfidence})`);
      // Event is still saved to tracking_events for auditing, but the application status is not updated.
    }
    
    return enrichedEvent;
  }
}
