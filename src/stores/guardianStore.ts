import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { GuardianConfig } from '../types/guardian'
import { PIZZA_DEVELOPER_PRESET, generateGuardianMock } from '../services/geminiMockService'

export const GUARDIAN_STORAGE_KEY = 'tiny-guardian-config'

export const DEFAULT_GUARDIAN: GuardianConfig = {
  id: 'guardian-default-panda',
  type: 'panda',
  name: '拦屏小可爱',
  emoji: '🐼',
  role: '桌面健康提醒助手',
  region: '中国',
  language: '中文',
  workHabit: '专注工作后需要及时休息',
  personality: {
    tone: '温柔',
    catchphrase: '小小休息，也是在守护大大的灵感。',
  },
  breakPlan: {
    focusMinutes: 45,
    breakMinutes: 5,
    softReminderDelaySeconds: 45,
    forceAfterConsecutiveSkips: 2,
  },
  messages: {
    softReminder: '拦屏小可爱提醒你：这轮专注结束啦，该放松一下眼睛和肩膀。',
    skipOnce: '已记录跳过，拦屏小可爱会记得这次。',
    takeBreak: '拦屏小可爱正在为你打开一段恢复时间。',
    forceBreak: '拦屏小可爱说：现在必须站起来，呼吸一下，让身体重新上线。',
    reportSummary: '拦屏小可爱会在本机记录你的专注、休息和跳过次数。',
  },
  suggestionTags: ['伸展', '眨眼', '喝水'],
  generatedBy: 'gemini-mock',
  createdAt: new Date(0).toISOString(),
}

function readStoredGuardian(): GuardianConfig | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(GUARDIAN_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GuardianConfig
  } catch {
    return null
  }
}

function persistGuardian(config: GuardianConfig | null) {
  if (typeof localStorage === 'undefined') return
  if (config) localStorage.setItem(GUARDIAN_STORAGE_KEY, JSON.stringify(config))
  else localStorage.removeItem(GUARDIAN_STORAGE_KEY)
}

export const useGuardianStore = defineStore('guardian', () => {
  const savedGuardian = ref<GuardianConfig | null>(null)
  const currentGuardian = computed(() => savedGuardian.value ?? DEFAULT_GUARDIAN)

  function loadFromStorage() {
    savedGuardian.value = readStoredGuardian()
  }

  function saveGuardian(config: GuardianConfig) {
    savedGuardian.value = config
    persistGuardian(config)
  }

  function clearGuardian() {
    savedGuardian.value = null
    persistGuardian(null)
  }

  async function generatePizzaDeveloperDemo() {
    const config = await generateGuardianMock(PIZZA_DEVELOPER_PRESET)
    saveGuardian(config)
    return config
  }

  loadFromStorage()

  return {
    savedGuardian,
    currentGuardian,
    loadFromStorage,
    saveGuardian,
    clearGuardian,
    generatePizzaDeveloperDemo,
  }
})
