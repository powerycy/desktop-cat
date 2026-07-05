import { describe, expect, it } from 'vitest'
import { createEmptyDailyHealthStats, reduceDailyHealthStats } from './healthStore'

describe('health stats reducer', () => {
  it('tracks skips, forced breaks, completed breaks, and longest focus', () => {
    let stats = createEmptyDailyHealthStats('2026-07-01')

    stats = reduceDailyHealthStats(stats, { type: 'focus-session', focusMinutes: 35 })
    stats = reduceDailyHealthStats(stats, { type: 'skip-break' })
    stats = reduceDailyHealthStats(stats, { type: 'skip-break' })
    stats = reduceDailyHealthStats(stats, { type: 'force-break' })
    stats = reduceDailyHealthStats(stats, { type: 'complete-break', breakMinutes: 6 })

    expect(stats.focusSessions).toBe(1)
    expect(stats.skippedBreaks).toBe(2)
    expect(stats.forcedBreaks).toBe(1)
    expect(stats.completedBreaks).toBe(1)
    expect(stats.longestFocusMinutes).toBe(35)
    expect(stats.totalBreakMinutes).toBe(6)
    expect(stats.consecutiveSkips).toBe(0)
  })
})
