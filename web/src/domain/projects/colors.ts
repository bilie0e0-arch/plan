export const PROJECT_COLORS = ['slate', 'teal', 'blue', 'violet', 'rose', 'amber', 'green', 'stone'] as const
export type ProjectColor = (typeof PROJECT_COLORS)[number]
