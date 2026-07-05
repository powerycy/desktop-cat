export type GuardianType = 'panda' | 'cat' | 'pizza' | 'cactus' | 'robot'

export interface GuardianGenerationInput {
  guardianType: GuardianType
  role: string
  workHabit: string
  region: string
  language: string
  tone: string
}

export interface BreakPlan {
  focusMinutes: number
  breakMinutes: number
  softReminderDelaySeconds: number
  forceAfterConsecutiveSkips: number
}

export interface GuardianMessages {
  softReminder: string
  skipOnce: string
  takeBreak: string
  forceBreak: string
  reportSummary: string
}

export interface GuardianConfig {
  id: string
  type: GuardianType
  name: string
  emoji: string
  role: string
  region: string
  language: string
  workHabit: string
  personality: {
    tone: string
    catchphrase: string
  }
  breakPlan: BreakPlan
  messages: GuardianMessages
  suggestionTags: string[]
  generatedBy: 'gemini-mock' | 'gemini'
  createdAt: string
}

export interface DailyHealthStats {
  date: string
  focusSessions: number
  completedBreaks: number
  skippedBreaks: number
  forcedBreaks: number
  longestFocusMinutes: number
  totalBreakMinutes: number
  consecutiveSkips: number
}

export interface HealthStatsByDate {
  [date: string]: DailyHealthStats
}
