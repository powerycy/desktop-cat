import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, isSupportedLocale, translate } from './index'

describe('i18n', () => {
  it('translates shared UI labels for supported locales', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(isSupportedLocale('en-US')).toBe(true)
    expect(isSupportedLocale('fr-FR')).toBe(false)
    expect(translate('guardian.title', 'zh-CN')).toBe('拦屏小可爱')
    expect(translate('guardian.title', 'en-US')).toBe('Screen Buddy')
    expect(translate('guardian.title', 'ja-JP')).toBe('Screen Buddy')
  })

  it('falls back to English when a translation key is missing', () => {
    expect(translate('not.real.key', 'zh-CN')).toBe('not.real.key')
  })
})
