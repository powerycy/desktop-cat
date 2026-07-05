<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { emit as emitEvent, listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { usePetStore } from '../stores/petStore'
import { useGuardianStore } from '../stores/guardianStore'
import { useHealthStore } from '../stores/healthStore'
import { useLocaleStore } from '../stores/localeStore'
import { localizeGuardianForDisplay } from '../services/guardianLocalizationService'
import pandaGuardianUrl from '../assets/panda-guardian.png'
import { useAnimation } from '../composables/useAnimation'
import { useDrag, useClickThrough } from '../composables/useDrag'
import type { SpriteManifest } from '../composables/useAnimation'
import { getPetSpriteClasses } from '../utils/petSpriteStyle'

const petStore = usePetStore()
const guardianStore = useGuardianStore()
const healthStore = useHealthStore()
const localeStore = useLocaleStore()
const { currentState } = storeToRefs(petStore)
const guardian = computed(() => localizeGuardianForDisplay(guardianStore.currentGuardian, localeStore.locale))

const imgRef = ref<HTMLImageElement | null>(null)
const spriteBase = ref('')
const manifest = ref<SpriteManifest | null>(null)
const activeSpriteSet = ref('')

const { currentSrc } = useAnimation(
  currentState,
  spriteBase,
  manifest,
  (completedState) => {
    // sitting is a one-shot: when its last frame plays, advance to sit_idle
    if (completedState === 'sitting' && !petStore.isResting) enterSitIdle()
  },
)

const { onMouseDown } = useDrag()
const { rebuildCanvas, onMouseMove } = useClickThrough(() => imgRef.value)

// Load sprite set
async function loadSprites() {
  try {
    const config = await invoke<{ active_sprite_set: string; pet_scale: number }>('get_config')
    const dir = await invoke<string>('get_sprite_dir', { setName: config.active_sprite_set })
    const base = convertFileSrc(dir)
    activeSpriteSet.value = config.active_sprite_set

    // Apply window size from pet_scale (base size 150px)
    const size = Math.round(150 * (config.pet_scale ?? 1.0))
    await getCurrentWindow().setSize(new LogicalSize(size, size))
    petStore.petWindowSize = size

    // Load manifest first, before updating any reactive refs
    let newManifest: SpriteManifest
    try {
      const resp = await fetch(convertFileSrc(`${dir}/manifest.json`))
      newManifest = await resp.json()
    } catch {
      newManifest = {
        idle:     ['idle_01.png', 'idle_02.png', 'idle_03.png', 'idle_04.png'],
        walk:     ['walk_01.png', 'walk_02.png', 'walk_03.png', 'walk_04.png'],
        sleep:    ['sleep_01.png', 'sleep_02.png'],
        interact: ['idle_01.png', 'idle_02.png'],
      }
    }

    // Update both synchronously so the watcher fires only once with consistent values
    manifest.value = newManifest
    spriteBase.value = base
  } catch (e) {
    console.error('Failed to load sprites:', e)
  }
}

// State machine loop
let stateTimer: ReturnType<typeof setTimeout> | null = null
let rafId: number | null = null
let lastTime = 0

async function handleFocusComplete(payload: { focus_minutes?: number; focusMinutes?: number }) {
  guardianStore.loadFromStorage()
  healthStore.loadFromStorage()
  const focusMinutes = payload.focus_minutes ?? payload.focusMinutes ?? guardian.value.breakPlan.focusMinutes
  healthStore.recordFocusSession(focusMinutes)
  await emitEvent('force-rest', { forced: false })
}

const DURATIONS = {
  sit_idle: { min: 5000,  max: 15000 },
  sleeping: { min: 8000,  max: 20000 },
  walking:  { min: 5000,  max: 12000 },
}

function randMs(key: keyof typeof DURATIONS): number {
  const { min, max } = DURATIONS[key]
  return Math.floor(Math.random() * (max - min) + min)
}

// sitting (one-shot): just set state; enterSitIdle is called by onCycleComplete
// If manifest has no 'sit' animation, skip directly to sit_idle
function enterSitting() {
  if (petStore.isResting) return
  if (stateTimer) clearTimeout(stateTimer)
  if (manifest.value?.sit) {
    petStore.setState('sitting')
  } else {
    enterSitIdle()
  }
}

// sit_idle loop, then randomly: walk (10%) / sleep (40%) / re-loop (50%)
function enterSitIdle() {
  if (petStore.isResting) return
  if (stateTimer) clearTimeout(stateTimer)
  petStore.setState('sit_idle')
  stateTimer = setTimeout(() => {
    if (petStore.isResting) return
    const r = Math.random()
    if (r < 0.10)      enterWalking()
    else if (r < 0.50) enterSleeping()
    else               enterSitIdle()
  }, randMs('sit_idle'))
}

// sleeping loop → back to sit_idle (already on ground, skip sitting transition)
function enterSleeping() {
  if (petStore.isResting) return
  if (stateTimer) clearTimeout(stateTimer)
  petStore.setState('sleeping')
  stateTimer = setTimeout(() => {
    if (!petStore.isResting) enterSitIdle()
  }, randMs('sleeping'))
}

// walking; safety timeout in case target is never reached
function enterWalking() {
  if (petStore.isResting) return
  if (stateTimer) clearTimeout(stateTimer)
  petStore.setState('walking')
  stateTimer = setTimeout(() => {
    if (currentState.value === 'walking' && !petStore.isResting) enterSitting()
  }, randMs('walking'))
}

function animLoop(time: number) {
  const delta = lastTime ? time - lastTime : 0
  lastTime = time

  if (currentState.value === 'walking') {
    const reached = petStore.updatePosition(delta)
    if (reached) enterSitting()  // stop walking → sit transition
    const scale = window.devicePixelRatio || 1
    invoke('set_pet_position', {
      x: Math.round(petStore.position.x * scale),
      y: Math.round(petStore.position.y * scale),
    }).catch(() => {})
  }

  rafId = requestAnimationFrame(animLoop)
}

let unlisten: (() => void) | null = null
let safetyTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  // Sync store position with actual window position at startup
  try {
    const pos = await getCurrentWindow().outerPosition()
    const scale = window.devicePixelRatio || 1
    petStore.position.x = pos.x / scale
    petStore.position.y = pos.y / scale
  } catch { /* ignore */ }

  await loadSprites()
  enterSitting()  // always start with sit transition
  rafId = requestAnimationFrame(animLoop)

  const unlistenConfig = await listen('config-changed', () => {
    loadSprites()
  })

  const unlistenFocusComplete = await listen('focus-complete', (event: any) => {
    handleFocusComplete(event.payload ?? {}).catch((error) => {
      console.error('Failed to handle focus completion:', error)
    })
  })

  unlisten = await listen('rest-start', (event: any) => {
    petStore.isResting = true
    if (stateTimer) clearTimeout(stateTimer)
    getCurrentWindow().hide()
    // Safety: force show after rest duration + 3s buffer, in case rest-end is missed
    const duration = (event.payload?.duration ?? 300) as number
    if (safetyTimer) clearTimeout(safetyTimer)
    safetyTimer = setTimeout(() => getCurrentWindow().show(), (duration + 3) * 1000)
  })

  const unlistenEnd = await listen('rest-end', () => {
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null }
    petStore.isResting = false
    enterSitting()  // resume with sit transition after rest
    getCurrentWindow().show()
  })

  const unlistenMove = await listen<{ x: number; y: number }>('tauri://move', (event) => {
    // Sync window position into store whenever the window moves via drag.
    // Skip during walking — animLoop already owns position updates then.
    if (currentState.value !== 'walking') {
      const scale = window.devicePixelRatio || 1
      petStore.position.x = event.payload.x / scale
      petStore.position.y = event.payload.y / scale
    }
  })

  // Store unlisten refs
  const orig = unlisten
  unlisten = () => { orig(); unlistenEnd(); unlistenConfig(); unlistenFocusComplete(); unlistenMove() }
})

