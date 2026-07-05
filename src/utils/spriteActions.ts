export type SpriteActionKey = 'walk' | 'sit' | 'sleep' | 'rest'

export interface SpriteActionGroup {
  key: SpriteActionKey
  label: {
    zh: string
    en: string
  }
  aliases: string[]
}

export interface NamedFile {
  name: string
}

export const REQUIRED_SPRITE_ACTION_GROUPS: SpriteActionGroup[] = [
  {
    key: 'walk',
    label: { zh: '行走', en: 'walk' },
    aliases: ['walk', 'walking', '行走', '走路', '移动'],
  },
  {
    key: 'sit',
    label: { zh: '坐姿', en: 'sitting' },
    aliases: ['sit', 'sitting', '坐姿', '坐下', '坐着'],
  },
  {
    key: 'sleep',
    label: { zh: '睡觉', en: 'sleep' },
    aliases: ['sleep', 'sleeping', '睡觉', '睡眠'],
  },
  {
    key: 'rest',
    label: { zh: '休息', en: 'rest' },
    aliases: ['rest', 'break', '休息', '休息中'],
  },
]

export function actionKeyFromFileName(fileName: string): SpriteActionKey | null {
  const stem = fileName.replace(/\.[^.]+$/u, '')
  const normalized = stem
    .replace(/[\s_-]*\d+$/u, '')
    .replace(/[\s_-]+$/u, '')
    .toLowerCase()

  for (const group of REQUIRED_SPRITE_ACTION_GROUPS) {
    if (group.aliases.some(alias => alias.toLowerCase() === normalized)) {
      return group.key
    }
  }
  return null
}

export function findMissingRequiredActions(files: NamedFile[], locale: string): string[] {
  const detectedActions = new Set(
    files
      .filter(file => file.name.toLowerCase().endsWith('.png'))
      .map(file => actionKeyFromFileName(file.name))
      .filter((key): key is SpriteActionKey => Boolean(key)),
  )

  return REQUIRED_SPRITE_ACTION_GROUPS
    .filter(({ key }) => !detectedActions.has(key))
    .map(({ label }) => locale === 'zh-CN' ? label.zh : label.en)
}
