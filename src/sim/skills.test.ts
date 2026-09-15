import { describe, expect, it } from 'vitest'
import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { aoeTiles, canCast, castSkill, getSkill, lineTiles, SKILL_DEF, SKILL_IDS } from './skills'
import { ticks } from './tick'
import type { Hospital, Tile } from './types'

function dirty(pollution = 80, discharged = 50): Hospital {
  const h = createHospital()
  h.eventIn = 99999
  h.discharged = discharged
  h.rooms = []
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'treatment', [{ r: 2, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 1, c: 2 }])
  buildRoom(h, 'ward', [{ r: 0, c: 2 }])
  for (const room of h.rooms) room.pollution = pollution
  return h
}

function roomAt(h: Hospital, tile: Tile) {
  return h.rooms.find((room) => room.tiles.some((t) => t.r === tile.r && t.c === tile.c))
}

describe('skill table', () => {
  it('lists four shapes with documented numbers', () => {
    expect(SKILL_IDS).toEqual(['disinfect', 'flush', 'spray', 'sustain'])
    expect(SKILL_DEF.disinfect).toMatchObject({ shape: 'point', amount: 30, cdS: 20, unlockAt: 15 })
    expect(SKILL_DEF.flush).toMatchObject({ shape: 'line', amount: 15, cdS: 45, unlockAt: 30, length: 5 })
    expect(SKILL_DEF.spray).toMatchObject({ shape: 'aoe', amount: 20, cdS: 40, unlockAt: 50 })
    expect(SKILL_DEF.sustain).toMatchObject({ shape: 'hot', amount: 8, cdS: 30, unlockAt: 15, durationS: 10, everyS: 2 })
  })
})

describe('unlock gating', () => {
  it('locks skills until the discharge thresholds', () => {
    const h = dirty(80, 0)
    expect(canCast(h, 'disinfect').ok).toBe(false)
    expect(canCast(h, 'sustain').ok).toBe(false)
    expect(canCast(h, 'flush').ok).toBe(false)
    expect(canCast(h, 'spray').ok).toBe(false)

    h.discharged = 15
    expect(canCast(h, 'disinfect').ok).toBe(true)
    expect(canCast(h, 'sustain').ok).toBe(true)
    expect(canCast(h, 'flush').ok).toBe(false)
    expect(canCast(h, 'spray').ok).toBe(false)

    h.discharged = 30
    expect(canCast(h, 'flush').ok).toBe(true)
    expect(canCast(h, 'spray').ok).toBe(false)

    h.discharged = 50
    expect(canCast(h, 'spray').ok).toBe(true)
  })
})

describe('shapes', () => {
  it('disinfect drops one room by 30 and floors at 0', () => {
    const h = dirty(20, 15)
    expect(castSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(0)
    expect(roomAt(h, { r: 3, c: 2 })!.pollution).toBe(20)
  })

  it('flush walks a line of up to 5 tiles and skips empty ground', () => {
    const h = dirty(80, 30)
    expect(castSkill(h, 'flush', { r: 4, c: 2 }, { r: 3, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 3, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 2, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 1, c: 2 })!.pollution).toBe(65)
    expect(roomAt(h, { r: 0, c: 2 })!.pollution).toBe(65)

    const short = dirty(80, 30)
    expect(castSkill(short, 'flush', { r: 4, c: 0 }, { r: 4, c: 1 }).ok).toBe(true)
    expect(lineTiles({ r: 4, c: 0 }, { r: 4, c: 1 })).toEqual([
      { r: 4, c: 0 },
      { r: 4, c: 1 },
      { r: 4, c: 2 },
      { r: 4, c: 3 },
      { r: 4, c: 4 },
    ])
    expect(roomAt(short, { r: 4, c: 2 })!.pollution).toBe(65)
    expect(roomAt(short, { r: 3, c: 2 })!.pollution).toBe(80)
  })

  it('discards line and aoe tiles that leave the 5x5', () => {
    expect(lineTiles({ r: 0, c: 2 }, { r: -1, c: 2 })).toEqual([{ r: 0, c: 2 }])
    expect(aoeTiles({ r: 0, c: 0 })).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: 1 },
    ])
  })

  it('spray hits center plus four neighbors, only rooms lose pollution', () => {
    const h = dirty(80, 50)
    expect(castSkill(h, 'spray', { r: 3, c: 2 }).ok).toBe(true)
    expect(roomAt(h, { r: 3, c: 2 })!.pollution).toBe(60)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(60)
    expect(roomAt(h, { r: 2, c: 2 })!.pollution).toBe(60)
    expect(roomAt(h, { r: 1, c: 2 })!.pollution).toBe(80)
  })

  it('empty ground is a valid target but changes nothing', () => {
    const h = dirty(80, 15)
    const money = h.money
    const fame = h.fame
    expect(castSkill(h, 'disinfect', { r: 4, c: 0 }).ok).toBe(true)
    expect(h.rooms.every((room) => room.pollution === 80)).toBe(true)
    expect(h.money).toBe(money)
    expect(h.fame).toBe(fame)
    expect(getSkill(h, 'disinfect')!.cdLeft).toBe(20)
  })

  it('rejects a flush without an adjacent direction tile', () => {
    const h = dirty(80, 30)
    expect(castSkill(h, 'flush', { r: 4, c: 2 }).ok).toBe(false)
    expect(castSkill(h, 'flush', { r: 4, c: 2 }, { r: 2, c: 2 }).ok).toBe(false)
    expect(getSkill(h, 'flush')!.cdLeft).toBe(0)
  })
})

