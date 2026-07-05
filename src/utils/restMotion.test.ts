import { describe, expect, it } from 'vitest'
import {
  REST_CAT_CENTER_Y_RATIO,
  getRestCatStyle,
  getRestCatSize,
  getRestStartPosition,
  getRestTargetX,
  moveRestCatTowardTarget,
} from './restMotion'

describe('rest motion', () => {
  it('keeps the fullscreen rest pet near the visual center instead of too high', () => {
    expect(REST_CAT_CENTER_Y_RATIO).toBeCloseTo(0.45)
  })

  it('starts walking from the left edge and targets the center', () => {
    const size = getRestCatSize(1440, 900)
    expect(getRestStartPosition(1440, 900)).toEqual({
      x: -size,
      y: 900 * REST_CAT_CENTER_Y_RATIO - size / 2,
    })
    expect(getRestTargetX(1440, 900)).toBe(1440 / 2 - size / 2)
  })

  it('uses a larger fixed cat size for fullscreen rest while keeping frame size stable', () => {
    const size = getRestCatSize(1440, 900)
    expect(size).toBeGreaterThan(1000)
    expect(getRestCatStyle('walking', 120, 80, 1440, 900)).toMatchObject({
      width: `${size}px`,
      height: `${size}px`,
    })
    expect(getRestCatStyle('rest', 120, 80, 1440, 900)).toMatchObject({
      width: `${size}px`,
      height: `${size}px`,
    })
  })

  it('applies the global 0.9 fullscreen rest scale', () => {
    expect(getRestCatSize(1440, 900)).toBe(1050)
    expect(getRestCatSize(1920, 1080)).toBe(1361)
    expect(getRestCatSize(1280, 720)).toBe(990)
  })

  it('moves right toward center without overshooting', () => {
    const targetX = getRestTargetX(1440, 900)
    const next = moveRestCatTowardTarget(targetX - 20, targetX, 100, 1)
    expect(next.x).toBe(targetX)
    expect(next.reached).toBe(true)
  })

  it('uses absolute walking position, then fixed centered rest position', () => {
    const size = getRestCatSize(1440, 900)
    expect(getRestCatStyle('walking', 120, 80, 1440, 900)).toMatchObject({
      position: 'absolute',
      left: '120px',
      top: '80px',
      marginLeft: '0',
      marginTop: '0',
    })
    expect(getRestCatStyle('rest', 120, 80, 1440, 900)).toMatchObject({
      position: 'fixed',
      left: '50%',
      top: `${REST_CAT_CENTER_Y_RATIO * 100}%`,
      marginLeft: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
    })
  })
})
