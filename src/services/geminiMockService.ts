import type { GuardianConfig, GuardianGenerationInput, GuardianType } from '../types/guardian'

type MockLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'es'

const GUARDIAN_BASE: Record<GuardianType, { name: string; emoji: string }> = {
  panda: {
    name: '拦屏小可爱',
    emoji: '🐼',
  },
  cat: {
    name: 'Paw Coach',
    emoji: '🐱',
  },
  pizza: {
    name: 'Slice Buddy',
    emoji: '🍕',
  },
  cactus: {
    name: 'Prickle Pal',
    emoji: '🌵',
  },
  robot: {
    name: 'Circuit Scout',
    emoji: '🤖',
  },
}

const TAGS: Record<MockLanguage, string[]> = {
  zh: ['伸展', '喝水', '远眺'],
  en: ['Stretch', 'Hydrate', 'Look Away'],
  ja: ['ストレッチ', '水分補給', '遠くを見る'],
  ko: ['스트레칭', '물 마시기', '멀리 보기'],
  es: ['Estirar', 'Agua', 'Mirar lejos'],
}

function chooseFocusMinutes(workHabit: string): number {
  const normalized = workHabit.toLowerCase()
  if (normalized.includes('long') || normalized.includes('coding') || normalized.includes('deep')) return 45
  if (normalized.includes('meeting') || normalized.includes('short')) return 30
  return 40
}

function tonePrefix(tone: string): string {
  const normalized = tone.toLowerCase()
  if (normalized.includes('fun')) return 'Tiny dramatic announcement'
  if (normalized.includes('gentle')) return 'Gentle check-in'
  if (normalized.includes('strict')) return 'Non-negotiable health protocol'
  return 'Friendly reminder'
}

function detectMockLanguage(language: string): MockLanguage {
  const normalized = language.toLowerCase()
  if (language.includes('中') || normalized.includes('zh') || normalized.includes('chinese')) return 'zh'
  if (language.includes('日') || normalized.includes('ja') || normalized.includes('japanese')) return 'ja'
  if (language.includes('韩') || language.includes('韓') || normalized.includes('ko') || normalized.includes('korean')) return 'ko'
  if (language.includes('西') || normalized.includes('es') || normalized.includes('spanish') || normalized.includes('español')) return 'es'
  return 'en'
}

function buildLocalizedCopy(
  lang: MockLanguage,
  name: string,
  tone: string,
  focusMinutes: number,
  breakMinutes: number,
) {
  if (lang === 'zh') {
    return {
      catchphrase: `${name} 说：小小休息，也是在守护大大的灵感。`,
      messages: {
        softReminder: `${name} 提醒你：这轮 ${focusMinutes} 分钟专注结束啦，眼睛和肩膀该放松一下。`,
        skipOnce: `${name} 允许你跳过一次，但会认真记下来。`,
        takeBreak: `${name} 正在为你打开 ${breakMinutes} 分钟恢复时间。`,
        forceBreak: `${name} 说现在必须站起来，呼吸一下，让身体重新上线。`,
        reportSummary: `${name} 会在本机记录你的专注、休息和跳过次数。`,
      },
    }
  }

  if (lang === 'ja') {
    return {
      catchphrase: `${name}: 小さな休憩が大きな集中を守ります。`,
      messages: {
        softReminder: `${name} からのお知らせ: ${focusMinutes}分の集中が終わりました。少し休みましょう。`,
        skipOnce: `${name} は一度だけスキップを許可します。`,
        takeBreak: `${name} が ${breakMinutes}分の休憩を開始します。`,
        forceBreak: `${name} からのお願い: 立ち上がって深呼吸しましょう。`,
        reportSummary: `${name} は集中、休憩、スキップ回数をこの端末に記録します。`,
      },
    }
  }

  if (lang === 'ko') {
    return {
      catchphrase: `${name}: 작은 휴식이 큰 집중을 지켜요.`,
      messages: {
        softReminder: `${name} 알림: ${focusMinutes}분 집중이 끝났어요. 잠시 쉬어가요.`,
        skipOnce: `${name}가 한 번 건너뛰기를 허용할게요.`,
        takeBreak: `${name}가 ${breakMinutes}분 휴식을 시작합니다.`,
        forceBreak: `${name}가 말해요: 일어나서 숨을 고르고 몸을 풀어주세요.`,
        reportSummary: `${name}가 집중, 휴식, 건너뛰기 기록을 이 기기에 저장합니다.`,
      },
    }
  }

  if (lang === 'es') {
    return {
      catchphrase: `${name} dice: pequeños descansos protegen grandes ideas.`,
      messages: {
        softReminder: `${name} avisa: terminaste ${focusMinutes} minutos de enfoque. Toca descansar.`,
        skipOnce: `${name} permite saltarlo una vez.`,
        takeBreak: `${name} abre un descanso de ${breakMinutes} minutos.`,
        forceBreak: `${name} dice que es hora de levantarte, respirar y resetear.`,
        reportSummary: `${name} registra tu enfoque, descansos y saltos localmente en este dispositivo.`,
      },
    }
  }

  return {
    catchphrase: `${name} says: tiny breaks, giant future.`,
    messages: {
      softReminder: `${tonePrefix(tone)} from ${name}: your ${focusMinutes}-minute focus slice is done.`,
      skipOnce: `${name} will allow one crispy little skip.`,
      takeBreak: `${name} is opening a ${breakMinutes}-minute reset.`,
      forceBreak: `${name} says it is time to stand, breathe, and let your brain reheat evenly.`,
      reportSummary: `${name} tracked your focus, breaks, and skip streak locally on this device.`,
    },
  }
}

export async function generateGuardianMock(input: GuardianGenerationInput): Promise<GuardianConfig> {
  const base = GUARDIAN_BASE[input.guardianType]
  const focusMinutes = chooseFocusMinutes(input.workHabit)
  const breakMinutes = focusMinutes >= 45 ? 6 : 5
  const language = detectMockLanguage(input.language)
  const copy = buildLocalizedCopy(language, base.name, input.tone, focusMinutes, breakMinutes)

  return {
    id: `guardian-${input.guardianType}-${Date.now()}`,
    type: input.guardianType,
    name: base.name,
    emoji: base.emoji,
    role: input.role,
    region: input.region,
    language: input.language,
    workHabit: input.workHabit,
    personality: {
      tone: input.tone,
      catchphrase: copy.catchphrase,
    },
    breakPlan: {
      focusMinutes,
      breakMinutes,
      softReminderDelaySeconds: 45,
      forceAfterConsecutiveSkips: 2,
    },
    messages: copy.messages,
    suggestionTags: TAGS[language],
    generatedBy: 'gemini-mock',
    createdAt: new Date().toISOString(),
  }
}

export const PIZZA_DEVELOPER_PRESET: GuardianGenerationInput = {
  guardianType: 'pizza',
  role: 'Remote Developer',
  workHabit: 'Long coding sessions with too few breaks',
  region: 'US',
  language: 'English',
  tone: 'Funny',
}
