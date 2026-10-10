// What the person is working on. Only changes examples and placeholders — never what the app can do.

export type WorkKind = 'exam' | 'skill' | 'work' | 'creative' | 'habits'

export interface WorkKindInfo {
  id: WorkKind
  emoji: string
  label: string
  /** Default first-project name when the setup name is left empty. */
  sampleName: string
  /** One-tap example tasks on Today. */
  examples: string[]
  /** Goal wizard examples by goal type. */
  goals: { outcome: string; learning: string; process: string }
  /** A concrete first step vs. a vague one, for the "first small step" hint. */
  concrete: { good: string; vague: string }
}

export const WORK_KINDS: WorkKindInfo[] = [
  {
    id: 'exam', emoji: '📚', label: 'Studying for an exam', sampleName: 'Exam prep',
    examples: ['📖 Read 10 pages', '🃏 20 flashcards', '📝 5 practice questions', '🔁 Review yesterday’s notes'],
    goals: { outcome: 'Score 80%+ in finals by 15 Dec', learning: 'Understand chapter 5 well enough to teach it', process: 'Study 2 hours every weekday' },
    concrete: { good: 'Open chapter 4 at page 82', vague: 'Study' },
  },
  {
    id: 'skill', emoji: '🎸', label: 'Learning a skill', sampleName: 'New skill',
    examples: ['🎯 15-min practice drill', '📺 Watch one lesson', '🔁 Repeat yesterday’s exercise', '🎙️ Record a try'],
    goals: { outcome: 'Play a full song by March', learning: 'Get comfortable with the basics', process: 'Practise 20 minutes a day' },
    concrete: { good: 'Play the F chord change 10 times', vague: 'Practise' },
  },
  {
    id: 'work', emoji: '💼', label: 'Work projects', sampleName: 'Work',
    examples: ['✍️ Write for 25 min', '📧 Clear emails', '📋 Plan the next step', '📞 One call'],
    goals: { outcome: 'Ship the report by Friday', learning: 'Learn the new tool well', process: '2 deep-work blocks a day' },
    concrete: { good: 'Write the first paragraph of the intro', vague: 'Report' },
  },
  {
    id: 'creative', emoji: '✍️', label: 'A creative project', sampleName: 'Creative project',
    examples: ['✍️ Write 300 words', '🎨 Sketch for 20 min', '💡 Jot 5 ideas', '✂️ Edit one page'],
    goals: { outcome: 'Finish the first draft by June', learning: 'Find my style', process: 'Create for 30 minutes a day' },
    concrete: { good: 'Write the opening line of scene 2', vague: 'Write' },
  },
  {
    id: 'habits', emoji: '🏃', label: 'Habits & health', sampleName: 'Health',
    examples: ['🏃 15-min walk', '🧘 5-min stretch', '💧 Drink water', '📖 Read 10 pages'],
    goals: { outcome: 'Run 5 km by May', learning: 'Learn proper form', process: 'Move 30 minutes a day' },
    concrete: { good: 'Put on running shoes and step outside', vague: 'Exercise' },
  },
]

export function workKind(id: string | null | undefined): WorkKindInfo {
  return WORK_KINDS.find((w) => w.id === id) ?? WORK_KINDS[0]!
}
