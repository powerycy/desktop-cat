export type RestEndReason = 'completed' | 'interrupted'

export interface RestEndPayload {
  reason?: string
}

export function resolveRestEndReason(payload: RestEndPayload | null | undefined): RestEndReason {
  return payload?.reason === 'completed' ? 'completed' : 'interrupted'
}
