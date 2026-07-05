import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { DailyHealthStats, HealthStatsByDate } from '../types/guardian'

export const HEALTH_STATS_STORAGE_KEY = 'tiny-guardian-health-stats'

type HealthStatsAction =
  | { type: 'focus-session'; focusMinutes: number }
  | { type: 'complete-break'; breakMinutes: number }
  | { type: 'skip-break' }
  | { type: 'force-break' }

export function createEmptyDailyHealthStats(date: string): DailyHealthStats {
  return {
    date,
    focusSessions: 0,
    completedBreaks: 0,
    skippedBreaks: 0,
    forcedBreaks: 0,
    longestFocusMinutes: 0,
    totalBreakMinutes: 0,
    consecutiveSkips: 0,
  }
}

export function reduceDailyHealthStats(stats: DailyHealthStats, action: HealthStatsAction): DailyHealthStats {
  switch (action.type) {
    case 'focus-session':
      return {
        ...stats,
        focusSessions: stats.focusSessions + 1,
        longestFocusMinutes: Math.max(stats.longestFocusMinutes, action.focusMinutes),
      }
    case 'complete-break':
      return {
        ...stats,
        completedBreaks: stats.completedBreaks + 1,
        totalBreakMinutes: stats.totalBreakMinutes + action.breakMinutes,
        consecutiveSkips: 0,
      }
    case 'skip-break':
      return {
        ...stats,
        skippedBreaks: stats.skippedBreaks + 1,
        consecutiveSkips: stats.consecutiveSkips + 1,
      }
    case 'force-break':
      return {
        ...stats,
        forcedBreaks: stats.forcedBreaks + 1,
      }
  }
}

function todayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readStoredStats(): HealthStatsByDate {
  if (typeof localStorage === 'undefined') return {}
  const raw = localStorage.getItem(HEALTH_STATS_STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as HealthStatsByDate
  } catch {
    return {}
  }
}

function persistStats(stats: HealthStatsByDate) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(HEALTH_STATS_STORAGE_KEY, JSON.stringify(stats))
}

export const useHealthStore = defineStore('health', () => {
  const statsByDate = ref<HealthStatsByDate>({})
  const currentDate = ref(todayKey())
  const todayStats = computed(() => statsByDate.value[currentDate.value] ?? createEmptyDailyHealthStats(currentDate.value))
  const recentStats = computed(() => Object.values(statsByDate.value).sort((a, b) => b.date.localeCompare(a.date)))

  function loadFromStorage() {
    statsByDate.value = readStoredStats()
    ensureToday()
  }

  function ensureToday() {
    currentDate.value = todayKey()
    if (!statsByDate.value[currentDate.value]) {
      statsByDate.value[currentDate.value] = createEmptyDailyHealthStats(currentDate.value)
    }
  }

  function applyAction(action: HealthStatsAction) {
    ensureToday()
    statsByDate.value[currentDate.value] = reduceDailyHealthStats(todayStats.value, action)
    persistStats(statsByDate.value)
  }

  function recordFocusSession(focusMinutes: number) {
    applyAction({ type: 'focus-session', focusMinutes })
  }

  function recordBreakCompleted(breakMinutes: number) {
    applyAction({ type: 'complete-break', breakMinutes })
  }

  function recordBreakSkipped() {
    applyAction({ type: 'skip-break' })
  }

  function recordForcedBreak() {
    applyAction({ type: 'force-break' })
  }

  loadFromStorage()

  return {
    statsByDate,
    todayStats,
    recentStats,
    loadFromStorage,
    recordFocusSession,
    recordBreakCompleted,
    recordBreakSkipped,
    recordForcedBreak,
  }
})
