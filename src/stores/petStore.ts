import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PetState = 'idle' | 'walking' | 'sitting' | 'sit_idle' | 'sleeping' | 'interacting'

interface StateConfig {
  weight: number
  minDuration: number
  maxDuration: number
}

// States that can be randomly picked by the scheduler
const RANDOM_STATES: Partial<Record<PetState, StateConfig>> = {
  walking:  { weight: 10, minDuration: 4000,  maxDuration: 10000 },
  sit_idle: { weight: 50, minDuration: 6000,  maxDuration: 18000 },
  sleeping: { weight: 40, minDuration: 10000, maxDuration: 25000 },
}

// Duration for non-random states driven by code
const STATE_DURATION: Partial<Record<PetState, StateConfig>> = {
  interacting: { weight: 0, minDuration: 1000, maxDuration: 3000 },
}

export const usePetStore = defineStore('pet', () => {
  const currentState = ref<PetState>('idle')
  const currentFrame = ref(0)
  const position = ref({ x: 100, y: 100 })
  const targetPosition = ref({ x: 100, y: 100 })
  const facingRight = ref(true)
  const isResting = ref(false)
  // Actual window size in logical pixels; set by PetView after applying pet_scale
  const petWindowSize = ref(150)

  function pickNextState(): PetState {
    const entries = Object.entries(RANDOM_STATES) as [PetState, StateConfig][]
    const total = entries.reduce((sum, [, c]) => sum + c.weight, 0)
    let rand = Math.random() * total
    for (const [state, config] of entries) {
      rand -= config.weight
      if (rand <= 0) return state
    }
    return 'idle'
  }

  function randomDuration(state: PetState): number {
    const cfg = RANDOM_STATES[state] ?? STATE_DURATION[state]
    if (!cfg) return 3000
    return Math.floor(Math.random() * (cfg.maxDuration - cfg.minDuration) + cfg.minDuration)
  }

  function randomScreenTarget(): { x: number; y: number } {
    const scale = window.devicePixelRatio || 1
    // Use logical pixel dimensions to match window position coordinate space
    const screenW = window.screen.availWidth / scale
    const screenH = window.screen.availHeight / scale
    const petSize = petWindowSize.value
    const margin = 20
    const x = margin + Math.random() * Math.max(0, screenW - petSize - margin * 2)
    const y = margin + Math.random() * Math.max(0, screenH - petSize - margin * 2)
    return { x, y }
  }

  function startWalking() {
    const target = randomScreenTarget()
    targetPosition.value = target
    facingRight.value = target.x > position.value.x
  }

  function setState(state: PetState) {
    currentState.value = state
    currentFrame.value = 0
    if (state === 'walking') startWalking()
  }

  function setInteracting() {
    setState('interacting')
  }

  function updatePosition(delta: number) {
    if (currentState.value !== 'walking') return false
    const speed = 80
    const dx = targetPosition.value.x - position.value.x
    const dy = targetPosition.value.y - position.value.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 5) return true
    const move = speed * (delta / 1000)
    position.value = {
      x: position.value.x + (dx / dist) * move,
      y: position.value.y + (dy / dist) * move,
    }
    return false
  }

  return {
    currentState,
    currentFrame,
    position,
    targetPosition,
    facingRight,
    isResting,
    petWindowSize,
    setState,
    setInteracting,
    pickNextState,
    randomDuration,
    updatePosition,
    startWalking,
  }
})
