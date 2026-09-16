import { describe, expect, it } from 'vitest'
import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { availableEvents, backfillEvent, chooseEvent } from './events'
import { makePatient } from './flow'
import { ticks } from './tick'
import { assignDoctor } from './staff'
import { MAX_FIELD } from './tables'
import type { Hospital } from './types'

function withReception(discharged = 0): Hospital {
  const h = createHospital()
  h.eventIn = 99999
  h.discharged = discharged
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  assignDoctor(h, h.doctors[0].id, h.rooms[0].id)
  return h
}

describe('availableEvents', () => {
  it('hides infectious and VIP cards until those diseases unlock', () => {
    const early = createHospital()
    expect(availableEvents(early)).toEqual(['inspect', 'vendor', 'raise', 'media'])

    early.discharged = 50
    expect(availableEvents(early)).toContain('infectAdmit')
    expect(availableEvents(early)).not.toContain('vipCut')

    early.discharged = 80
    expect(availableEvents(early)).toEqual(expect.arrayContaining(['infectAdmit', 'vipCut']))
  })
})

describe('event timing', () => {
  it('does not deal a card before a reception exists', () => {
    const h = createHospital()
    h.eventIn = 1
    const next = ticks(h, 40)
    expect(next.pendingEvent).toBeNull()
    expect(backfillEvent(next)).toBe(false)
    expect(next.pendingEvent).toBeNull()
  })
})

describe('event choices', () => {
  it('lets the VIP event enter even when the field is full', () => {
    const h = withReception(80)
    h.fame = 0
    for (let i = 0; i < MAX_FIELD; i++) {
      const p = makePatient(h, 'cold')
      p.state = 'queue'
      h.patients.push(p)
    }
    h.pendingEvent = 'vipCut'
    expect(chooseEvent(h, 'left').ok).toBe(true)
    expect(h.patients.filter((p) => p.disease === 'vip')).toHaveLength(1)
    expect(h.patients.length).toBe(MAX_FIELD + 1)
  })

  it('prefers a staffed room when a doctor is on duty', () => {
    const h = createHospital()
    h.eventIn = 99999
    h.rng = 1
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
    assignDoctor(h, h.doctors[0].id, h.rooms[1].id)
    h.pendingEvent = 'raise'
    expect(chooseEvent(h, 'right').ok).toBe(true)
    expect(h.buffs).toEqual([expect.objectContaining({ kind: 'roomVacant', roomId: h.rooms[1].id })])
  })

  it('does not park a raise vacant buff on the waiting hall', () => {
    const h = createHospital()
    h.discharged = 15
    h.eventIn = 99999
    buildRoom(h, 'waiting', [{ r: 4, c: 0 }])
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    h.pendingEvent = 'raise'
    expect(chooseEvent(h, 'right').ok).toBe(true)
    expect(h.buffs).toEqual([expect.objectContaining({ kind: 'roomVacant', roomId: h.rooms[1].id })])
  })
})
