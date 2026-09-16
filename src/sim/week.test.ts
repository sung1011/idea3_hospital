import { describe, expect, it } from 'vitest'
import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { leavePatient, makePatient, routePatient } from './flow'
import { settleOffline } from './offline'
import { doorTile, fieldCount, isUnlocked } from './query'
import { assignDoctor } from './staff'
import {
  INTERCEPT_FAME,
  INTERCEPT_POLLUTE,
  INTERCEPT_RAGE,
  MAX_FIELD,
  OFFER_DEADLINE_MS,
  RECIPE,
  SPECIAL_FAIL_FEE,
  SPECIAL_TRANSFER_FEE,
  WEEK_MS,
  WEEK_UNLOCK_AT,
} from './tables'
import { tick } from './tick'
import type { Hospital, RecipeId } from './types'
import {
  admitSpecial,
  backfillWeekOffer,
  canEnterSpecialist,
  chooseOffer,
  demoUnlockWeek,
  ensureWeek,
  findInterceptTarget,
  intercept,
  lastWeekPlace,
  pendingOffer,
  resolveSpecials,
  stepWeek,
  tickRivals,
} from './week'

function unlock(now = 0): Hospital {
  const h = createHospital()
  h.eventIn = 99999
  h.rollMode = 'always'
  demoUnlockWeek(h, now)
  return h
}

function isolateLine(h: Hospital) {
  h.discharged = Math.max(h.discharged, 100)
  h.money = 2000
  if (h.doctors.length < 5) {
    h.doctors.push({ id: 'doc-5', roomId: null, hireCost: 100 })
  }
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'ward', [{ r: 2, c: 2 }])
  buildRoom(h, 'specialist', [{ r: 1, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 0, c: 2 }])
  h.rooms.forEach((room, i) => assignDoctor(h, h.doctors[i].id, room.id))
}

function play(h: Hospital, n: number): Hospital {
  if (h.week) {
    h.week.nextSpawnAt = 1e15
    h.week.endsAt = 1e15
  }
  let cur = h
  for (let i = 0; i < n; i++) {
    cur = tick(cur)
    tickRivals(cur)
  }
  return cur
}

describe('week unlock', () => {
  it('opens week / specialist / intercept at 100 discharges', () => {
    const h = createHospital()
    h.discharged = 99
    expect(isUnlocked(h, 'week')).toBe(false)
    expect(isUnlocked(h, 'specialist')).toBe(false)
    expect(isUnlocked(h, 'intercept')).toBe(false)
    h.discharged = WEEK_UNLOCK_AT
    expect(isUnlocked(h, 'week')).toBe(true)
    expect(isUnlocked(h, 'specialist')).toBe(true)
    expect(isUnlocked(h, 'intercept')).toBe(true)
  })
})

describe('recipes', () => {
  it('lists three weekly recipes and continue needs a prior transfer', () => {
    expect(RECIPE.isolate.path).toEqual(['reception', 'diagnosis', 'ward', 'specialist', 'pharmacy'])
    expect(RECIPE.micro.path).toEqual(['reception', 'diagnosis', 'surgery', 'specialist', 'pharmacy'])
    expect(RECIPE.continue.path).toEqual(['reception', 'diagnosis', 'specialist', 'treatment', 'pharmacy'])
    expect(RECIPE.isolate.money).toBe(80)
    expect(RECIPE.isolate.score).toBe(10)
    expect(RECIPE.micro.score).toBe(14)
    expect(RECIPE.continue.score).toBe(12)

    const room = {
      id: 's',
      type: 'specialist' as const,
      tiles: [{ r: 1, c: 2 }],
      levelFlags: { queuePlus2: false, dualStation: false, compact: false },
      doctorIds: [],
      queue: [],
      pollution: 0,
      builtCost: 100,
      upgradeSpent: 0,
      progress: 0,
      recipeId: 'continue' as RecipeId,
    }
    const p = {
      isSpecial: true,
      recipeId: 'continue' as const,
      transferCount: 0,
    }
    expect(canEnterSpecialist(room, p as never)).toBe(false)
    p.transferCount = 1
    expect(canEnterSpecialist(room, p as never)).toBe(true)
    room.recipeId = 'isolate'
    expect(canEnterSpecialist(room, p as never)).toBe(false)
    delete (room as { recipeId?: RecipeId }).recipeId
    expect(canEnterSpecialist(room, p as never)).toBe(false)
  })
})

