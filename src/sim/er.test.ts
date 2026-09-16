import { describe, expect, it } from 'vitest'
import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { applyErPath, applySpecialErPath, setErOpen, shouldMarkEr, skippedDiagnosis, toggleEr } from './er'
import { arrivePatient, makePatient, rewriteInfectious, routePatient, spawnPatient, treatChance } from './flow'
import { isUnlocked } from './query'
import { assignDoctor } from './staff'
import { ER_CLOSE_REFUND, ER_DOOR, ER_OPEN_COST, ER_SUCCESS_MUL, START_MONEY, SUCCESS } from './tables'
import type { Hospital } from './types'

function line(h = createHospital()): Hospital {
  h.rollMode = 'always'
  h.eventIn = 99999
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'treatment', [{ r: 2, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 1, c: 2 }])
  h.rooms.forEach((room, i) => assignDoctor(h, h.doctors[i].id, room.id))
  return h
}

describe('er unlock and money', () => {
  it('unlocks at 80 discharges', () => {
    const h = createHospital()
    expect(isUnlocked(h, 'er')).toBe(false)
    expect(setErOpen(h, true).ok).toBe(false)
    h.discharged = 79
    expect(isUnlocked(h, 'er')).toBe(false)
    h.discharged = 80
    expect(isUnlocked(h, 'er')).toBe(true)
  })

  it('opens for 80 and closes refunding 40', () => {
    const h = createHospital()
    h.discharged = 80
    expect(toggleEr(h).ok).toBe(true)
    expect(h.erOpen).toBe(true)
    expect(h.money).toBe(START_MONEY - ER_OPEN_COST)
    expect(toggleEr(h).ok).toBe(true)
    expect(h.erOpen).toBe(false)
    expect(h.money).toBe(START_MONEY - ER_OPEN_COST + ER_CLOSE_REFUND)
  })

  it('does not open twice or when broke', () => {
    const h = createHospital()
    h.discharged = 80
    h.erOpen = true
    expect(setErOpen(h, true)).toEqual({ ok: false, reason: '急诊口已开' })
    h.erOpen = false
    h.money = 79
    expect(setErOpen(h, true)).toEqual({ ok: false, reason: '钱不够' })
    expect(h.erOpen).toBe(false)
  })
})

describe('er spawn split', () => {
  it('keeps everyone on the main door when closed', () => {
    const h = line()
    h.erOpen = false
    for (let i = 0; i < 20; i++) {
      h.patients = []
      const p = spawnPatient(h, 'cold')
      expect(p?.isEr).toBe(false)
      expect(p?.x).toBe(2)
      expect(p?.y).toBe(5)
    }
  })

  it('marks about 25% as ER when open', () => {
    const h = line()
    h.erOpen = true
    h.rollMode = 'rand'
    h.rng = 7
    let er = 0
    const n = 200
    for (let i = 0; i < n; i++) {
      h.patients = []
      if (shouldMarkEr(h)) er += 1
    }
    expect(er).toBeGreaterThan(30)
    expect(er).toBeLessThan(70)
  })

  it('ER patients spawn at the ER door', () => {
    const h = line()
    const p = spawnPatient(h, 'cold', true)
    expect(p?.isEr).toBe(true)
    expect(p?.x).toBe(ER_DOOR.c)
    expect(p?.y).toBe(ER_DOOR.r)
  })
})

