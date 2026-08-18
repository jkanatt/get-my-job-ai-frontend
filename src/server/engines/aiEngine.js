import { callLLM } from '@/infrastructure/services/llmRouter';
import { parseLlmJson } from '@/shared/utils/llmJsonParser';

export class AIEngine {
  /**
   * Analyzes the intent of a reply email or a complex event sequence.
   * @param {Object} event - The tracking event (usually a REPLY_RECEIVED)
   * @param {Array} history - Full history of events
   * @returns {Promise<Object>} - { confidence: number, intent: string, extractedEntities: Object }
   */
  static async evaluate(event, history = []) {
    // We only invoke the AI engine for meaningful textual events to save cost/latency
    if (event.event_type !== 'REPLY_RECEIVED' && !event.metadata?.messagePreview) {
       return { confidence: 0.5, intent: 'NOT_APPLICABLE', extractedEntities: {} };
    }

    const textToAnalyze = event.metadata?.preview || event.metadata?.messagePreview || '';
    if (!textToAnalyze || textToAnalyze.length < 10) {
      return { confidence: 0.5, intent: 'UNKNOWN', extractedEntities: {} };
    }

    // Create a simplified history timeline for the AI
    const timeline = history.map(h => ({
      event: h.event_type,
      time: new Date(h.created_at).toISOString(),
      metadata: h.metadata ? { 
        device: h.metadata.device, 
        location: h.metadata.city, 
        url: h.metadata.url 
      } : {}
    }));

    const prompt = `
      You are an expert HR and recruitment intent analyzer.
      Analyze the following email reply snippet from an employer regarding a job application, 
      along with the historical interaction timeline.
      
      Historical Timeline:
      ${JSON.stringify(timeline, null, 2)}

      Email Snippet: "${textToAnalyze}"
      
      Determine the primary intent of this email, taking into account the user's past engagement 
      (e.g., did they open the email multiple times before replying?). 
      Respond ONLY with a valid JSON object matching this schema:
      {
        "intent": "INTERVIEW_INVITE" | "REJECTION" | "CLARIFICATION_REQUEST" | "OFFER" | "AUTO_REPLY" | "UNKNOWN",
        "human_probability": 0.0 to 1.0 (float, where 1.0 means written by a human, 0.0 means automated system),
        "extractedEntities": {
          "recruiter_name": "string or null",
          "interview_date": "string or null (ISO format if found)"
        }
      }
    `;

    try {
      const completion = await callLLM('email_analysis', {
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 500,
      });
      
      const result = parseLlmJson(completion.choices[0]?.message?.content || '{}');
      
      // Map AI intent to our standard system events if needed, but here we just return the raw insight
      return {
        confidence: result.human_probability ?? 0.5,
        intent: result.intent ?? 'UNKNOWN',
        extractedEntities: result.extractedEntities ?? {}
      };
    } catch (error) {
      console.error("AIEngine Error:", error);
      return { confidence: 0.5, intent: 'ERROR', extractedEntities: {} };
    }
  }
}
