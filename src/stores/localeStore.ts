import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, translate } from '../i18n'
import type { LocaleCode } from '../i18n'

export const LOCALE_STORAGE_KEY = 'tiny-guardian-locale'

function readStoredLocale(): LocaleCode {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALE
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  return stored && isSupportedLocale(stored) ? stored : DEFAULT_LOCALE
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<LocaleCode>(readStoredLocale())
  const localeOptions = computed(() => SUPPORTED_LOCALES)

  function setLocale(nextLocale: LocaleCode) {
    locale.value = nextLocale
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    }
  }

  function t(key: string): string {
    return translate(key, locale.value)
  }

  return {
    locale,
    localeOptions,
    setLocale,
    t,
  }
})