describe('cooldown', () => {
  it('starts CD on cast and only unlocks after tick seconds', () => {
    const h = dirty(80, 15)
    expect(castSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)
    expect(getSkill(h, 'disinfect')!.cdLeft).toBe(20)
    expect(canCast(h, 'disinfect').ok).toBe(false)

    const mid = ticks(h, 19)
    expect(getSkill(mid, 'disinfect')!.cdLeft).toBe(1)
    expect(canCast(mid, 'disinfect').ok).toBe(false)

    const ready = ticks(mid, 1)
    expect(getSkill(ready, 'disinfect')!.cdLeft).toBe(0)
    expect(canCast(ready, 'disinfect').ok).toBe(true)
  })

  it('does not spend money or fame', () => {
    const h = dirty(80, 50)
    h.money = -10
    const fame = h.fame
    expect(castSkill(h, 'spray', { r: 2, c: 2 }).ok).toBe(true)
    expect(h.money).toBe(-10)
    expect(h.fame).toBe(fame)
  })
})

describe('sustain HoT', () => {
  it('ticks -8 every 2s for 10s then stops', () => {
    const h = dirty(80, 15)
    expect(castSkill(h, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    expect(h.hots).toHaveLength(1)
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(80)

    const after1 = ticks(h, 1)
    expect(roomAt(after1, { r: 4, c: 2 })!.pollution).toBe(80)

    const after2 = ticks(h, 2)
    expect(roomAt(after2, { r: 4, c: 2 })!.pollution).toBe(72)

    const after10 = ticks(h, 10)
    expect(roomAt(after10, { r: 4, c: 2 })!.pollution).toBe(40)
    expect(after10.hots).toHaveLength(0)

    const after12 = ticks(h, 12)
    expect(roomAt(after12, { r: 4, c: 2 })!.pollution).toBe(40)
  })

  it('does not auto-clean without skills', () => {
    const h = createHospital()
    h.eventIn = 99999
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    h.rooms[0].pollution = 20
    const next = ticks(h, 20)
    expect(next.rooms[0].pollution).toBe(20)
  })

  it('refreshes duration on the same tile and does not stack', () => {
    const h = dirty(80, 15)
    castSkill(h, 'sustain', { r: 4, c: 2 })
    const mid = ticks(h, 4)
    expect(roomAt(mid, { r: 4, c: 2 })!.pollution).toBe(64)
    expect(mid.hots).toHaveLength(1)
    expect(mid.hots[0].remainS).toBe(6)

    getSkill(mid, 'sustain')!.cdLeft = 0
    expect(castSkill(mid, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    expect(mid.hots).toHaveLength(1)
    expect(mid.hots[0].remainS).toBe(10)
    expect(mid.hots[0].accS).toBe(0)
    expect(roomAt(mid, { r: 4, c: 2 })!.pollution).toBe(64)

    const after2 = ticks(mid, 2)
    expect(roomAt(after2, { r: 4, c: 2 })!.pollution).toBe(56)
    expect(after2.hots).toHaveLength(1)
  })

  it('can sit on a tile that already has another skill effect', () => {
    const h = dirty(80, 15)
    castSkill(h, 'disinfect', { r: 4, c: 2 })
    expect(roomAt(h, { r: 4, c: 2 })!.pollution).toBe(50)
    expect(castSkill(h, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    const after2 = ticks(h, 2)
    expect(roomAt(after2, { r: 4, c: 2 })!.pollution).toBe(42)
  })
})

describe('no janitor leftover', () => {
  it('hospital has skills instead of cleaners', () => {
    const h = createHospital()
    expect(h).not.toHaveProperty('cleaners')
    expect(h.skills.map((s) => s.id)).toEqual(SKILL_IDS)
    expect(h.hots).toEqual([])
  })
})
