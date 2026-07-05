import { describe, expect, it } from 'vitest'
import { generateGuardianMock } from './geminiMockService'

describe('generateGuardianMock', () => {
  it('turns the pizza developer preset into Slice Buddy', async () => {
    const guardian = await generateGuardianMock({
      guardianType: 'pizza',
      role: 'Remote Developer',
      workHabit: 'Long coding sessions with too few breaks',
      region: 'US',
      language: 'English',
      tone: 'Funny',
    })

    expect(guardian.name).toBe('Slice Buddy')
    expect(guardian.type).toBe('pizza')
    expect(guardian.language).toBe('English')
    expect(guardian.personality.tone).toBe('Funny')
    expect(guardian.breakPlan.focusMinutes).toBeGreaterThan(0)
    expect(guardian.breakPlan.breakMinutes).toBeGreaterThan(0)
    expect(guardian.messages.softReminder).toContain('Slice Buddy')
    expect(guardian.messages.forceBreak).toContain('stand')
    expect(guardian.suggestionTags).toContain('Stretch')
  })

  it('generates Chinese copy when language is Chinese', async () => {
    const guardian = await generateGuardianMock({
      guardianType: 'robot',
      role: '产品经理',
      workHabit: '会议很多，经常忘记休息',
      region: '中国',
      language: '中文',
      tone: '温柔',
    })

    expect(guardian.messages.softReminder).toContain('专注')
    expect(guardian.messages.forceBreak).toContain('站起来')
    expect(guardian.suggestionTags).toContain('喝水')
  })
})
