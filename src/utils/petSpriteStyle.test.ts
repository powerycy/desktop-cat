import { describe, expect, it } from 'vitest'
import { getPetSpriteClasses } from './petSpriteStyle'

describe('pet sprite style classes', () => {
  it('shrinks every Grumpy Cat desktop animation consistently', () => {
    expect(getPetSpriteClasses('暴躁喵', 'walking', true)).toContain('grumpy-desktop')
    expect(getPetSpriteClasses('暴躁喵', 'sit_idle', true)).toContain('grumpy-desktop')
    expect(getPetSpriteClasses('暴躁喵', 'sleeping', true)).toContain('grumpy-desktop')
    expect(getPetSpriteClasses('暴躁喵', 'sitting', true)).toContain('grumpy-desktop')
    expect(getPetSpriteClasses('暴躁喵', 'idle', true)).toContain('grumpy-desktop')
    expect(getPetSpriteClasses('暴躁喵', 'interacting', true)).toContain('grumpy-desktop')
    expect(getPetSpriteClasses('爱坤', 'walking', true)).not.toContain('grumpy-desktop')
  })
})
