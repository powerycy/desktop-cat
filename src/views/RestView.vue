<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { emit as emitEvent, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useGuardianStore } from '../stores/guardianStore'
import { useHealthStore } from '../stores/healthStore'
import { useLocaleStore } from '../stores/localeStore'
import { localizeGuardianForDisplay } from '../services/guardianLocalizationService'
import pandaGuardianUrl from '../assets/panda-guardian.png'
import type { ManifestEntry, SpriteManifest } from '../composables/useAnimation'
import {
  getRestCatStyle,
  getRestStartPosition,
  getRestTargetX,
  getRestWalkSpeed,
  moveRestCatTowardTarget,
  type RestMotionPhase,
} from '../utils/restMotion'
import { resolveRestEndReason, type RestEndPayload, type RestEndReason } from '../utils/restOutcome'

const route = useRoute()
const guardianStore = useGuardianStore()
const healthStore = useHealthStore()
const localeStore = useLocaleStore()
const totalDuration = ref(Number(route.query.duration) || 300)
const remaining = ref(totalDuration.value)
const forcedBreak = computed(() => route.query.forced === 'true')
const guardian = computed(() => localizeGuardianForDisplay(guardianStore.currentGuardian, localeStore.locale))
const restMessage = computed(() => forcedBreak.value ? guardian.value.messages.forceBreak : guardian.value.messages.takeBreak)

const phase = ref<RestMotionPhase>('walking')
const currentSrc = ref('')
const catX = ref(0)
const catY = ref(0)
const catStyle = computed(() => getRestCatStyle(phase.value, catX.value, catY.value, window.innerWidth, window.innerHeight))

const frames: Record<RestMotionPhase, string[]> = {
  walking: [],
  rest: [],
}

let frameIndex = 0
let frameTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let moveRaf: number | null = null
let unlisten: (() => void) | null = null
let restOutcomeRecorded = false

