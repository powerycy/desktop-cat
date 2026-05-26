import { ref, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'

export interface TimerTick {
  elapsed: number
  total: number
  is_resting: boolean
  rest_remaining: number
}

export function useTimer() {
  const elapsed = ref(0)
  const total = ref(45 * 60)
  const isResting = ref(false)
  const restRemaining = ref(0)
  const progress = ref(0) // 0-1

  let unlisten: (() => void) | null = null

  async function startListening() {
    unlisten = await listen<TimerTick>('timer-tick', (event) => {
      elapsed.value = event.payload.elapsed
      total.value = event.payload.total
      isResting.value = event.payload.is_resting
      restRemaining.value = event.payload.rest_remaining
      progress.value = event.payload.elapsed / event.payload.total
    })
  }

  startListening()

  onUnmounted(() => {
    unlisten?.()
  })

  return { elapsed, total, isResting, restRemaining, progress }
}
