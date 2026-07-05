import { ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'

export function useDrag() {
  const isDragging = ref(false)

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    getCurrentWindow().startDragging()
  }

  return { isDragging, onMouseDown }
}

// Pixel-level click-through via OffscreenCanvas alpha detection
export function useClickThrough(imgRef: () => HTMLImageElement | null) {
  let offscreen: OffscreenCanvas | null = null
  let ctx: OffscreenCanvasRenderingContext2D | null = null
  let lastIgnore = false
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function rebuildCanvas() {
    const img = imgRef()
    if (!img || !img.complete) return
    offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
    ctx = offscreen.getContext('2d')
    ctx?.drawImage(img, 0, 0)
  }

  function onMouseMove(e: MouseEvent) {
    if (!offscreen || !ctx) return

    if (debounceTimer) return
    debounceTimer = setTimeout(() => { debounceTimer = null }, 16)

    const img = imgRef()
    if (!img) return
    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const px = Math.floor((e.clientX - rect.left) * scaleX)
    const py = Math.floor((e.clientY - rect.top) * scaleY)

    try {
      const pixel = ctx.getImageData(px, py, 1, 1).data
      const alpha = pixel[3]
      // Only disable passthrough (make window interactive); never enable it,
      // because set_cursor_passthrough(true) dead-locks the window on Windows.
      if (alpha >= 15 && lastIgnore) {
        lastIgnore = false
        invoke('set_cursor_passthrough', { ignore: false })
      }
    } catch {
      // out of bounds
    }
  }

  return { rebuildCanvas, onMouseMove }
}
