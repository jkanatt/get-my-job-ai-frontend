export class AlgorithmicEngine {
  /**
   * Evaluates tracking events using algorithmic patterns and statistical heuristics.
   * @param {Object} event - The current tracking event
   * @param {Array} history - Array of previous events for this application
   * @returns {Object} - { confidence: number, features: Object }
   */
  static evaluate(event, history = []) {
    let confidence = 0.5; // Base algorithmic probability
    const features = {};

    const eventTime = new Date(event.created_at || new Date()).getTime();
    
    // 1. Time-of-Day Analysis (Heuristic: HR/Recruiters work during business hours)
    // Assuming timezone from metadata if available, else UTC fallback
    const hour = new Date(event.created_at).getUTCHours(); 
    // Typical US business hours in UTC roughly 13:00 - 23:00
    if (hour >= 13 && hour <= 23) {
      confidence += 0.1;
      features.business_hours = true;
    } else {
      confidence -= 0.1;
      features.business_hours = false;
    }

    // 2. Behavioral Graphing: Time between opens
    const pastOpens = history
      .filter(e => ['OPENED', 'VIEWED'].includes(e.event_type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (pastOpens.length > 0) {
      const lastOpenTime = new Date(pastOpens[0].created_at).getTime();
      const secondsSinceLastOpen = (eventTime - lastOpenTime) / 1000;

      // Humans rarely open the exact same email within seconds of themselves unless 
      // they clicked a link and triggered another open pixel.
      if (secondsSinceLastOpen < 10) {
        confidence -= 0.3;
        features.rapid_reopen = true;
      } else if (secondsSinceLastOpen > 3600) {
        // Opening again after an hour is a strong human signal (returning to email)
        confidence += 0.2;
        features.delayed_revisit = true;
      }
    }

    // 3. Multi-Device Usage (Strong Human Signal)
    if (event.metadata?.device) {
      const devicesUsed = new Set(history.map(e => e.metadata?.device).filter(Boolean));
      if (devicesUsed.size > 0 && !devicesUsed.has(event.metadata.device)) {
        // E.g., Opened on Desktop, now opening on Mobile
        confidence += 0.3;
        features.cross_device = true;
      }
    }

    // 4. Interaction Depth (Clicks follow opens)
    if (event.event_type === 'LINK_CLICKED') {
      const openPriorToClick = history.find(e => 
        ['OPENED', 'VIEWED'].includes(e.event_type) && 
        new Date(e.created_at).getTime() < eventTime
      );
      if (openPriorToClick) {
        const secondsBetween = (eventTime - new Date(openPriorToClick.created_at).getTime()) / 1000;
        if (secondsBetween > 2 && secondsBetween < 600) {
          // Human-like time to read before clicking
          confidence += 0.4;
          features.human_read_time = true;
        } else if (secondsBetween <= 2) {
          // Clicked instantly after open -> likely a URL scanner bot
          confidence -= 0.5;
          features.instant_click_bot = true;
        }
      } else {
        // Click without an open event -> might be plain text email client, or a bot extracting URLs
        confidence -= 0.2;
        features.click_without_open = true;
      }
    }

    // 5. Variance Mathematics (Detecting perfect robotic timing)
    if (pastOpens.length >= 3) {
      const intervals = [];
      for (let i = 0; i < pastOpens.length - 1; i++) {
        const time1 = new Date(pastOpens[i].created_at).getTime();
        const time2 = new Date(pastOpens[i+1].created_at).getTime();
        intervals.push((time1 - time2) / 1000);
      }
      
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // If intervals between opens are almost perfectly uniform (e.g. exactly 60s, or 300s)
      if (stdDev < 1.0 && mean > 5) {
        confidence -= 0.6;
        features.robotic_timing_variance = true;
      }
    }

    // Normalization (Sigmoid-like bounding or simple clamping)
    confidence = Math.max(0.01, Math.min(0.99, confidence)); // Never 100% or 0% from algorithms

    return { confidence, features };
  }
}