onUnmounted(() => {
  if (stateTimer) clearTimeout(stateTimer)
  if (safetyTimer) clearTimeout(safetyTimer)
  if (rafId) cancelAnimationFrame(rafId)
  unlisten?.()
})

watch(() => petStore.currentState, () => {
  // Rebuild canvas when frame changes
  setTimeout(rebuildCanvas, 50)
})

function onImgLoad() {
  rebuildCanvas()
}

function handleMouseDown(e: MouseEvent) {
  // Interrupt walking so animLoop stops overriding window position during drag
  if (e.button === 0 && currentState.value === 'walking') enterSitting()
  onMouseDown(e)
}

function onPetClick() {
  if (!petStore.isResting) {
    petStore.setInteracting()
    setTimeout(() => { if (!petStore.isResting) enterSitIdle() }, 2000)
  }
}
</script>

<template>
  <div
    class="pet-container"
    data-tauri-drag-region
    @mousemove="onMouseMove"
    @mousedown="handleMouseDown"
    @click="onPetClick"
  >
    <img
      v-if="currentSrc"
      ref="imgRef"
      :src="currentSrc"
      :class="getPetSpriteClasses(activeSpriteSet, currentState, petStore.facingRight)"
      draggable="false"
      @load="onImgLoad"
    />
    <img
      v-else
      ref="imgRef"
      :src="pandaGuardianUrl"
      class="pet-sprite fallback-pet"
      draggable="false"
      @load="onImgLoad"
    />
  </div>
</template>

<style scoped>
.pet-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: transparent;
  cursor: pointer;
  user-select: none;
}

.pet-sprite {
  --sprite-facing: 1;
  --sprite-scale: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  transform: scaleX(var(--sprite-facing)) scale(var(--sprite-scale));
  transform-origin: center center;
}

.pet-sprite.flip {
  --sprite-facing: -1;
}

.pet-sprite.grumpy-desktop {
  --sprite-scale: 0.72;
}

.fallback-pet {
  image-rendering: auto;
  border-radius: 18px;
}

</style>
