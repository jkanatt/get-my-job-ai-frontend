/**
 * LLM Router v3 → v5 Migration Wrapper
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * This file is now a thin backward-compatibility wrapper around the
 * Global LLM Engine v5 (globalLLMEngine.js).
 *
 * All routing logic, tier management, circuit breaking, and provider
 * registry have been centralized in globalLLMEngine.js.
 *
 * Existing imports from this file will continue to work:
 *   import { getResilientLLMClient, getProviders } from './llmRouter.js';
 */

export { getResilientLLMClient, getProviders, callLLM, getEngineStats } from './globalLLMEngine.js';
