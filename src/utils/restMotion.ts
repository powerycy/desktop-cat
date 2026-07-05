import type { CSSProperties } from 'vue'

export type RestMotionPhase = 'walking' | 'rest'

export const MIN_REST_CAT_SIZE = 1100
export const MAX_REST_CAT_SIZE = 1800
export const CAT_REST_SIZE = MIN_REST_CAT_SIZE
export const REST_CAT_CENTER_Y_RATIO = 0.45
export const REST_CAT_GLOBAL_SCALE = 0.9

export function getRestCatSize(viewportWidth: number, viewportHeight: number): number {
  const roomySize = Math.min(viewportWidth * 0.81, viewportHeight * 1.4)
  const baseSize = Math.min(MAX_REST_CAT_SIZE, Math.max(MIN_REST_CAT_SIZE, roomySize))
  return Math.round(baseSize * REST_CAT_GLOBAL_SCALE)
}

export function getRestStartPosition(viewportWidth: number, viewportHeight: number) {
  const size = getRestCatSize(viewportWidth, viewportHeight)
  void viewportWidth
  return {
    x: -size,
    y: viewportHeight * REST_CAT_CENTER_Y_RATIO - size / 2,
  }
}

export function getRestTargetX(viewportWidth: number, viewportHeight: number) {
  const size = getRestCatSize(viewportWidth, viewportHeight)
  return viewportWidth / 2 - size / 2
}

export function getRestWalkSpeed(viewportWidth: number, viewportHeight: number) {
  return (viewportWidth + getRestCatSize(viewportWidth, viewportHeight)) / 7
}

export function moveRestCatTowardTarget(currentX: number, targetX: number, speed: number, deltaSeconds: number) {
  const nextX = currentX + speed * deltaSeconds
  if (nextX >= targetX) return { x: targetX, reached: true }
  return { x: nextX, reached: false }
}

export function getRestCatStyle(
  phase: RestMotionPhase,
  catX: number,
  catY: number,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
): CSSProperties {
  const size = getRestCatSize(viewportWidth, viewportHeight)
  return {
    width: `${size}px`,
    height: `${size}px`,
    position: phase === 'walking' ? 'absolute' : 'fixed',
    left: phase === 'walking' ? `${catX}px` : '50%',
    top: phase === 'walking' ? `${catY}px` : `${REST_CAT_CENTER_Y_RATIO * 100}%`,
    marginLeft: phase === 'walking' ? '0' : `${-size / 2}px`,
    marginTop: phase === 'walking' ? '0' : `${-size / 2}px`,
  }
}
