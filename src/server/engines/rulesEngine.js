export class RulesEngine {
  /**
   * Evaluates tracking events using deterministic rules.
   * @param {Object} event - The current tracking event (metadata, timestamp, etc.)
   * @param {Array} history - Array of previous events for this application
   * @returns {Object} - { confidence: number, flags: string[], suggestedAction: string }
   */
  static evaluate(event, history = []) {
    let confidence = 1.0;
    const flags = [];
    let suggestedAction = 'PROCEED';

    const metadata = event.metadata || {};
    const eventTime = new Date(event.created_at || new Date()).getTime();
    
    // 1. Hard Bot Signatures
    if (metadata.isBot || metadata.is_apple_privacy_relay) {
      confidence = 0.1;
      flags.push('HARD_BOT_OR_RELAY');
      suggestedAction = 'SUPPRESS_SILENTLY';
    }

    // 2. Immediate Open Check
    const sentEvent = history.find(e => e.event_type === 'SENT');
    if (sentEvent) {
      const sentTime = new Date(sentEvent.created_at).getTime();
      const secondsSinceSend = (eventTime - sentTime) / 1000;
      if (secondsSinceSend < 5) {
        confidence = 0.0;
        flags.push('IMMEDIATE_OPEN_SCANNER');
        suggestedAction = 'SUPPRESS_SILENTLY';
      }
    }

    // 3. Impossible Travel Check (Basic)
    const lastOpen = history
      .filter(e => ['OPENED', 'VIEWED', 'MULTIPLE_OPENS'].includes(e.event_type) && e.metadata?.city)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
    if (lastOpen && metadata.city && lastOpen.metadata?.city !== metadata.city) {
      const lastOpenTime = new Date(lastOpen.created_at).getTime();
      const hoursDifference = (eventTime - lastOpenTime) / (1000 * 60 * 60);
      
      // If city changed in less than 2 hours, flag as suspicious
      if (hoursDifference < 2) {
        confidence *= 0.5;
        flags.push('IMPOSSIBLE_TRAVEL');
      }
    }

    // 4. Data Center / VPN IP Checks (Heuristics based on ISP)
    const suspiciousISPs = ['amazon', 'google cloud', 'azure', 'digitalocean', 'ovh', 'choopa', 'm247'];
    if (metadata.isp && suspiciousISPs.some(isp => metadata.isp.toLowerCase().includes(isp))) {
      confidence *= 0.2;
      flags.push('DATACENTER_IP');
      suggestedAction = 'SUPPRESS_SILENTLY';
    }

    // 5. IP Velocity (Many opens from same IP in short time)
    if (metadata.ip) {
      const recentOpensFromIP = history.filter(e => 
        e.metadata?.ip === metadata.ip && 
        (eventTime - new Date(e.created_at).getTime()) < 10 * 60 * 1000
      );
      if (recentOpensFromIP.length > 5) {
        confidence = 0.0;
        flags.push('HIGH_IP_VELOCITY');
        suggestedAction = 'SUPPRESS_SILENTLY';
      }
    }

    // Normalization
    confidence = Math.max(0, Math.min(1, confidence));

    return { confidence, flags, suggestedAction };
  }

  /**
   * State Machine for valid Application Status Transitions
   */
  static getNextValidStatus(currentStatus, eventType, confidence) {
    if (confidence < 0.5) return currentStatus; // Don't advance state on low confidence events
    
    const validTransitions = {
      'Draft': { 'SENT': 'Sent' },
      'Sending': { 'SENT': 'Sent', 'DELIVERED': 'Sent' },
      'Sent': { 'OPENED': 'Viewed', 'LINK_CLICKED': 'Viewed', 'REPLY_RECEIVED': 'Responded', 'INTERVIEW_INVITE': 'Interviewing' },
      'Delivered': { 'OPENED': 'Viewed', 'LINK_CLICKED': 'Viewed', 'REPLY_RECEIVED': 'Responded', 'INTERVIEW_INVITE': 'Interviewing' },
      'Viewed': { 'REPLY_RECEIVED': 'Responded', 'INTERVIEW_INVITE': 'Interviewing' },
      'Applied': { 'OPENED': 'Viewed', 'LINK_CLICKED': 'Viewed', 'REPLY_RECEIVED': 'Responded', 'INTERVIEW_INVITE': 'Interviewing' },
      'Responded': { 'INTERVIEW_INVITE': 'Interviewing' },
      // Terminal or semi-terminal states typically shouldn't automatically regress 
      // based on just another open/click.
      'Interviewing': {}, 
      'Offer': {},
      'Rejected': {},
      'Passed': {},
      'Ghosted': {}
    };

    const transitions = validTransitions[currentStatus] || {};
    return transitions[eventType] || currentStatus;
  }
}
