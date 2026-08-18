import { callLLM } from '@/infrastructure/services/llmRouter';
import { parseLlmJson } from '@/shared/utils/llmJsonParser';

/**
 * AGENT 1.5: Company Research (LLM)
 */
export async function agentCompanyResearch(jdIntel) {
  if (!jdIntel.company_name || jdIntel.identification_confidence < 80) {
    return null;
  }

  try {
    const completion = await callLLM('company_research', {
      messages: [
        {
          role: 'system',
          content: `You are an elite Corporate Intelligence Agent. Provide a deep, structured analysis of the requested company to help tailor a resume perfectly to their culture, business model, and tech stack. Output ONLY valid JSON:
{
  "industry_context": "Deep dive into their specific industry niche",
  "core_products_services": ["Product 1", "Product 2"],
  "business_model": "How they make money / target audience (B2B, B2C, Enterprise SaaS, etc)",
  "tech_stack_clues": ["Technologies they are known to use"],
  "culture_and_values": ["Core values, engineering culture, pace"],
  "hidden_terminology": ["Industry jargon", "Product-specific terms"],
  "resume_optimization_strategy": "A 2-sentence strategy on what to emphasize for this specific company"
}`
        },
        { role: 'user', content: `Analyze company: ${jdIntel.company_name} (Industry: ${jdIntel.industry || 'Unknown'})` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1500
    });

    return parseLlmJson(completion.choices[0]?.message?.content || '{}');
  } catch (error) {
    console.error("Agent 1.5 Company Research failed (possibly rate limit):", error.message);
    return null;
  }
}