describe('offer choices', () => {
  it('accepts into the player line', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    expect(chooseOffer(h, 'accept').ok).toBe(true)
    expect(h.week?.pendingOfferId).toBeNull()
    const p = h.patients.find((x) => x.isSpecial)
    expect(p).toBeTruthy()
    expect(p?.path).toEqual(RECIPE.isolate.path)
    expect(p?.recipeId).toBe('isolate')
  })

  it('keeps the offer when accept is blocked by a full field', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    for (let i = 0; i < MAX_FIELD; i++) {
      const extra = makePatient(h, 'cold')
      extra.state = 'walk'
      h.patients.push(extra)
    }
    expect(chooseOffer(h, 'accept')).toEqual({ ok: false, reason: '场上已满，接不进来' })
    expect(h.week!.pendingOfferId).toBe(city.specialId)
    expect(h.patients.some((p) => p.isSpecial)).toBe(false)
  })

  it('transfer pays 10 and lets an NPC grab', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const money = h.money
    expect(chooseOffer(h, 'transfer').ok).toBe(true)
    expect(h.money).toBe(money + SPECIAL_TRANSFER_FEE)
    expect(h.patients.some((p) => p.isSpecial)).toBe(false)
    const grabbed = h.week?.rivals.some((r) => r.patients.some((p) => p.isSpecial))
    expect(grabbed).toBe(true)
  })

  it('recipe choice sets specialist and sends the patient away', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    expect(chooseOffer(h, 'recipe').ok).toBe(true)
    const spec = h.rooms.find((r) => r.type === 'specialist')
    expect(spec?.recipeId).toBe('isolate')
    expect(h.week?.pendingRecipeId).toBe('isolate')
    expect(h.patients.some((p) => p.isSpecial)).toBe(false)
  })
})

describe('transfer and week score', () => {
  it('cures an isolate special for money and week points', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    chooseOffer(h, 'accept')
    h.fame = 0
    h.patients = h.patients.filter((p) => p.isSpecial)
    for (const room of h.rooms) {
      room.queue = room.queue.filter((id) => h.patients.some((p) => p.id === id))
    }
    const money = h.money
    const next = play(h, 280)
    expect(next.week!.scores[0]).toBe(RECIPE.isolate.score)
    expect(next.money).toBe(money + RECIPE.isolate.money)
    expect(next.patients.some((p) => p.isSpecial && !p.weekSettled)).toBe(false)
  })

  it('leaves without a specialist and transfers to an NPC', () => {
    const h = unlock(0)
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    assignDoctor(h, h.doctors[0].id, h.rooms[0].id)
    stepWeek(h, 0)
    chooseOffer(h, 'accept')
    const p = h.patients.find((x) => x.isSpecial)!
    leavePatient(h, p)
    expect(h.money).toBeGreaterThanOrEqual(SPECIAL_FAIL_FEE)
    resolveSpecials(h)
    expect(h.week!.scores[0]).toBe(0)
    const onNpc = h.week!.rivals.some((r) => r.patients.some((x) => x.isSpecial && x.specialId === p.specialId))
    expect(onNpc).toBe(true)
    const city = h.week!.cityQueue.find((c) => c.specialId === p.specialId)
    expect(city?.transferCount).toBe(1)
    expect(city?.visitLog).toContain(h.id)
  })

  it('wipes the city after four failed transfers', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    chooseOffer(h, 'accept')
    const city = h.week!.cityQueue[0]
    city.transferCount = 3
    city.visitLog = [h.id, 'npc-isolate', 'npc-micro']
    const p = h.patients.find((x) => x.isSpecial)!
    const fame = h.fame
    leavePatient(h, p)
    resolveSpecials(h)
    expect(h.week!.cityQueue.find((c) => c.specialId === city.specialId)).toBeUndefined()
    expect(h.week!.pendingInfectMul).toBe(1.5)
    expect(h.fame).toBe(fame - 6 - 8)
  })
})