const PHASE_FPS: Record<RestMotionPhase, number> = {
  walking: 8,
  rest: 2,
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function recordRestOutcome(reason: RestEndReason) {
  if (restOutcomeRecorded) return
  restOutcomeRecorded = true
  if (reason === 'completed') {
    healthStore.recordBreakCompleted(Math.ceil(totalDuration.value / 60))
  } else {
    healthStore.recordBreakSkipped()
  }
}

function finishRest(reason: RestEndReason) {
  recordRestOutcome(reason)
  getCurrentWindow().close()
}

function completeRest() {
  if (restOutcomeRecorded) return
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  recordRestOutcome('completed')
  emitEvent('rest-end', { reason: 'completed' }).catch(() => {})
  getCurrentWindow().close()
}

async function sliceSheet(src: string, count: number): Promise<string[]> {
  const resp = await fetch(src)
  if (!resp.ok) throw new Error(`Failed to fetch sprite sheet: ${src}`)
  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const frameWidth = Math.round(img.naturalWidth / count)
        const result: string[] = []
        for (let i = 0; i < count; i++) {
          const canvas = document.createElement('canvas')
          canvas.width = frameWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas not available')
          ctx.drawImage(img, i * frameWidth, 0, frameWidth, img.naturalHeight, 0, 0, frameWidth, img.naturalHeight)
          result.push(canvas.toDataURL('image/png'))
        }
        URL.revokeObjectURL(objectUrl)
        resolve(result)
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

async function resolveEntry(entry: ManifestEntry | undefined, base: string): Promise<string[]> {
  if (!entry) return []
  if (Array.isArray(entry)) return entry.map(file => `${base}/${file}`)
  return sliceSheet(`${base}/${entry.sheet}`, entry.count)
}

async function loadRestSprites() {
  try {
    const config = await invoke<{ active_sprite_set: string }>('get_config')
    const dir = await invoke<string>('get_sprite_dir', { setName: config.active_sprite_set })
    const base = convertFileSrc(dir)

    let manifest: SpriteManifest = {}
    try {
      const resp = await fetch(convertFileSrc(`${dir}/manifest.json`))
      manifest = await resp.json() as SpriteManifest
    } catch {
      // Missing manifest falls through to empty frames and then fallback image.
    }

    frames.walking = await resolveEntry(manifest.walk, base)
    frames.rest = await resolveEntry(
      manifest.rest ?? manifest.sleep ?? manifest.sit ?? manifest.sit_idle ?? manifest.walk,
      base,
    )
  } catch (e) {
    console.error('Failed to load rest sprites:', e)
  }
}

function startFrames(nextPhase: RestMotionPhase) {
  if (frameTimer) clearInterval(frameTimer)
  frameIndex = 0
  const phaseFrames = frames[nextPhase]
  if (phaseFrames.length === 0) {
    currentSrc.value = pandaGuardianUrl
    return
  }

  currentSrc.value = phaseFrames[0]
  frameTimer = setInterval(() => {
    frameIndex = (frameIndex + 1) % phaseFrames.length
    currentSrc.value = phaseFrames[frameIndex]
  }, 1000 / PHASE_FPS[nextPhase])
}

function startWalking() {
  phase.value = 'walking'
  const start = getRestStartPosition(window.innerWidth, window.innerHeight)
  catX.value = start.x
  catY.value = start.y
  const targetX = getRestTargetX(window.innerWidth, window.innerHeight)
  const speed = getRestWalkSpeed(window.innerWidth, window.innerHeight)

  startFrames('walking')

  let last = 0
  function move(time: number) {
    const delta = last ? (time - last) / 1000 : 0
    last = time
    const next = moveRestCatTowardTarget(catX.value, targetX, speed, delta)
    catX.value = next.x

    if (next.reached) {
      startRest()
      return
    }
    moveRaf = requestAnimationFrame(move)
  }
  moveRaf = requestAnimationFrame(move)
}

function startRest() {
  if (moveRaf) {
    cancelAnimationFrame(moveRaf)
    moveRaf = null
  }
  phase.value = 'rest'
  startFrames('rest')
}

onMounted(async () => {
  guardianStore.loadFromStorage()
  healthStore.loadFromStorage()
  await loadRestSprites()

  startWalking()
  countdownTimer = setInterval(() => {
    if (remaining.value > 0) remaining.value--
    if (remaining.value <= 0) {
      completeRest()
    }
  }, 1000)

  unlisten = await listen<RestEndPayload>('rest-end', (event) => {
    finishRest(resolveRestEndReason(event.payload))
  })
})

onUnmounted(() => {
  recordRestOutcome(remaining.value <= 0 ? 'completed' : 'interrupted')
  if (frameTimer) clearInterval(frameTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  if (moveRaf) cancelAnimationFrame(moveRaf)
  unlisten?.()
})
</script>

<template>
  <div class="rest-overlay">
    <img
      class="rest-cat"
      :style="catStyle"
      :src="currentSrc || pandaGuardianUrl"
      alt=""
    />

    <div class="rest-hud">
      <div class="rest-text">{{ restMessage }}</div>
      <div class="rest-timer">{{ formatTime(remaining) }}</div>
    </div>
  </div>
</template>

<style scoped>
.rest-overlay {
  width: 100vw;
  height: 100vh;
  background: rgba(255, 200, 150, 0.12);
  position: relative;
  overflow: hidden;
  font-family: system-ui, sans-serif;
}

.rest-cat {
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  transition: none;
}

.rest-hud {
  position: fixed;
  top: clamp(22px, 4vw, 56px);
  right: clamp(22px, 4vw, 64px);
  text-align: right;
  max-width: min(560px, calc(100vw - 44px));
  z-index: 5;
}

.rest-text {
  max-width: 420px;
  margin-top: 10px;
  padding: 10px 14px;
  border: 1px solid rgba(218, 226, 224, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(32, 35, 42, 0.86);
  font-size: clamp(14px, 1.4vw, 18px);
  font-weight: 600;
  line-height: 1.45;
}

.rest-timer {
  color: rgba(24, 32, 42, 0.92);
  font-size: clamp(72px, 12vw, 150px);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  line-height: 1;
  text-shadow: none;
}

@media (max-width: 760px) {
  .rest-hud {
    top: 20px;
    right: 20px;
  }

  .rest-text {
    font-size: 14px;
  }

  .rest-timer {
    font-size: 34px;
  }
}
</style>
