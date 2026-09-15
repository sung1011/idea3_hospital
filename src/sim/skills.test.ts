import { describe, expect, it } from 'vitest'
import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { affectedTiles, skillOf, useSkill } from './skills'
import { SKILL_DEF } from './tables'
import { ticks } from './tick'
import type { Hospital, Tile } from './types'

function dirty(h: Hospital, tiles: Tile[], pollution = 80): Hospital {
  h.eventIn = 99999
  h.discharged = 50
  h.skills.forEach((s) => {
    s.unlocked = true
  })
  for (const tile of tiles) {
    const room = h.rooms.find((r) => r.tiles.some((t) => t.r === tile.r && t.c === tile.c))
    if (room) room.pollution = pollution
  }
  return h
}

function fourRooms(): Hospital {
  const h = createHospital()
  h.eventIn = 99999
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'treatment', [{ r: 2, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 1, c: 2 }])
  return dirty(h, [
    { r: 4, c: 2 },
    { r: 3, c: 2 },
    { r: 2, c: 2 },
    { r: 1, c: 2 },
  ])
}

function roomAt(h: Hospital, tile: Tile) {
  return h.rooms.find((r) => r.tiles.some((t) => t.r === tile.r && t.c === tile.c))
}

describe('createHospital skills', () => {
  it('starts with four locked skills and no cleaners', () => {
    const h = createHospital()
    expect(h).not.toHaveProperty('cleaners')
    expect(h.skills.map((s) => s.id)).toEqual(['disinfect', 'flush', 'spray', 'sustain'])
    expect(h.skills.every((s) => s.cdLeft === 0 && !s.unlocked)).toBe(true)
    expect(h.hots).toEqual([])
  })
})

