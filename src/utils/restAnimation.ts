import type { ManifestEntry, SpriteManifest } from '../composables/useAnimation'

export type RestAnimationAction = 'walk' | 'rest' | 'sleep' | 'sit' | 'idle'

export interface RestAnimationPhase {
  action: RestAnimationAction
  loop: boolean
}

export function entryForRestAction(manifest: SpriteManifest, action: RestAnimationAction): ManifestEntry | undefined {
  if (action === 'sit') return manifest.sit ?? manifest.sit_idle
  return manifest[action]
}

export function buildRestAnimationSequence(manifest: SpriteManifest): RestAnimationPhase[] {
  const loopAction: RestAnimationAction | null = manifest.rest
    ? 'rest'
    : manifest.sleep
      ? 'sleep'
      : (manifest.sit ?? manifest.sit_idle)
        ? 'sit'
        : manifest.idle
          ? 'idle'
          : null

  const phases: RestAnimationPhase[] = []
  if (manifest.walk) phases.push({ action: 'walk', loop: false })
  if (loopAction) phases.push({ action: loopAction, loop: true })
  return phases
}
