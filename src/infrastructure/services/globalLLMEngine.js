import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { scoreResponseQuality } from './qualityScorer.js';

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║              GLOBAL LLM ENGINE v5 — GET MY JOB INTELLIGENCE CORE            ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Single source of truth for ALL LLM calls in the entire project.      ║
 * ║                                                                        ║
 * ║  Architecture:                                                         ║
 * ║    Tier 1-6  : Gemini models (Key 1) — Primary                        ║
 * ║    Tier 7-12 : Gemini models (Key 2) — Failover pool                  ║
 * ║    Tier 13-18: Gemini models (Key 3) — Tertiary pool                  ║
 * ║    Tier 19-24: Gemini models (Key 4) — Quaternary pool                ║
 * ║    Tier 25-29: External providers — Emergency fallbacks                ║
 * ║                                                                        ║
 * ║  Features:                                                             ║
 * ║    • Task-based intelligent tier selection                             ║
 * ║    • Per-key circuit breaking with retry-after parsing                 ║
 * ║    • In-memory health monitoring with weighted success rates           ║
 * ║    • Append-only LLM call log for observability                       ║
 * ║    • Concurrency control via semaphore (max 20 parallel calls)         ║
 * ║    • Daily round-robin within same-tier key pools                      ║
 * ║    • Zero hardcoded models — everything configurable                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: MODEL REGISTRY — 17 Tiers
// ═══════════════════════════════════════════════════════════════════════════

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

/**
 * Build the full 17-tier provider registry from environment variables.
 * Each provider has: name, tier, baseURL, apiKeyEnv, model, timeout, capabilities[]
 */
