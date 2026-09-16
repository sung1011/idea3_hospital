import { describe, expect, it } from 'vitest'
import { buildRoom, upgradeDual } from './build'
import { createHospital } from './createHospital'
import { actualThroughput } from './query'
import { assignDoctor } from './staff'

function dualRoom() {
  const h = createHospital()
  h.discharged = 120
  h.money = 5000
  buildRoom(h, 'treatment', [{ r: 2, c: 2 }])
  expect(upgradeDual(h, h.rooms[0].id).ok).toBe(true)
  return h
}

describe('dual station assign', () => {
  it('lets a second doctor raise throughput and rejects a third', () => {
    const h = dualRoom()
    const room = h.rooms[0]
    expect(assignDoctor(h, h.doctors[0].id, room.id).ok).toBe(true)
    const one = actualThroughput(h, room)
    expect(assignDoctor(h, h.doctors[1].id, room.id).ok).toBe(true)
    expect(actualThroughput(h, room)).toBe(one * 2)
    expect(assignDoctor(h, h.doctors[2].id, room.id)).toEqual({ ok: false, reason: '工位满了' })
    expect(room.doctorIds).toEqual([h.doctors[0].id, h.doctors[1].id])
  })

  it('is a no-op when the same doctor is already on that room', () => {
    const h = dualRoom()
    const room = h.rooms[0]
    expect(assignDoctor(h, h.doctors[0].id, room.id).ok).toBe(true)
    expect(assignDoctor(h, h.doctors[0].id, room.id).ok).toBe(true)
    expect(room.doctorIds).toEqual([h.doctors[0].id])
  })

  it('counts unique doctors so a duplicated id cannot double speed', () => {
    const h = dualRoom()
    const room = h.rooms[0]
    assignDoctor(h, h.doctors[0].id, room.id)
    const fair = actualThroughput(h, room)
    room.doctorIds.push(h.doctors[0].id)
    expect(actualThroughput(h, room)).toBe(fair)
  })
})
