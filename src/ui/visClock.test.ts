import { describe, expect, it } from 'vitest'
import { clockGate } from './visClock'

describe('clockGate', () => {
  it('pauses on pagehide so lastTick is saved before bfcache', () => {
    expect(clockGate('pagehide', false)).toBe('pause')
    expect(clockGate('pagehide', true)).toBe('pause')
  })

  it('starts the timer without a second catch-up after boot', () => {
    expect(clockGate('start', false)).toBe('run')
    expect(clockGate('start', true)).toBe('none')
  })

  it('resumes with catch-up when the page is shown again', () => {
    expect(clockGate('visibilitychange', true)).toBe('pause')
    expect(clockGate('visibilitychange', false)).toBe('resume')
    expect(clockGate('pageshow', false)).toBe('resume')
    expect(clockGate('pageshow', true)).toBe('pause')
  })
})
