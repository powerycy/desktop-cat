import { describe, expect, it } from 'vitest'
import {
  REQUIRED_SPRITE_ACTION_GROUPS,
  actionKeyFromFileName,
  findMissingRequiredActions,
} from './spriteActions'

describe('sprite action requirements', () => {
  it('requires walking, sitting, sleeping, and rest actions', () => {
    expect(REQUIRED_SPRITE_ACTION_GROUPS.map(group => group.key)).toEqual([
      'walk',
      'sit',
      'sleep',
      'rest',
    ])
    expect(REQUIRED_SPRITE_ACTION_GROUPS.map(group => group.label.zh)).toEqual([
      '行走',
      '坐姿',
      '睡觉',
      '休息',
    ])
  })

  it('recognizes Chinese frame names for every required action', () => {
    expect(actionKeyFromFileName('行走_01.png')).toBe('walk')
    expect(actionKeyFromFileName('坐姿_01.png')).toBe('sit')
    expect(actionKeyFromFileName('睡觉_01.png')).toBe('sleep')
    expect(actionKeyFromFileName('休息_01.png')).toBe('rest')
  })

  it('does not accept entry or sneak names as action aliases', () => {
    expect(actionKeyFromFileName('入场_01.png')).toBeNull()
    expect(actionKeyFromFileName('entry_01.png')).toBeNull()
    expect(actionKeyFromFileName('sneak_01.png')).toBeNull()
  })

  it('reports no missing required actions when the four new actions are present', () => {
    const files = [
      { name: '行走_01.png' },
      { name: '坐姿_01.png' },
      { name: '睡觉_01.png' },
      { name: '休息_01.png' },
    ]

    expect(findMissingRequiredActions(files, 'zh-CN')).toEqual([])
  })
})
