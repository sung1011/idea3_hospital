import { describe, expect, it } from 'vitest'
import { buildRoom, sellRoom, upgradeQueue } from './build'
import { createHospital } from './createHospital'
import { makePatient } from './flow'
import { occupied } from './query'
import { START_MONEY } from './tables'

describe('sell money and reroutes', () => {
  it('refunds half of build plus half of upgrade spend', () => {
    const h = createHospital()
    buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
    expect(upgradeQueue(h, h.rooms[0].id).ok).toBe(true)
    expect(h.money).toBe(START_MONEY - 40 - 50)
    expect(sellRoom(h, h.rooms[0].id).ok).toBe(true)
    expect(h.money).toBe(START_MONEY - 20 - 25)
    expect(h.rooms).toHaveLength(0)
  })

  it('sends queued patients to a hall when the other same-type room is full', () => {
    const h = createHospital()
    h.discharged = 15
    h.eventIn = 99999
    buildRoom(h, 'diagnosis', [{ r: 3, c: 1 }])
    buildRoom(h, 'diagnosis', [{ r: 3, c: 3 }])
    buildRoom(h, 'waiting', [{ r: 4, c: 0 }])
    const [a, b] = h.rooms.filter((r) => r.type === 'diagnosis')
    const hall = h.rooms.find((r) => r.type === 'waiting')!
    for (const room of [a, b]) {
      for (let i = 0; i < 4; i++) {
        const p = makePatient(h, 'cold')
        p.node = 1
        p.state = 'queue'
        p.inRoomId = room.id
        p.x = room.tiles[0].c
        p.y = room.tiles[0].r
        h.patients.push(p)
        room.queue.push(p.id)
      }
    }
    const left = h.leftCount
    expect(sellRoom(h, a.id).ok).toBe(true)
    expect(h.leftCount).toBe(left)
    const moved = h.patients.filter((p) => p.toHall || p.toRoomId === hall.id)
    expect(moved.length).toBe(4)
    expect(moved.every((p) => p.rage === 20)).toBe(true)
  })

  it('immediately reroutes a walker headed to the sold room', () => {
    const h = createHospital()
    buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
    const room = h.rooms[0]
    const p = makePatient(h, 'cold')
    p.node = 1
    p.state = 'walk'
    p.toRoomId = room.id
    p.x = 2
    p.y = 4
    p.walkToX = 2
    p.walkToY = 3
    p.walkRemain = 4
    h.patients.push(p)
    expect(sellRoom(h, room.id).ok).toBe(true)
    expect(p.toRoomId).not.toBe(room.id)
    expect(p.state).toBe('leave')
  })
})

describe('surgery two tiles', () => {
  it('sells both tiles and reroutes a treating patient', () => {
    const h = createHospital()
    h.discharged = 30
    expect(buildRoom(h, 'surgery', [{ r: 2, c: 1 }, { r: 2, c: 2 }]).ok).toBe(true)
    expect(occupied(h).size).toBe(2)
    const room = h.rooms[0]
    const p = makePatient(h, 'fracture')
    p.node = 2
    p.state = 'treat'
    p.inRoomId = room.id
    p.x = 1
    p.y = 2
    h.patients.push(p)
    room.queue.push(p.id)
    expect(sellRoom(h, room.id).ok).toBe(true)
    expect(occupied(h).size).toBe(0)
    expect(p.inRoomId).toBeNull()
    expect(p.state).toBe('leave')
  })

  it('sweeps a treating patient who is no longer in the queue', () => {
    const h = createHospital()
    h.discharged = 30
    buildRoom(h, 'surgery', [{ r: 2, c: 1 }, { r: 2, c: 2 }])
    const room = h.rooms[0]
    const p = makePatient(h, 'fracture')
    p.node = 2
    p.state = 'treat'
    p.inRoomId = room.id
    p.x = 2
    p.y = 2
    h.patients.push(p)
    expect(sellRoom(h, room.id).ok).toBe(true)
    expect(p.inRoomId).toBeNull()
    expect(p.state).toBe('leave')
    expect(p.rage).toBe(20)
  })
})

describe('build money', () => {
  it('blocks even a free reception when money is negative', () => {
    const h = createHospital()
    h.money = -1
    expect(buildRoom(h, 'reception', [{ r: 4, c: 2 }])).toEqual({ ok: false, reason: '没钱' })
  })
})
