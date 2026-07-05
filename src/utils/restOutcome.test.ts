import { describe, expect, it } from 'vitest'
import { resolveRestEndReason } from './restOutcome'

describe('rest end outcome', () => {
  it('only treats explicit completed payloads as completed rests', () => {
    expect(resolveRestEndReason({ reason: 'completed' })).toBe('completed')
  })

  it('treats manual endings and legacy empty payloads as interrupted rests', () => {
    expect(resolveRestEndReason({ reason: 'interrupted' })).toBe('interrupted')
    expect(resolveRestEndReason({})).toBe('interrupted')
    expect(resolveRestEndReason(undefined)).toBe('interrupted')
  })
})
