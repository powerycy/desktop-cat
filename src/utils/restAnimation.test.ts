import { describe, expect, it } from 'vitest'
import type { SpriteManifest } from '../composables/useAnimation'
import { buildRestAnimationSequence } from './restAnimation'

describe('rest animation sequence', () => {
  it('plays walking once before looping rest frames', () => {
    const manifest: SpriteManifest = {
      walk: ['walk_01.png', 'walk_02.png'],
      rest: ['rest_01.png', 'rest_02.png'],
      sleep: ['sleep_01.png'],
    }

    expect(buildRestAnimationSequence(manifest)).toEqual([
      { action: 'walk', loop: false },
      { action: 'rest', loop: true },
    ])
  })
})