describe('skill shapes', () => {
  it('disinfect drops one tile by 30 and floors at 0', () => {
    const h = fourRooms()
    const money = h.money
    roomAt(h, { r: 4, c: 2 })!.pollution = 10
    expect(useSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(0)
    expect(roomAt(h, { r: 3, c: 2 })!.pollution).toBe(80)
    expect(skillOf(h, 'disinfect')!.cdLeft).toBe(20)
    expect(h.money).toBe(money)
    expect(h.fame).toBe(50)
  })

  it('empty ground is a valid target but does nothing', () => {
    const h = fourRooms()
    const money = h.money
    expect(useSkill(h, 'disinfect', { r: 0, c: 0 }).ok).toBe(true)
    expect(h.rooms.every((r) => r.pollution === 80)).toBe(true)
    expect(skillOf(h, 'disinfect')!.cdLeft).toBe(20)
    expect(h.money).toBe(money)
  })

  it('flush follows direction for up to 5 tiles and discards out of bounds', () => {
    const h = fourRooms()
    expect(affectedTiles('flush', { r: 4, c: 2 }, { r: 3, c: 2 })).toEqual([
      { r: 4, c: 2 },
      { r: 3, c: 2 },
      { r: 2, c: 2 },
      { r: 1, c: 2 },
      { r: 0, c: 2 },
    ])
    expect(useSkill(h, 'flush', { r: 4, c: 2 }, { r: 3, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 3, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 2, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 1, c: 2 })!.pollution).toBe(65)
    expect(skillOf(h, 'flush')!.cdLeft).toBe(45)

    const edge = createHospital()
    edge.discharged = 30
    edge.skills = edge.skills.map((s) => ({ ...s, unlocked: s.id === 'flush' }))
    expect(affectedTiles('flush', { r: 0, c: 3 }, { r: 0, c: 4 })).toEqual([
      { r: 0, c: 3 },
      { r: 0, c: 4 },
    ])
    expect(useSkill(edge, 'flush', { r: 0, c: 4 }, { r: 1, c: 4 }).ok).toBe(true)
  })

  it('flush rejects a non-adjacent second tile', () => {
    const h = fourRooms()
    expect(useSkill(h, 'flush', { r: 4, c: 2 }, { r: 2, c: 2 }).ok).toBe(false)
    expect(skillOf(h, 'flush')!.cdLeft).toBe(0)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(80)
  })

  it('spray hits center and four neighbors, dropping room tiles by 20', () => {
    const h = fourRooms()
    expect(affectedTiles('spray', { r: 3, c: 2 })).toEqual([
      { r: 3, c: 2 },
      { r: 2, c: 2 },
      { r: 4, c: 2 },
      { r: 3, c: 1 },
      { r: 3, c: 3 },
    ])
    expect(useSkill(h, 'spray', { r: 3, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(60)
    expect(roomAt(h, { r: 3, c: 2 })!.pollution).toBe(60)
    expect(roomAt(h, { r: 2, c: 2 })!.pollution).toBe(60)
    expect(roomAt(h, { r: 1, c: 2 })!.pollution).toBe(80)
    expect(skillOf(h, 'spray')!.cdLeft).toBe(40)

    const corner = createHospital()
    corner.discharged = 50
    expect(affectedTiles('spray', { r: 0, c: 0 })).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: 1 },
    ])
  })
})

describe('skill cooldown and unlock', () => {
  it('blocks locked skills until discharge gates', () => {
    const h = createHospital()
    h.eventIn = 99999
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    h.rooms[0].pollution = 50
    expect(useSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(false)
    expect(useSkill(h, 'sustain', { r: 4, c: 2 }).ok).toBe(false)
    h.discharged = 15
    expect(useSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)
    expect(useSkill(h, 'flush', { r: 4, c: 2 }, { r: 3, c: 2 }).ok).toBe(false)
    h.discharged = 30
    skillOf(h, 'flush')!.cdLeft = 0
    expect(useSkill(h, 'flush', { r: 4, c: 2 }, { r: 3, c: 2 }).ok).toBe(true)
    expect(useSkill(h, 'spray', { r: 4, c: 2 }).ok).toBe(false)
    h.discharged = 50
    expect(useSkill(h, 'spray', { r: 4, c: 2 }).ok).toBe(true)
  })

  it('advances CD on tick and unlocks after enough discharges', () => {
    const h = fourRooms()
    expect(useSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)
    expect(useSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(false)
    const after = ticks(h, SKILL_DEF.disinfect.cdS)
    expect(skillOf(after, 'disinfect')!.cdLeft).toBe(0)
    expect(useSkill(after, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)

    const locked = createHospital()
    locked.eventIn = 99999
    locked.discharged = 14
    const opened = ticks(locked, 1)
    opened.discharged = 15
    const ready = ticks(opened, 1)
    expect(skillOf(ready, 'disinfect')!.unlocked).toBe(true)
    expect(skillOf(ready, 'sustain')!.unlocked).toBe(true)
    expect(skillOf(ready, 'flush')!.unlocked).toBe(false)
  })
})

describe('sustain HoT', () => {
  it('ticks every 2s for 10s and does not apply immediately', () => {
    const h = fourRooms()
    expect(useSkill(h, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(80)
    expect(h.hots).toHaveLength(1)
    expect(skillOf(h, 'sustain')!.cdLeft).toBe(30)

    const t1 = ticks(h, 1)
    expect(roomAt(t1, { r: 4, c: 2 })!.pollution).toBe(80)
    const t2 = ticks(h, 2)
    expect(roomAt(t2, { r: 4, c: 2 })!.pollution).toBe(72)
    const t10 = ticks(h, 10)
    expect(roomAt(t10, { r: 4, c: 2 })!.pollution).toBe(40)
    expect(t10.hots).toHaveLength(0)
  })

  it('refreshes duration on the same tile and does not stack', () => {
    const h = fourRooms()
    expect(useSkill(h, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    const mid = ticks(h, 4)
    expect(roomAt(mid, { r: 4, c: 2 })!.pollution).toBe(64)
    expect(mid.hots).toHaveLength(1)
    expect(mid.hots[0].remainS).toBe(6)
    skillOf(mid, 'sustain')!.cdLeft = 0
    expect(useSkill(mid, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    expect(mid.hots).toHaveLength(1)
    expect(mid.hots[0].remainS).toBe(10)
    const done = ticks(mid, 10)
    expect(roomAt(done, { r: 4, c: 2 })!.pollution).toBe(24)
    expect(done.hots).toHaveLength(0)
  })
})