describe('intercept once', () => {
  it('steals a live special from an NPC and cannot fire twice', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    h.week!.pendingOfferId = null
    const npc = h.week!.rivals[0]
    admitSpecial(npc, city, h)
    expect(findInterceptTarget(h)?.rival.id).toBe(npc.id)
    const fame = h.fame
    expect(intercept(h).ok).toBe(true)
    expect(h.interceptUsed).toBe(true)
    expect(h.fame).toBe(fame - INTERCEPT_FAME)
    expect(h.patients.some((p) => p.isSpecial)).toBe(true)
    expect(npc.patients.some((p) => p.isSpecial)).toBe(false)
    expect(city.transferCount).toBe(0)
    expect(city.visitLog).toContain(h.id)
    expect(intercept(h)).toEqual({ ok: false, reason: '本周截诊已用' })
  })

  it('cannot intercept a special already walking out the door', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    h.week!.pendingOfferId = null
    const npc = h.week!.rivals[0]
    admitSpecial(npc, city, h)
    const p = npc.patients.find((x) => x.isSpecial)!
    p.toDoor = true
    p.state = 'walk'
    expect(findInterceptTarget(h)).toBeNull()
    expect(intercept(h)).toEqual({ ok: false, reason: '对手手里没有可截的特殊病人' })
  })

  it('places the stolen patient at the player door and applies dirt', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    h.week!.pendingOfferId = null
    const npc = h.week!.rivals[0]
    admitSpecial(npc, city, h)
    const stolen = npc.patients.find((x) => x.isSpecial)!
    stolen.x = 0
    stolen.y = 0
    stolen.rage = 10
    const doorAdj = h.rooms.find((r) => r.tiles.some((t) => t.r === 4 && t.c === 2))!
    doorAdj.pollution = 0
    const npcMoney = npc.money
    expect(intercept(h).ok).toBe(true)
    const p = h.patients.find((x) => x.isSpecial)!
    const door = doorTile()
    expect(p.x).toBe(door.c)
    expect(p.y).toBe(door.r)
    expect(p.rage).toBe(10 + INTERCEPT_RAGE)
    expect(doorAdj.pollution).toBe(INTERCEPT_POLLUTE)
    expect(npc.money).toBe(npcMoney + SPECIAL_FAIL_FEE)
  })

  it('cannot intercept when the field is already full', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    h.week!.pendingOfferId = null
    admitSpecial(h.week!.rivals[0], city, h)
    for (let i = 0; i < MAX_FIELD; i++) {
      const extra = makePatient(h, 'cold')
      extra.state = 'walk'
      h.patients.push(extra)
    }
    expect(fieldCount(h)).toBeGreaterThanOrEqual(MAX_FIELD)
    expect(intercept(h)).toEqual({ ok: false, reason: '场上已满，截不进来' })
    expect(h.interceptUsed).toBe(false)
    expect(h.week!.rivals[0].patients.some((p) => p.isSpecial)).toBe(true)
  })

  it('skips a city-logged special and takes the next stealable in the same hospital', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const first = h.week!.cityQueue[0]
    h.week!.pendingOfferId = null
    h.week!.nextSpawnAt = 0
    stepWeek(h, 1)
    const second = h.week!.cityQueue[1]
    expect(second).toBeTruthy()
    const npc = h.week!.rivals[0]
    admitSpecial(npc, first, h)
    admitSpecial(npc, second, h)
    first.visitLog.push(h.id)
    const blocked = npc.patients.find((p) => p.specialId === first.specialId)!
    blocked.visitLog = []
    blocked.state = 'treat'
    expect(findInterceptTarget(h)?.patient.specialId).toBe(second.specialId)
  })

  it('does not auto-intercept while offline', () => {
    const h = unlock(1_000_000)
    isolateLine(h)
    stepWeek(h, 1_000_000)
    const city = h.week!.cityQueue[0]
    h.week!.pendingOfferId = null
    admitSpecial(h.week!.rivals[0], city, h)
    h.lastTick = 1_000_000
    h.interceptUsed = false
    const result = settleOffline(h, 1_000_000 + 30_000)
    expect(result.hospital.interceptUsed).toBe(false)
  })
})

