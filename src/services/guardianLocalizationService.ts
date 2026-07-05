import type { LocaleCode } from '../i18n'
import { translate } from '../i18n'
import type { GuardianConfig } from '../types/guardian'

export function localizeGuardianForDisplay(config: GuardianConfig, locale: LocaleCode): GuardianConfig {
  if (!config.id.startsWith('guardian-default-')) return config
  if (locale !== 'zh-CN' && locale !== 'en-US') return config

  return {
    ...config,
    type: 'panda',
    emoji: '🐼',
    name: translate('guardian.defaultName', locale),
    language: locale === 'zh-CN' ? '中文' : 'English',
    personality: {
      ...config.personality,
      catchphrase: translate('guardian.defaultCatchphrase', locale),
    },
    messages: {
      softReminder: translate('guardian.defaultSoftReminder', locale),
      skipOnce: translate('guardian.defaultSkipOnce', locale),
      takeBreak: translate('guardian.defaultTakeBreak', locale),
      forceBreak: translate('guardian.defaultForceBreak', locale),
      reportSummary: translate('guardian.defaultReportSummary', locale),
    },
    suggestionTags: [
      translate('guardian.tagStretch', locale),
      translate('guardian.tagBlink', locale),
      translate('guardian.tagWater', locale),
    ],
  }
}
