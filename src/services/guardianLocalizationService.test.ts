import { describe, expect, it } from 'vitest'
import { DEFAULT_GUARDIAN } from '../stores/guardianStore'
import type { GuardianConfig } from '../types/guardian'
import { localizeGuardianForDisplay } from './guardianLocalizationService'

describe('localizeGuardianForDisplay', () => {
  it('uses the panda Screen Buddy copy in Chinese mode', () => {
    const guardian = localizeGuardianForDisplay(DEFAULT_GUARDIAN, 'zh-CN')

    expect(guardian.name).toBe('拦屏小可爱')
    expect(guardian.type).toBe('panda')
    expect(guardian.personality.catchphrase).toContain('小小休息')
    expect(guardian.messages.softReminder).toContain('专注')
    expect(guardian.suggestionTags).toContain('喝水')
  })

  it('preserves Gemini-generated copy instead of replacing it with interface translations', () => {
    const generated: GuardianConfig = {
      ...DEFAULT_GUARDIAN,
      id: 'guardian-cat-123',
      type: 'cat',
      name: 'Coach Gato',
      language: 'Español',
      personality: {
        tone: 'cálido',
        catchphrase: 'Descansos pequeños, foco grande.',
      },
      messages: {
        softReminder: 'Terminaste tu bloque de enfoque.',
        skipOnce: 'Puedes saltarlo una vez.',
        takeBreak: 'Abrimos un descanso corto.',
        forceBreak: 'Levántate y respira.',
        reportSummary: 'Tus descansos quedan guardados aquí.',
      },
      suggestionTags: ['Estirar', 'Agua', 'Mirar lejos'],
      generatedBy: 'gemini-mock',
    }

    const guardian = localizeGuardianForDisplay(generated, 'zh-CN')

    expect(guardian.name).toBe('Coach Gato')
    expect(guardian.type).toBe('cat')
    expect(guardian.language).toBe('Español')
    expect(guardian.personality.catchphrase).toBe('Descansos pequeños, foco grande.')
    expect(guardian.messages.softReminder).toBe('Terminaste tu bloque de enfoque.')
    expect(guardian.suggestionTags).toEqual(['Estirar', 'Agua', 'Mirar lejos'])
  })
})
