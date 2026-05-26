<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { listen } from '@tauri-apps/api/event'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { SpriteManifest, ManifestEntry } from '../composables/useAnimation'

const route = useRoute()
const totalDuration = ref(Number(route.query.duration) || 300)
const remaining = ref(totalDuration.value)
const progress = computed(() => 1 - remaining.value / totalDuration.value)

// ── Phase state ──────────────────────────────────────────────────────────────
// 'sneak'   : cat enters from right edge, moves to center
// 'liedown' : one-shot lie-down animation at center
// 'rest'    : slow breathing loop, stays still
type Phase = 'sneak' | 'liedown' | 'rest'
const phase = ref<Phase>('sneak')

const CAT_SIZE = 1000  // px

// Cat position (only used during sneak phase for horizontal slide)
const catX = ref(0)
const catY = ref(0)
const facingLeft = ref(false)  // sprite naturally faces left; no flip during sneak

// Animation
const currentSrc = ref('')
let frames: Record<Phase, string[]> = { sneak: [], liedown: [], rest: [] }
let frameIndex = 0
let frameTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let moveRaf: number | null = null
let unlisten: (() => void) | null = null

// ── Sprite sheet slicer ──────────────────────────────────────────────────────
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
        const result: string[] = []
        for (let i = 0; i < count; i++) {
          const canvas = document.createElement('canvas')
          canvas.width = fw
          canvas.height = fh
          canvas.getContext('2d')!.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh)
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
  if (Array.isArray(entry)) return entry.map(f => `${base}/${f}`)
  return sliceSheet(`${base}/${entry.sheet}`, entry.count)
}

// ── Load sprites ─────────────────────────────────────────────────────────────
async function loadSprites() {
  try {
    const config = await invoke<{ active_sprite_set: string }>('get_config')
    const dir = await invoke<string>('get_sprite_dir', { setName: config.active_sprite_set })
    const base = convertFileSrc(dir)

    let manifest: SpriteManifest = {}
    try {
      const resp = await fetch(convertFileSrc(`${dir}/manifest.json`))
      manifest = await resp.json()
    } catch { /* no manifest, use empty */ }

    // Fallbacks: if rest-specific frames are absent, borrow from work-time frames
    // liedown is optional — if absent, startLiedown() will skip it
    const sneakEntry   = manifest.sneak   ?? manifest.walk
    const liedownEntry = manifest.liedown
    const restEntry    = manifest.rest    ?? manifest.sleep ?? manifest.walk

    frames.sneak   = await resolveEntry(sneakEntry,   base)
    frames.liedown = await resolveEntry(liedownEntry, base)
    frames.rest    = await resolveEntry(restEntry,    base)
  } catch (e) {
    console.error('Failed to load rest sprites:', e)
  }
}

// ── Frame animation ───────────────────────────────────────────────────────────
const PHASE_FPS: Record<Phase, number> = {
  sneak:   8,
  liedown: 4,   // ~250ms/frame for smooth one-shot
  rest:    2,   // ~500ms/frame, gentle breathing
}

function startFrames(p: Phase, onComplete?: () => void) {
  if (frameTimer) clearInterval(frameTimer)
  frameIndex = 0
  const fs = frames[p]
  if (fs.length === 0) {
    onComplete?.()
    return
  }
  currentSrc.value = fs[0]
  frameTimer = setInterval(() => {
    frameIndex++
    if (frameIndex >= fs.length) {
      if (onComplete) {
        clearInterval(frameTimer!)
        frameTimer = null
        onComplete()
        return
      }
      frameIndex = 0  // loop
    }
    currentSrc.value = fs[frameIndex]
  }, 1000 / PHASE_FPS[p])
}

// ── Phase 1: Sneak in from right ──────────────────────────────────────────────
function startSneak() {
  phase.value = 'sneak'
  facingLeft.value = false

  // Start just off-screen right
  catX.value = window.innerWidth + CAT_SIZE
  catY.value = window.innerHeight * 0.45 - CAT_SIZE / 2

  const targetX = window.innerWidth / 2 - CAT_SIZE / 2
  const speed = (window.innerWidth + CAT_SIZE) / 7  // cross screen in ~7s

  startFrames('sneak')

  let last = 0
  function move(time: number) {
    const delta = last ? (time - last) / 1000 : 0
    last = time
    catX.value -= speed * delta

    if (catX.value <= targetX) {
      catX.value = targetX
      startLiedown()
      return
    }
    moveRaf = requestAnimationFrame(move)
  }
  moveRaf = requestAnimationFrame(move)
}

// ── Phase 2: Lie down (one-shot), skip if no liedown frames ──────────────────
function startLiedown() {
  if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = null }
  phase.value = 'liedown'
  facingLeft.value = false
  if (frames.liedown.length === 0) {
    // No liedown animation, skip directly to rest
    startRest()
  } else {
    startFrames('liedown', startRest)  // one-shot: last frame done → startRest
  }
}

// ── Phase 3: Rest still ───────────────────────────────────────────────────────
function startRest() {
  phase.value = 'rest'
  startFrames('rest')
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadSprites()
  startSneak()

  countdownTimer = setInterval(() => {
    if (remaining.value > 0) remaining.value--
  }, 1000)

  unlisten = await listen('rest-end', () => {
    getCurrentWindow().close()
  })
})

onUnmounted(() => {
  if (frameTimer) clearInterval(frameTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  if (moveRaf) cancelAnimationFrame(moveRaf)
  unlisten?.()
})
</script>

<template>
  <div class="rest-overlay">
    <img
      v-if="currentSrc"
      class="rest-cat"
      :style="{
        width:     CAT_SIZE + 'px',
        height:    CAT_SIZE + 'px',
        transform: facingLeft ? 'scaleX(-1)' : 'none',
        // During liedown/rest, center horizontally via CSS instead of catX
        position:  phase !== 'sneak' ? 'fixed' : 'absolute',
        left:      phase !== 'sneak' ? '50%' : catX + 'px',
        top:       phase !== 'sneak' ? '45%' : catY + 'px',
        marginLeft: phase !== 'sneak' ? (-CAT_SIZE / 2) + 'px' : '0',
        marginTop:  phase !== 'sneak' ? (-CAT_SIZE / 2) + 'px' : '0',
      }"
      :src="currentSrc"
    />

    <div class="rest-hud">
      <div class="rest-text">喵~休息一下吧</div>
      <div class="rest-hint">Alt+F4 可强制退出</div>
      <div class="rest-timer">{{ formatTime(remaining) }}</div>
      <div class="rest-progress-bar">
        <div class="rest-progress-fill" :style="{ width: `${progress * 100}%` }" />
      </div>
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
}

.rest-cat {
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  transition: none;
}

/* During sneak phase cat is absolute; liedown/rest use fixed centering via inline style */

.rest-hud {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  background: rgba(255, 255, 255, 0.92);
  padding: 16px 32px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  min-width: 220px;
}

.rest-text {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.rest-hint {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.rest-timer {
  font-size: 36px;
  font-weight: 700;
  color: #ff6b6b;
  font-variant-numeric: tabular-nums;
}

.rest-progress-bar {
  width: 100%;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  margin-top: 10px;
  overflow: hidden;
}

.rest-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #ffd93d);
  border-radius: 3px;
  transition: width 1s linear;
}
</style>
