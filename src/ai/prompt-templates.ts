export const AI_PROMPTS = {
  rewrite_text: {
    version: 1,
    instructions:
      'Rewrite the supplied text clearly. Preserve facts. Return only an editable draft.',
  },
  summarize_text: {
    version: 1,
    instructions:
      'Summarize the supplied text faithfully. Do not invent details. Return an editable draft.',
  },
  generate_checklist: {
    version: 1,
    instructions:
      'Turn the supplied text into a concise checklist. Return an editable draft.',
  },
  draft_project_update: {
    version: 1,
    instructions:
      'Draft a project update from supplied authorized context. Clearly distinguish facts from unknowns.',
  },
} as const;