describe('week settlement', () => {
  it('pays rank rewards, rotates recipe and resets intercept', () => {
    const h = unlock(0)
    isolateLine(h)
    h.interceptUsed = true
    h.week!.scores = [20, 14, 10, 0]
    h.week!.endsAt = 100
    h.week!.nextSpawnAt = 1e15
    const money = h.money
    const fame = h.fame
    stepWeek(h, 100)
    expect(h.money).toBe(money + 150)
    expect(h.fame).toBe(fame + 8)
    expect(h.week!.recipeId).toBe('micro')
    expect(h.week!.weekId).toBe(2)
    expect(h.interceptUsed).toBe(false)
    expect(h.week!.scores).toEqual([0, 0, 0, 0])
    expect(h.rooms.find((r) => r.type === 'specialist')?.recipeId).toBe('micro')
    expect(lastWeekPlace(h)).toBe(1)
    expect(h.week!.lastResult?.[0]).toMatchObject({ id: 'player', score: 20, place: 1 })
  })

  it('offers back to the player instead of silently admitting after an NPC fail', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    expect(chooseOffer(h, 'transfer').ok).toBe(true)
    const city = h.week!.cityQueue[0]
    const npc = h.week!.rivals.find((r) => r.patients.some((p) => p.isSpecial))!
    const p = npc.patients.find((x) => x.isSpecial)!
    leavePatient(npc, p)
    resolveSpecials(h, 1)
    expect(h.patients.some((x) => x.isSpecial)).toBe(false)
    expect(h.week!.pendingOfferId).toBe(city.specialId)
    expect(pendingOffer(h)?.specialId).toBe(city.specialId)
    expect(city.currentHospitalId).toBeNull()
    expect(city.transferCount).toBe(1)
    expect(city.visitLog).not.toContain(h.id)
  })

  it('clears a stale pendingOfferId so the next city patient can be offered', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    h.week!.pendingOfferId = 'ghost'
    expect(pendingOffer(h)).toBeNull()
    expect(backfillWeekOffer(h, 1)).toBe(true)
    expect(h.week!.pendingOfferId).toBe(city.specialId)
  })

  it('does not carry leftover specials into the next week', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    chooseOffer(h, 'accept')
    expect(h.patients.some((p) => p.isSpecial)).toBe(true)
    h.week!.endsAt = 100
    h.week!.nextSpawnAt = 1e15
    stepWeek(h, 100)
    expect(h.week!.weekId).toBe(2)
    expect(h.patients.some((p) => p.isSpecial)).toBe(false)
    expect(h.week!.rivals.every((r) => !r.patients.some((p) => p.isSpecial))).toBe(true)
    expect(h.week!.cityQueue.every((c) => c.recipeId === 'micro' && c.transferCount === 0)).toBe(true)
  })

  it('times out an untouched offer as transfer', () => {
    const h = unlock(0)
    isolateLine(h)
    stepWeek(h, 0)
    const city = h.week!.cityQueue[0]
    const money = h.money
    stepWeek(h, OFFER_DEADLINE_MS + 1)
    expect(h.week!.pendingOfferId).not.toBe(city.specialId)
    expect(h.money).toBe(money + SPECIAL_TRANSFER_FEE)
  })

  it('does not pay rank rewards when every hospital scored 0', () => {
    const h = unlock(0)
    isolateLine(h)
    h.week!.scores = [0, 0, 0, 0]
    h.week!.endsAt = 100
    h.week!.nextSpawnAt = 1e15
    const money = h.money
    const fame = h.fame
    stepWeek(h, 100)
    expect(h.money).toBe(money)
    expect(h.fame).toBe(fame)
    expect(h.week!.weekId).toBe(2)
    expect(h.week!.recipeId).toBe('micro')
    expect(h.interceptUsed).toBe(false)
    expect(h.week!.lastResult?.every((row) => row.score === 0)).toBe(true)
    expect(lastWeekPlace(h)).toBeNull()
  })

  it('does not keep a previous place after a 0-score week', () => {
    const h = unlock(0)
    isolateLine(h)
    h.week!.lastResult = [
      { id: 'player', score: 20, place: 1 },
      { id: 'npc-isolate', score: 14, place: 2 },
      { id: 'npc-micro', score: 10, place: 3 },
      { id: 'npc-continue', score: 0, place: 4 },
    ]
    expect(lastWeekPlace(h)).toBe(1)
    h.week!.scores = [0, 0, 0, 0]
    h.week!.endsAt = 100
    h.week!.nextSpawnAt = 1e15
    stepWeek(h, 100)
    expect(h.week!.lastResult?.every((row) => row.score === 0)).toBe(true)
    expect(lastWeekPlace(h)).toBeNull()
  })

  it('only pays the first contested week when the clock jumps multiple weeks', () => {
    const h = unlock(0)
    isolateLine(h)
    h.interceptUsed = true
    h.week!.scores = [20, 14, 10, 0]
    h.week!.endsAt = 100
    h.week!.nextSpawnAt = 1e15
    const money = h.money
    const fame = h.fame
    stepWeek(h, 100 + WEEK_MS)
    expect(h.money).toBe(money + 150)
    expect(h.fame).toBe(fame + 8)
    expect(h.week!.weekId).toBe(3)
    expect(h.week!.recipeId).toBe('continue')
    expect(h.interceptUsed).toBe(false)
    expect(h.week!.lastResult?.every((row) => row.score === 0)).toBe(true)
    expect(lastWeekPlace(h)).toBeNull()
    expect(h.week!.endsAt).toBeGreaterThan(100 + WEEK_MS)
  })

  it('does not park a continue special in the hall when specialist is closed to them', () => {
    const h = unlock(0)
    isolateLine(h)
    h.discharged = 100
    buildRoom(h, 'waiting', [{ r: 4, c: 0 }])
    const spec = h.rooms.find((r) => r.type === 'specialist')!
    spec.recipeId = 'continue'
    const p = makePatient(h, 'special')
    p.isSpecial = true
    p.recipeId = 'continue'
    p.transferCount = 0
    p.path = [...RECIPE.continue.path]
    p.node = 2
    p.state = 'walk'
    p.x = 2
    p.y = 3
    h.patients.push(p)
    routePatient(h, p)
    expect(canEnterSpecialist(spec, p)).toBe(false)
    expect(p.toHall).toBe(false)
    expect(p.blocked).toBe(true)
  })
})

describe('lastWeekPlace', () => {
  it('hides a 0-score week and reads the player place when someone scored', () => {
    const h = unlock(0)
    expect(lastWeekPlace(h)).toBeNull()
    h.week!.lastResult = [
      { id: 'npc-isolate', score: 14, place: 1 },
      { id: 'player', score: 10, place: 2 },
      { id: 'npc-micro', score: 0, place: 3 },
      { id: 'npc-continue', score: 0, place: 4 },
    ]
    expect(lastWeekPlace(h)).toBe(2)
    h.week!.lastResult = [
      { id: 'player', score: 0, place: 1 },
      { id: 'npc-isolate', score: 0, place: 2 },
      { id: 'npc-micro', score: 0, place: 3 },
      { id: 'npc-continue', score: 0, place: 4 },
    ]
    expect(lastWeekPlace(h)).toBeNull()
  })
})

describe('ensureWeek', () => {
  it('does nothing before unlock', () => {
    const h = createHospital()
    ensureWeek(h, 0)
    expect(h.week).toBeNull()
  })
})
