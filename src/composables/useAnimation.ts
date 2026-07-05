import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { PetState } from '../stores/petStore'

// Manifest entry can be:
//   string[]                       — individual frame file names (legacy)
//   { sheet: string; count: number } — horizontal sprite sheet
export type ManifestEntry = string[] | { sheet: string; count: number }

export interface SpriteManifest {
  idle?:     ManifestEntry
  walk?:     ManifestEntry
  sit?:      ManifestEntry
  sit_idle?: ManifestEntry
  sleep?:    ManifestEntry
  interact?: ManifestEntry
  // rest-mode frames (used by RestView)
  liedown?:  ManifestEntry
  rest?:     ManifestEntry
  [key: string]: ManifestEntry | undefined
}

const ANIMATION_FPS: Record<PetState, number> = {
  idle:        6,
  walking:     7,
  sitting:     7,
  sit_idle:    2,
  sleeping:    3,
  interacting: 12,
}

/** Slice a horizontal sprite sheet into data-URL frames via OffscreenCanvas. */
async function sliceSheet(src: string, count: number): Promise<string[]> {
  const resp = await fetch(src)
  if (!resp.ok) throw new Error(`Failed to fetch sprite sheet: ${src}`)
  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const fw = Math.round(img.naturalWidth / count)
        const fh = img.naturalHeight
        const frames: string[] = []
        for (let i = 0; i < count; i++) {
          const canvas = document.createElement('canvas')
          canvas.width = fw
          canvas.height = fh
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh)
          frames.push(canvas.toDataURL('image/png'))
        }
        URL.revokeObjectURL(objectUrl)
        resolve(frames)
      } catch (e) {
        URL.revokeObjectURL(objectUrl)
        reject(e)
      }
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl)
      reject(e)
    }
    img.src = objectUrl
  })
}

/** Resolve a manifest entry to a list of data-URL or file-URL frame strings. */
async function resolveFrames(entry: ManifestEntry | undefined, base: string): Promise<string[]> {
  if (!entry) return []
  if (Array.isArray(entry)) {
    return entry.map(f => `${base}/${f}`)
  }
  return sliceSheet(`${base}/${entry.sheet}`, entry.count)
}

/**
 * @param onCycleComplete  Called each time the current animation completes one full cycle
 *                         (last frame shown → wraps back to first).
 *                         Use this to drive one-shot transitions: when the callback fires
 *                         for a one-shot state, call setState on the next state.
 *                         Loop states can ignore the callback — they continue looping.
 */
export function useAnimation(
  currentState: Ref<PetState>,
  spriteBase: Ref<string>,
  manifest: Ref<SpriteManifest | null>,
  onCycleComplete?: (state: PetState) => void,
) {
  const currentSrc = ref('')
  let frames: string[] = []
  let frameIndex = 0
  let animTimer: ReturnType<typeof setInterval> | null = null
  let animVersion = 0

  const frameCache = new Map<string, string[]>()

  async function loadFramesForState(state: PetState) {
    if (!manifest.value || !spriteBase.value) return []
    const cacheKey = `${spriteBase.value}::${state}`
    if (frameCache.has(cacheKey)) return frameCache.get(cacheKey)!

    const stateKey = state === 'walking'     ? 'walk'
      : state === 'sitting'    ? 'sit'
      : state === 'sit_idle'   ? 'sit_idle'
      : state === 'sleeping'   ? 'sleep'
      : state === 'interacting' ? (manifest.value.interact ? 'interact' : 'idle')
      : 'idle'

    const entry = manifest.value[stateKey]
      ?? (state === 'sitting' ? manifest.value['sit_idle'] : undefined)
      ?? (state === 'sit_idle' ? manifest.value['sit'] : undefined)
      ?? manifest.value['walk']
    const resolved = await resolveFrames(entry, spriteBase.value)
    frameCache.set(cacheKey, resolved)
    return resolved
  }

  async function startAnimation(state: PetState) {
    const version = ++animVersion
    if (animTimer) clearInterval(animTimer)
    frameIndex = 0

    try {
      frames = await loadFramesForState(state)
    } catch (e) {
      console.error('[useAnimation] Failed to load frames:', state, e)
      frames = []
    }
    if (version !== animVersion) return
    if (frames.length === 0) return

    const fps = ANIMATION_FPS[state] ?? 6
    currentSrc.value = frames[0]

    animTimer = setInterval(() => {
      frameIndex++
      if (frameIndex >= frames.length) {
        frameIndex = 0
        // Notify caller that one full cycle completed; caller decides loop vs one-shot
        onCycleComplete?.(state)
      }
      currentSrc.value = frames[frameIndex]
    }, 1000 / fps)
  }

  watch(currentState, (s) => startAnimation(s), { immediate: true })
  watch([manifest, spriteBase], () => {
    frameCache.clear()
    startAnimation(currentState.value)
  })

  onUnmounted(() => {
    if (animTimer) clearInterval(animTimer)
  })

  return { currentSrc }
}