describe('er path skip and insert', () => {
  it('rewrites daily paths to skip reception and diagnosis', () => {
    const h = createHospital()
    const cold = makePatient(h, 'cold', true)
    applyErPath(cold)
    expect(cold.path).toEqual(['treatment', 'pharmacy'])

    const vip = makePatient(h, 'vip', true)
    applyErPath(vip)
    expect(vip.path).toEqual(['treatment', 'pharmacy'])

    h.discharged = 50
    const infect = makePatient(h, 'infectious', true)
    applyErPath(infect)
    expect(infect.path).toEqual(['treatment', 'pharmacy'])

    h.discharged = 30
    const bone = makePatient(h, 'fracture', true)
    applyErPath(bone)
    expect(bone.path).toEqual(['surgery', 'ward', 'pharmacy'])
  })

  it('inserts an ER cold at the head of the treatment queue', () => {
    const h = line()
    const treat = h.rooms.find((r) => r.type === 'treatment')!
    const a = makePatient(h, 'cold')
    const b = makePatient(h, 'cold')
    h.patients.push(a, b)
    treat.queue.push(a.id, b.id)

    const er = spawnPatient(h, 'cold', true)!
    er.walkRemain = 0
    arrivePatient(h, er)
    expect(treat.queue[0]).toBe(er.id)
    expect(treat.queue.slice(1)).toEqual([a.id, b.id])
    expect(er.path[er.node]).toBe('treatment')
  })

  it('inserts an ER fracture at the head of the surgery queue', () => {
    const h = createHospital()
    h.eventIn = 99999
    h.discharged = 80
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    buildRoom(h, 'surgery', [
      { r: 3, c: 0 },
      { r: 3, c: 1 },
    ])
    assignDoctor(h, h.doctors[0].id, h.rooms[0].id)
    assignDoctor(h, h.doctors[1].id, h.rooms[1].id)
    const surgery = h.rooms.find((r) => r.type === 'surgery')!
    const waiting = makePatient(h, 'fracture')
    h.patients.push(waiting)
    surgery.queue.push(waiting.id)

    const er = spawnPatient(h, 'fracture', true)!
    er.walkRemain = 0
    arrivePatient(h, er)
    expect(surgery.queue[0]).toBe(er.id)
    expect(surgery.queue[1]).toBe(waiting.id)
  })

  it('filling treatment with an ER insert overflows the next patient into the hall', () => {
    const h = line()
    h.discharged = 80
    buildRoom(h, 'waiting', [{ r: 4, c: 0 }])
    const treat = h.rooms.find((r) => r.type === 'treatment')!
    const hall = h.rooms.find((r) => r.type === 'waiting')!
    const a = makePatient(h, 'cold')
    const b = makePatient(h, 'cold')
    h.patients.push(a, b)
    treat.queue.push(a.id, b.id)

    const er = spawnPatient(h, 'cold', true)!
    er.walkRemain = 0
    arrivePatient(h, er)
    expect(treat.queue).toHaveLength(3)

    const extra = makePatient(h, 'cold')
    extra.path = ['treatment', 'pharmacy']
    extra.node = 0
    h.patients.push(extra)
    routePatient(h, extra)
    expect(extra.toHall).toBe(true)
    expect(extra.toRoomId).toBe(hall.id)
  })

  it('infectious rewrite does not send an ER VIP back to reception', () => {
    const h = createHospital()
    const vip = makePatient(h, 'vip', true)
    applyErPath(vip)
    expect(vip.path).toEqual(['treatment', 'pharmacy'])
    rewriteInfectious(vip)
    expect(vip.disease).toBe('infectious')
    expect(vip.isEr).toBe(true)
    expect(vip.path).toEqual(['treatment', 'ward', 'pharmacy'])
    expect(vip.path).not.toContain('reception')
    expect(vip.path).not.toContain('diagnosis')
    expect(skippedDiagnosis(vip)).toBe(true)
  })

  it('infectious rewrite keeps a diagnosed VIP on the remaining infectious tail', () => {
    const h = createHospital()
    const vip = makePatient(h, 'vip')
    vip.node = 1
    rewriteInfectious(vip)
    expect(vip.path).toEqual(['reception', 'diagnosis', 'ward', 'treatment', 'pharmacy'])
  })

  it('VIP ER still sits at the queue head', () => {
    const h = line()
    h.discharged = 80
    const treat = h.rooms.find((r) => r.type === 'treatment')!
    const erCold = spawnPatient(h, 'cold', true)!
    erCold.walkRemain = 0
    arrivePatient(h, erCold)
    const vip = spawnPatient(h, 'vip', true)!
    vip.walkRemain = 0
    arrivePatient(h, vip)
    expect(treat.queue[0]).toBe(vip.id)
    expect(treat.queue[1]).toBe(erCold.id)
  })
})

describe('er success penalty', () => {
  it('multiplies treatment and surgery chance by 0.85 without diagnosis', () => {
    const h = createHospital()
    const room = {
      id: 't',
      type: 'treatment' as const,
      tiles: [{ r: 0, c: 0 }],
      levelFlags: { queuePlus2: false, dualStation: false, compact: false },
      doctorIds: [],
      queue: [],
      pollution: 0,
      builtCost: 0,
      upgradeSpent: 0,
      progress: 0,
    }
    const normal = makePatient(h, 'cold')
    const er = makePatient(h, 'cold', true)
    applyErPath(er)
    expect(treatChance(room, normal)).toBe(SUCCESS.treatment)
    expect(treatChance(room, er)).toBeCloseTo(SUCCESS.treatment * ER_SUCCESS_MUL)

    const surgery = { ...room, type: 'surgery' as const }
    const bone = makePatient(h, 'fracture', true)
    applyErPath(bone)
    expect(treatChance(surgery, bone)).toBeCloseTo(SUCCESS.surgery * ER_SUCCESS_MUL)
  })

  it('does not penalize a special ER patient who still has diagnosis on the path', () => {
    const h = createHospital()
    const surgery = {
      id: 's',
      type: 'surgery' as const,
      tiles: [{ r: 0, c: 0 }],
      levelFlags: { queuePlus2: false, dualStation: false, compact: false },
      doctorIds: [],
      queue: [],
      pollution: 0,
      builtCost: 0,
      upgradeSpent: 0,
      progress: 0,
    }
    const special = makePatient(h, 'special', true)
    special.isSpecial = true
    special.recipeId = 'micro'
    special.path = ['reception', 'diagnosis', 'surgery', 'specialist', 'pharmacy']
    applySpecialErPath(special)
    expect(special.path[0]).toBe('diagnosis')
    expect(skippedDiagnosis(special)).toBe(false)
    special.node = 1
    expect(treatChance(surgery, special)).toBe(SUCCESS.surgery)
  })
})
