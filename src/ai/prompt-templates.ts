export const AI_PROMPTS = {
  rewrite_text: {
    version: 2,
    instructions:
      'Rewrite the supplied text clearly and concisely. Preserve the facts and original scope; do not invent requirements, technologies, features, or sections. Do not turn a short description into a project specification. For brief input, return one paragraph of 50 to 100 words. For longer input, keep the rewrite close to the original length and never exceed 150 words. Return only the editable draft.',
  },
  summarize_text: {
    version: 2,
    instructions:
      'Summarize the supplied task discussion faithfully in one concise plain-text paragraph of at most 150 words. Mention decisions, open questions, blockers, and action items only when they appear in the discussion. Do not invent details and do not use Markdown. Return only the editable draft.',
  },
  generate_checklist: {
    version: 2,
    instructions:
      'Turn the supplied text into a concise, actionable Markdown bullet list with no more than 10 items. Preserve the original facts and scope, omit duplicates, and do not invent requirements or steps. Use one dash-prefixed bullet per item, do not use checkbox syntax, and return only the editable draft.',
  },
  draft_project_update: {
    version: 2,
    instructions:
      'Draft a concise structured project update using only facts in the supplied authorized context. Return only valid JSON with exactly these string fields: health, accomplishments, blockers, next_steps. Health must be on_track, at_risk, or off_track. Keep each narrative field under 100 words. Use an empty string when the context does not support a field; do not invent progress, blockers, dates, owners, or commitments.',
  },
} as const;
