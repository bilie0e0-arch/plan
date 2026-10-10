/** Coach tone presets (DESIGN §10.12). Fixed, hand-written copy — no AI. */
export type Tone = 'calm' | 'direct' | 'playful'

type Vars = Record<string, string | number>
type Line = (v: Vars) => string

const LINES: Record<string, Record<Tone, Line>> = {
  resume: {
    calm: (v) => `Your session on “${v.title}” is waiting.`,
    direct: (v) => `Resume “${v.title}”.`,
    playful: (v) => `“${v.title}” is still on the table. Back in?`,
  },
  plan_day: {
    calm: () => 'Take three minutes to plan your day.',
    direct: () => 'Plan the day first.',
    playful: () => 'New day, blank page. Let’s sketch it.',
  },
  break: {
    calm: (v) => `${v.n} sessions in a row. A short break will help the next one.`,
    direct: (v) => `${v.n} sessions without a break. Take one.`,
    playful: (v) => `${v.n} sessions straight. Your brain has requested snacks.`,
  },
  shutdown: {
    calm: () => 'Your day is ending. Close it gently.',
    direct: () => 'Close the day.',
    playful: () => 'Curtain call. Let’s wrap the day.',
  },
  start_task: {
    calm: (v) => `Next: ${v.title}.`,
    direct: (v) => `${v.title}. Start now.`,
    playful: (v) => `${v.title} — let’s get it moving.`,
  },
  pick_task: {
    calm: () => 'What’s next for you?',
    direct: () => 'Pick your next task.',
    playful: () => 'Your move. What’s next?',
  },
  process_inbox: {
    calm: (v) => `${v.n} items are waiting in your inbox.`,
    direct: (v) => `Inbox: ${v.n}. Sort it — 5 minutes.`,
    playful: (v) => `${v.n} loose thoughts in the inbox. Quick tidy?`,
  },
  empty: {
    calm: () => 'Nothing planned right now. Capture or plan something.',
    direct: () => 'Nothing on Today. Add something.',
    playful: () => 'Quiet moment. Want to give it a job?',
  },
  closed: {
    calm: () => 'Day closed. Rest well.',
    direct: () => 'Day closed.',
    playful: () => 'Day closed. Off the clock.',
  },
  climbed: {
    calm: (v) => `Three clean sessions. ${v.rung} minutes unlocked.`,
    direct: (v) => `Rung up: ${v.rung} min.`,
    playful: (v) => `Three clean in a row — welcome to ${v.rung} minutes.`,
  },
  suggest_down: {
    calm: (v) => `Two sessions stopped early. Try ${v.rung} minutes for a while?`,
    direct: (v) => `Two early stops. Drop to ${v.rung} min?`,
    playful: (v) => `${v.rung} minutes might fit better right now. Try it?`,
  },
  block_ready: {
    calm: (v) => `Your “${v.title}” block is ready when you are.`,
    direct: (v) => `${v.title}. Start now.`,
    playful: (v) => `“${v.title}” o’clock. Desk, water, go.`,
  },
  heads_up: {
    calm: (v) => `“${v.title}” starts in ${v.n} min. Wrap up what you’re doing.`,
    direct: (v) => `${v.title} in ${v.n} min. Wrap up.`,
    playful: (v) => `${v.n} minutes to “${v.title}”. Land the plane.`,
  },
  gap: {
    calm: (v) => `${v.n} minutes free before your next block. Something small?`,
    direct: (v) => `${v.n} min gap. Use it.`,
    playful: (v) => `${v.n} spare minutes — perfect for a quick win.`,
  },
  missed_block: {
    calm: (v) => `“${v.title}” slipped. Want to find another slot?`,
    direct: (v) => `Missed: ${v.title}. Move it?`,
    playful: (v) => `“${v.title}” escaped. Rematch later today?`,
  },
  pr: {
    calm: (v) => `New personal best: ${v.n} minutes clean.`,
    direct: (v) => `Record: ${v.n} min clean.`,
    playful: (v) => `${v.n} minutes, zero breaks. That’s a new record.`,
  },
  fresh_week: {
    calm: () => 'A new week. A clean page — review last week and set this one up.',
    direct: () => 'New week. Run your weekly review.',
    playful: () => 'Fresh week, fresh start. Ten minutes to set it up?',
  },
  fresh_month: {
    calm: () => 'A new month begins. A good moment to look back and reset.',
    direct: () => 'New month. Review and reset.',
    playful: () => 'Month one-of-twelve energy. Reset time?',
  },
  speak_drill: {
    calm: () => 'Speaking drill week — a 5-minute drill fits nicely today.',
    direct: () => 'Speaking drill: do today’s 5 minutes.',
    playful: () => 'Your voice called. It wants its 5-minute workout.',
  },
  starter_stopped: {
    calm: () => 'Started. That counts.',
    direct: () => 'Started. Counted.',
    playful: () => 'You started. That was the hard part.',
  },
}

export function say(tone: Tone, key: keyof typeof LINES | string, vars: Vars = {}): string {
  const line = LINES[key]?.[tone] ?? LINES[key]?.calm
  return line ? line(vars) : ''
}