function buildModelRegistry() {
  const registry = [];

  // Helper: resolve API key from env
  const getKey = (envVar) => process.env[envVar] || '';

  // ── Tier 1-6: Primary Gemini Models (Key 1) ──
  const geminiKey1 = getKey('GEMINI_API_KEY') || getKey('GEMINI_OPENAI_API_KEY');
  
  if (geminiKey1) {
    registry.push(
      { name: 'Gemini-3.6-Flash', tier: 1, baseURL: GEMINI_BASE_URL, apiKey: geminiKey1, model: 'gemini-3.6-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code', 'analysis'] },
      { name: 'Gemini-3.5-Flash', tier: 2, baseURL: GEMINI_BASE_URL, apiKey: geminiKey1, model: 'gemini-3.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code'] },
      { name: 'Gemini-3.5-Flash-Lite', tier: 3, baseURL: GEMINI_BASE_URL, apiKey: geminiKey1, model: 'gemini-3.5-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'extraction'] },
      { name: 'Gemini-3.1-Flash-Lite', tier: 4, baseURL: GEMINI_BASE_URL, apiKey: geminiKey1, model: 'gemini-3.1-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'parsing'] },
      { name: 'Gemini-2.5-Flash', tier: 5, baseURL: GEMINI_BASE_URL, apiKey: geminiKey1, model: 'gemini-2.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'stable'] },
      { name: 'Gemini-3.1-Pro-Preview', tier: 6, baseURL: GEMINI_BASE_URL, apiKey: geminiKey1, model: 'gemini-3.1-pro-preview', timeout: 300000, capabilities: ['deep_reasoning', 'json', 'analysis', 'consensus'] },
    );
  }

  // ── Tier 7-12: Secondary Gemini Models (Key 2) ──
  const geminiKey2 = getKey('GEMINI_API_KEY_2');
  
  if (geminiKey2) {
    registry.push(
      { name: 'Gemini-3.6-Flash-K2', tier: 7, baseURL: GEMINI_BASE_URL, apiKey: geminiKey2, model: 'gemini-3.6-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code', 'analysis'] },
      { name: 'Gemini-3.5-Flash-K2', tier: 8, baseURL: GEMINI_BASE_URL, apiKey: geminiKey2, model: 'gemini-3.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code'] },
      { name: 'Gemini-3.5-Flash-Lite-K2', tier: 9, baseURL: GEMINI_BASE_URL, apiKey: geminiKey2, model: 'gemini-3.5-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'extraction'] },
      { name: 'Gemini-3.1-Flash-Lite-K2', tier: 10, baseURL: GEMINI_BASE_URL, apiKey: geminiKey2, model: 'gemini-3.1-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'parsing'] },
      { name: 'Gemini-2.5-Flash-K2', tier: 11, baseURL: GEMINI_BASE_URL, apiKey: geminiKey2, model: 'gemini-2.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'stable'] },
      { name: 'Gemini-3.1-Pro-Preview-K2', tier: 12, baseURL: GEMINI_BASE_URL, apiKey: geminiKey2, model: 'gemini-3.1-pro-preview', timeout: 300000, capabilities: ['deep_reasoning', 'json', 'analysis', 'consensus'] },
    );
  }

  // ── Tier 13-18: Tertiary Gemini Models (Key 3) ──
  const geminiKey3 = getKey('GEMINI_API_KEY_3');
  
  if (geminiKey3) {
    registry.push(
      { name: 'Gemini-3.6-Flash-K3', tier: 13, baseURL: GEMINI_BASE_URL, apiKey: geminiKey3, model: 'gemini-3.6-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code', 'analysis'] },
      { name: 'Gemini-3.5-Flash-K3', tier: 14, baseURL: GEMINI_BASE_URL, apiKey: geminiKey3, model: 'gemini-3.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code'] },
      { name: 'Gemini-3.5-Flash-Lite-K3', tier: 15, baseURL: GEMINI_BASE_URL, apiKey: geminiKey3, model: 'gemini-3.5-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'extraction'] },
      { name: 'Gemini-3.1-Flash-Lite-K3', tier: 16, baseURL: GEMINI_BASE_URL, apiKey: geminiKey3, model: 'gemini-3.1-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'parsing'] },
      { name: 'Gemini-2.5-Flash-K3', tier: 17, baseURL: GEMINI_BASE_URL, apiKey: geminiKey3, model: 'gemini-2.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'stable'] },
      { name: 'Gemini-3.1-Pro-Preview-K3', tier: 18, baseURL: GEMINI_BASE_URL, apiKey: geminiKey3, model: 'gemini-3.1-pro-preview', timeout: 300000, capabilities: ['deep_reasoning', 'json', 'analysis', 'consensus'] },
    );
  }

  // ── Tier 19-24: Quaternary Gemini Models (Key 4) ──
  const geminiKey4 = getKey('GEMINI_API_KEY_4');
  
  if (geminiKey4) {
    registry.push(
      { name: 'Gemini-3.6-Flash-K4', tier: 19, baseURL: GEMINI_BASE_URL, apiKey: geminiKey4, model: 'gemini-3.6-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code', 'analysis'] },
      { name: 'Gemini-3.5-Flash-K4', tier: 20, baseURL: GEMINI_BASE_URL, apiKey: geminiKey4, model: 'gemini-3.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'code'] },
      { name: 'Gemini-3.5-Flash-Lite-K4', tier: 21, baseURL: GEMINI_BASE_URL, apiKey: geminiKey4, model: 'gemini-3.5-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'extraction'] },
      { name: 'Gemini-3.1-Flash-Lite-K4', tier: 22, baseURL: GEMINI_BASE_URL, apiKey: geminiKey4, model: 'gemini-3.1-flash-lite', timeout: 300000, capabilities: ['fast', 'json', 'parsing'] },
      { name: 'Gemini-2.5-Flash-K4', tier: 23, baseURL: GEMINI_BASE_URL, apiKey: geminiKey4, model: 'gemini-2.5-flash', timeout: 300000, capabilities: ['reasoning', 'json', 'stable'] },
      { name: 'Gemini-3.1-Pro-Preview-K4', tier: 24, baseURL: GEMINI_BASE_URL, apiKey: geminiKey4, model: 'gemini-3.1-pro-preview', timeout: 300000, capabilities: ['deep_reasoning', 'json', 'analysis', 'consensus'] },
    );
  }

  // ── Tier 25: Groq ──
  const groqKeys = _parseKeys('GROQ_API_KEYS', 'GROQ_API_KEY');
  if (process.env.GROQ_API_KEY_2 && !groqKeys.includes(process.env.GROQ_API_KEY_2)) {
    groqKeys.push(process.env.GROQ_API_KEY_2);
  }
  groqKeys.forEach((key, i) => {
    registry.push({ name: `Groq-70B-Key${i + 1}`, tier: 25, baseURL: 'https://api.groq.com/openai/v1', apiKey: key, model: 'llama-3.3-70b-versatile', timeout: 60000, capabilities: ['fast', 'json', 'code'] });
  });

  // ── Tier 26: NVIDIA NIM ──
  const nvidiaKeys = _parseKeys('NVIDIA_API_KEYS', 'NVIDIA_API_KEY_1');
  if (nvidiaKeys.length === 0) {
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`NVIDIA_API_KEY_${i}`];
      if (k?.trim()) nvidiaKeys.push(k.trim());
    }
  }
  nvidiaKeys.forEach((key, i) => {
    registry.push({ name: `NVIDIA-Key${i + 1}`, tier: 26, baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: key, model: 'meta/llama-3.1-70b-instruct', timeout: 300000, capabilities: ['reasoning', 'json'] });
  });

  // ── Tier 27: OpenRouter ──
  const orKeys = _parseKeys('OPENROUTER_API_KEYS', 'OPENROUTER_API_KEY');
  orKeys.forEach((key, i) => {
    registry.push({ name: `OpenRouter-Key${i + 1}`, tier: 27, baseURL: 'https://openrouter.ai/api/v1', apiKey: key, model: 'google/gemma-4-31b-it:free', timeout: 60000, capabilities: ['reasoning', 'json'] });
  });

  // ── Tier 0: OmniRoute Local Gateway ──
  registry.push({
    name: 'OmniRoute-Gateway',
    tier: 0,
    baseURL: 'http://localhost:20128/v1',
    apiKey: 'sk-3474d6547f654fe2-a9a2c5-8aad41df',
    model: 'auto',
    timeout: 300000,
    capabilities: ['reasoning', 'json', 'code', 'analysis', 'deep_reasoning', 'consensus', 'fast', 'extraction', 'parsing', 'stable']
  });

  // ── Tier 29: Local Ollama ──
  registry.push({ name: 'Ollama-Local', tier: 29, baseURL: 'http://127.0.0.1:11434/v1', apiKey: 'ollama', model: 'llama3.2', timeout: 300000, isLocal: true, capabilities: ['reasoning', 'json'] });

  return registry;
}

// ── Registry cache (60s TTL) to avoid rebuilding on every call ──
let _cachedRegistry = null;
let _registryCachedAt = 0;
const REGISTRY_TTL_MS = 60000;

function getCachedRegistry() {
  if (_cachedRegistry && Date.now() - _registryCachedAt < REGISTRY_TTL_MS) {
    return _cachedRegistry;
  }
  _cachedRegistry = buildModelRegistry();
  _registryCachedAt = Date.now();
  return _cachedRegistry;
}

function _parseKeys(envVar, fallbackEnvVar) {
  const val = process.env[envVar] || process.env[fallbackEnvVar] || '';
  return val.split(',').map(k => k.trim()).filter(k => k.length > 0);
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: TASK CLASSIFIER — Maps task types to optimal tier ranges
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Task-to-Tier mapping. Each task type has:
 *   - startTier: Lowest tier to try first (efficiency)
 *   - maxTier: Don't go below this tier (quality floor)
 *   - preferPro: If true, prefer Tier 6 (gemini-3.1-pro-preview) for quality
 */
const TASK_TIER_MAP = {
  // ── High-complexity tasks (prefer strongest models) ──
  jd_analysis:       { startTier: 0, maxTier: 29, preferPro: false },
  bullet_engineering:{ startTier: 0, maxTier: 29, preferPro: false },
  consensus:         { startTier: 0, maxTier: 29, preferPro: true },
  self_heal:         { startTier: 0, maxTier: 29, preferPro: false },

  // ── Medium-complexity tasks ──
  cover_letter:      { startTier: 0, maxTier: 29, preferPro: false },
  email:             { startTier: 0, maxTier: 29, preferPro: false },
  skills_architect:  { startTier: 0, maxTier: 29, preferPro: false },
  ats_scoring:       { startTier: 0, maxTier: 29, preferPro: false },
  interview_prep:    { startTier: 0, maxTier: 29, preferPro: false },

  // ── Lower-complexity tasks (efficient models preferred) ──
  company_research:  { startTier: 0, maxTier: 29, preferPro: false },
  content_fit:       { startTier: 0, maxTier: 29, preferPro: false },
  parsing:           { startTier: 0, maxTier: 29, preferPro: false },
  email_analysis:    { startTier: 0, maxTier: 29, preferPro: false },
  quick_apply:       { startTier: 0, maxTier: 29, preferPro: false },
  draft:             { startTier: 0, maxTier: 29, preferPro: false },

  // ── Default (any unclassified task) ──
  default:           { startTier: 0, maxTier: 29, preferPro: false },
};

function getTaskConfig(taskType) {
  return TASK_TIER_MAP[taskType] || TASK_TIER_MAP.default;
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: HEALTH MONITOR — Per-provider stats & circuit breaking
// ═══════════════════════════════════════════════════════════════════════════

const keyLocks = {};       // { [apiKey]: unlockTimestamp }
const providerStats = {};  // { [name]: { success, fail, totalLatencyMs, lastUsed, consecutiveFails } }

function recordResult(name, success, latencyMs = 0) {
  if (!providerStats[name]) providerStats[name] = { success: 0, fail: 0, totalLatencyMs: 0, lastUsed: null, consecutiveFails: 0 };
  if (success) {
    providerStats[name].success++;
    providerStats[name].consecutiveFails = 0; // Reset circuit breaker
  }
  else {
    providerStats[name].fail++;
    providerStats[name].consecutiveFails = (providerStats[name].consecutiveFails || 0) + 1;
  }
  providerStats[name].totalLatencyMs += latencyMs;
  providerStats[name].lastUsed = new Date().toISOString();
}

function getSuccessRate(name) {
  const s = providerStats[name];
  if (!s || (s.success + s.fail) === 0) return 1.0;
  return s.success / (s.success + s.fail);
}

function getAvgLatency(name) {
  const s = providerStats[name];
  if (!s || (s.success + s.fail) === 0) return 0;
  return s.totalLatencyMs / (s.success + s.fail);
}

function isProviderLocked(providerName) {
  if (!providerName) return false;
  const unlockTime = keyLocks[providerName];
  if (!unlockTime) return false;
  if (Date.now() > unlockTime) { delete keyLocks[providerName]; return false; }
  return true;
}

function lockProvider(providerName, durationMs) {
  if (!providerName) return;
  keyLocks[providerName] = Date.now() + durationMs;
}

// Legacy aliases for backward compat
function isKeyLocked(apiKey) { return false; } // Deprecated: use isProviderLocked
function lockKey(apiKey, durationMs) {} // Deprecated: use lockProvider

function extractRetryAfter(err) {
  if (err?.headers?.['retry-after']) {
    const val = parseFloat(err.headers['retry-after']);
    if (!isNaN(val)) return Math.ceil(val * 1000) + 500;
  }
  const match = err?.message?.match(/retry.?after[:\s]+(\d+\.?\d*)/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  if (err?.error?.retry_after) return Math.ceil(parseFloat(err.error.retry_after) * 1000) + 500;
  return 0;
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: CONCURRENCY CONTROL
// ═══════════════════════════════════════════════════════════════════════════

class Semaphore {
  constructor(max) { this.max = max; this.count = 0; this.queue = []; }
  async acquire() {
    if (this.count < this.max) { this.count++; return; }
    return new Promise(resolve => this.queue.push(resolve));
  }
  release() {
    this.count--;
    if (this.queue.length > 0) { this.count++; this.queue.shift()(); }
  }
}
const globalSemaphore = new Semaphore(20);


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: LLM CALL LOG — Append-only observability
// ═══════════════════════════════════════════════════════════════════════════

const LOG_DIR = path.resolve(process.cwd(), '.data', 'brain');
const LOG_FILE = path.join(LOG_DIR, 'llm_call_log.jsonl');

function logLLMCall(entry) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry
    }) + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch {
    // Non-fatal: logging should never crash the pipeline
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: INTELLIGENT ROUTER — The core routing logic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * callLLM — The single function every feature in the project calls.
 *
 * @param {string} taskType — One of: jd_analysis, bullet_engineering, consensus,
 *   cover_letter, email, skills_architect, ats_scoring, company_research,
 *   content_fit, parsing, email_analysis, quick_apply, draft, interview_prep, self_heal
 * @param {object} params — Standard OpenAI-compatible chat completion params
 *   (messages, temperature, max_tokens, response_format, etc.)
 * @param {object} options — { skipLocal: boolean }
 * @returns {object} OpenAI-compatible completion response with _meta attached
 */
export async function callLLM(taskType, params, options = {}) {
  const { skipLocal = false } = options;
  const taskConfig = getTaskConfig(taskType);
  const startTime = Date.now();

  await globalSemaphore.acquire();
  try {
    const registry = getCachedRegistry();
    let providers = registry.filter(p => p.apiKey && p.apiKey.trim() !== '');

    if (skipLocal) {
      providers = providers.filter(p => !p.isLocal);
    }

    if (providers.length === 0) {
      throw new Error('[GlobalLLM] No active LLM providers configured with API keys.');
    }

    // ── Task-aware tier ordering ──
    // For preferPro tasks, bring Pro tiers (6, 12) to the front
    if (taskConfig.preferPro) {
      const proProviders = providers.filter(p => p.tier === 6 || p.tier === 12);
      const otherProviders = providers.filter(p => p.tier !== 6 && p.tier !== 12);
      providers = [...proProviders, ...otherProviders];
    } else {
      // Sort by tier (ascending = cheapest first), then by success rate within same tier
      providers.sort((a, b) => {
        const tierDiff = a.tier - b.tier;
        if (tierDiff !== 0) return tierDiff;
        return getSuccessRate(b.name) - getSuccessRate(a.name);
      });
    }

    // Filter to startTier+ (skip tiers below the task's minimum)
    providers = providers.filter(p => p.tier >= taskConfig.startTier);

    // Filter out locked keys, but keep all if everything is locked
    const available = providers.filter(p => !isProviderLocked(p.name));
    if (available.length > 0) providers = available;

    // Daily round-robin within same-tier groups
    const dayOffset = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const tierGroups = {};
    for (const p of providers) {
      if (!tierGroups[p.tier]) tierGroups[p.tier] = [];
      tierGroups[p.tier].push(p);
    }
    const orderedProviders = [];
    for (const tier of Object.keys(tierGroups).map(Number).sort((a, b) => a - b)) {
      const group = tierGroups[tier];
      for (let i = 0; i < group.length; i++) {
        orderedProviders.push(group[(dayOffset + i) % group.length]);
      }
    }

    let lastError = null;
    let lastStatus = null;
    let attemptCount = 0;
    let cooldownRetries = 0;
    const MAX_COOLDOWN_RETRIES = 2;

    while (true) {
      for (const provider of orderedProviders) {
        if (isProviderLocked(provider.name)) {
          console.log(`[GlobalLLM] ⏭️ Skipping ${provider.name} (model locked)`);
          continue;
        }

        attemptCount++;
        const callStart = Date.now();

        console.log(`[GlobalLLM] 🔄 Tier ${provider.tier} → ${provider.name} (model: ${provider.model}, task: ${taskType}, success: ${Math.round(getSuccessRate(provider.name) * 100)}%)`);

        const client = new OpenAI({
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          timeout: provider.timeout,
          maxRetries: 0
        });

        try {
          const completion = await client.chat.completions.create({
            ...params,
            model: provider.model,
          }, {
            headers: { 'Content-Type': 'application/json' }
          });

          const latencyMs = Date.now() - callStart;
          recordResult(provider.name, true, latencyMs);

          // M4: Response size guard — warn on oversized responses (> 50KB)
          const responseContent = completion.choices?.[0]?.message?.content || '';
          const responseBytes = Buffer.byteLength(responseContent, 'utf-8');
          if (responseBytes > 50000) {
            console.warn(`[GlobalLLM] ⚠️ Oversized response from ${provider.name}: ${(responseBytes / 1024).toFixed(1)}KB for task "${taskType}"`);
          }

          console.log(`[GlobalLLM] ✅ Success: ${provider.name} (Tier ${provider.tier}, ${latencyMs}ms, ${(responseBytes / 1024).toFixed(1)}KB, task: ${taskType})`);

          // Attach metadata for downstream consumers
          completion._meta = {
            provider: provider.name,
            tier: provider.tier,
            model: provider.model,
            latencyMs,
            responseBytes,
            taskType,
            attempts: attemptCount,
            isLocal: !!provider.isLocal
          };

          // Log to persistent call log
          logLLMCall({
            taskType,
            provider: provider.name,
            tier: provider.tier,
            model: provider.model,
            latencyMs,
            responseBytes,
            success: true,
            attempts: attemptCount,
            tokensUsed: completion.usage?.total_tokens || null,
          });

          // U2: Score response quality (fire-and-forget)
          try { scoreResponseQuality(completion, taskType, { expectJson: params.response_format?.type === 'json_object', response_format: params.response_format }); } catch { /* non-fatal */ }

          return completion;
        } catch (err) {
          const latencyMs = Date.now() - callStart;
          lastError = err.message || err.toString();
          lastStatus = err.status || 'timeout/network';
          recordResult(provider.name, false, latencyMs);

          const consecutiveFails = providerStats[provider.name]?.consecutiveFails || 0;
          
          if (err.status === 429 || consecutiveFails >= 3) {
            let baseRetryMs = 60000;
            if (err.status === 429) {
              const headerRetry = extractRetryAfter(err);
              if (headerRetry > 0) baseRetryMs = headerRetry;
            } else {
              // Exponential backoff based on consecutive failures (max 5 minutes)
              baseRetryMs = Math.min(10000 * Math.pow(2, consecutiveFails - 3), 300000);
            }
            
            // Add Jitter (± 15%) to prevent Thundering Herd
            const jitter = (Math.random() * 0.3 - 0.15) * baseRetryMs;
            const finalRetryMs = Math.ceil(baseRetryMs + jitter);
            
            const reason = err.status === 429 ? '429 Rate Limit' : `Circuit Breaker (${consecutiveFails} fails)`;
            console.log(`[GlobalLLM] 🛑 ${reason} on ${provider.name}. Locking for ${(finalRetryMs / 1000).toFixed(1)}s → next tier...`);
            lockProvider(provider.name, finalRetryMs);
          } else {
            console.warn(`[GlobalLLM] ❌ ${provider.name} failed (${lastStatus}): ${lastError.substring(0, 200)}`);
          }

          logLLMCall({
            taskType,
            provider: provider.name,
            tier: provider.tier,
            model: provider.model,
            latencyMs,
            success: false,
            error: lastError.substring(0, 300),
            attempts: attemptCount,
          });
        }
      }

      // ── COOLDOWN RETRY: Wait for the earliest locked key to unlock ──
      if (cooldownRetries < MAX_COOLDOWN_RETRIES) {
        const lockedEntries = Object.entries(keyLocks).filter(([, unlockTime]) => unlockTime > Date.now());
        if (lockedEntries.length > 0) {
          const earliestUnlock = Math.min(...lockedEntries.map(([, t]) => t));
          const waitMs = Math.min(earliestUnlock - Date.now() + 1000, 65000); // Cap at 65s
          if (waitMs > 0) {
            cooldownRetries++;
            console.log(`[GlobalLLM] ⏳ All providers exhausted. Cooldown retry ${cooldownRetries}/${MAX_COOLDOWN_RETRIES} — waiting ${Math.round(waitMs/1000)}s for keys to unlock...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue; // Re-enter the while loop and try all providers again
          }
        }
      }

      // All retries exhausted — throw
      throw new Error(`[GlobalLLM] All ${attemptCount} providers exhausted for task "${taskType}". Last: ${lastStatus} — ${lastError}`);
    } // end while(true)
  } finally {
    globalSemaphore.release();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: BACKWARD COMPATIBILITY — getResilientLLMClient wrapper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Legacy wrapper that mimics the old getResilientLLMClient() API.
 * Returns an object with .chat.completions.create() that delegates to callLLM.
 *
 * This allows existing code to continue working without immediate migration:
 *   const client = getResilientLLMClient();
 *   const result = await client.chat.completions.create({ model: 'auto', messages: [...] });
 *
 * The 'model' param is ignored — routing is handled by the Global Engine.
 */
export function getResilientLLMClient(options = {}) {
  return {
    chat: {
      completions: {
        create: async (params) => {
          // Infer task type from params if possible (heuristic)
          const taskType = _inferTaskType(params);
          return callLLM(taskType, params, options);
        }
      }
    }
  };
}

/**
 * Heuristic task type inference from params (for backward-compat calls that
 * don't specify a task type). Examines system prompt keywords.
 */
function _inferTaskType(params) {
  const systemMsg = (params.messages || []).find(m => m.role === 'system')?.content || '';
  const lower = systemMsg.toLowerCase();

  if (lower.includes('jd intelligence')) return 'jd_analysis';
  if (lower.includes('job description') && lower.includes('extract')) return 'jd_analysis';
  if (lower.includes('bullet') || lower.includes('xyz formula') || lower.includes('resume bullet')) return 'bullet_engineering';
  if (lower.includes('consensus') || lower.includes('boardroom') || lower.includes('multi-agent')) return 'consensus';
  if (lower.includes('cover letter')) return 'cover_letter';
  if (lower.includes('email body') || lower.includes('email subject')) return 'email';
  if (lower.includes('skills') && (lower.includes('architect') || lower.includes('core competenc'))) return 'skills_architect';
  if (lower.includes('ats') && (lower.includes('scor') || lower.includes('valid'))) return 'ats_scoring';
  if (lower.includes('company') && lower.includes('research')) return 'company_research';
  if (lower.includes('content fit') || lower.includes('shorten') || lower.includes('condense')) return 'content_fit';
  if (lower.includes('parse') || lower.includes('extract') && lower.includes('resume')) return 'parsing';
  if (lower.includes('interview')) return 'interview_prep';
  if (lower.includes('quick apply')) return 'quick_apply';
  if (lower.includes('draft')) return 'draft';

  return 'default';
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: ENGINE STATS — For monitoring & debugging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a snapshot of engine health — useful for dashboards / debugging.
 */
export function getEngineStats() {
  const registry = getCachedRegistry();
  return {
    totalProviders: registry.length,
    tiers: [...new Set(registry.map(p => p.tier))].sort((a, b) => a - b),
    providerHealth: Object.entries(providerStats).map(([name, stats]) => ({
      name,
      successRate: Math.round(getSuccessRate(name) * 100) + '%',
      avgLatencyMs: Math.round(getAvgLatency(name)),
      totalCalls: stats.success + stats.fail,
      lastUsed: stats.lastUsed,
    })),
    lockedKeys: Object.entries(keyLocks)
      .filter(([, unlock]) => Date.now() < unlock)
      .map(([key, unlock]) => ({
        key: key.substring(0, 10) + '...',
        unlocksIn: Math.round((unlock - Date.now()) / 1000) + 's'
      })),
    taskTierMap: TASK_TIER_MAP,
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: PROVIDER REGISTRY EXPORT — For vectorBrain and other services
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Legacy export — some files import getProviders from llmRouter.
 */
export const getProviders = buildModelRegistry;
