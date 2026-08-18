import { TEMPLATE_STRUCTURES, buildTemplateContext, renderTemplate } from '@/shared/utils/templateEngine';

/**
 * Returns the fully rendered email templates using the user's profile data.
 * @param {Object} profile - The user's parsed profile data
 * @param {Object} jobContext - Optional job context { role, company, recruiterName }
 */
export function getEmailTemplates(profile, jobContext = {}) {
  const ctx = buildTemplateContext(profile);
  
  return TEMPLATE_STRUCTURES.map(tpl => ({
    id: tpl.id,
    name: tpl.name,
    type: tpl.type,
    subject: renderTemplate(tpl.subjectTemplate, ctx, jobContext),
    body: renderTemplate(tpl.bodyTemplate, ctx, jobContext)
  }));
}

// For backwards compatibility before profile is loaded, export a dummy array
// so that UI doesn't crash if it expects an array directly.
export const EMAIL_TEMPLATES = getEmailTemplates({});

