import { describe, expect, it } from 'vitest'
import { buildRoom, sellRoom, upgradeQueue } from './build'
import { createHospital } from './createHospital'
import { chooseEvent } from './events'
import { makePatient, routePatient, spawnPatient, walkDuration } from './flow'
import { nextUnlockHint, nurseCoef, nurseWalkLabel, pollutionCoef } from './query'
import { stepPollution } from './pollution'
import { assignDoctor, fireDoctor, fireNurse, hireNurse } from './staff'
import { START_DOCTORS, START_FAME, START_MONEY } from './tables'
import { tick, ticks } from './tick'
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

describe('createHospital', () => {
  it('opens with money, fame, four doctors and one nurse', () => {
    const hospital = createHospital()
    expect(hospital.money).toBe(START_MONEY)
    expect(hospital.fame).toBe(START_FAME)
    expect(hospital.nurses).toBe(1)
    expect(hospital.doctors).toHaveLength(START_DOCTORS)
    expect(hospital.rooms).toHaveLength(0)
    expect(hospital).not.toHaveProperty('cleaners')
    expect(hospital.skills).toHaveLength(4)
    expect(hospital.hots).toEqual([])
    expect(hospital.id).toBe('player')
    expect(hospital.week).toBeNull()
    expect(hospital.doctors.every((d) => d.hireCost === 0)).toBe(true)
    expect(nextUnlockHint(hospital)).toContain('病房')
  })
})

describe('build', () => {
  it('rejects reception that is not next to the door', () => {
    const h = createHospital()
    expect(buildRoom(h, 'reception', [{ r: 0, c: 0 }]).ok).toBe(false)
    expect(buildRoom(h, 'reception', [{ r: 4, c: 2 }]).ok).toBe(true)
  })

  it('sells and refunds half', () => {
    const h = createHospital()
    buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
    expect(h.money).toBe(START_MONEY - 40)
    expect(sellRoom(h, h.rooms[0].id).ok).toBe(true)
    expect(h.money).toBe(START_MONEY - 20)
    expect(h.rooms).toHaveLength(0)
  })
})

describe('tick', () => {
  it('does not spawn without a reception', () => {
    const next = ticks(createHospital(), 20)
    expect(next.patients).toHaveLength(0)
  })

  it('discharges a cold along a staffed line', () => {
    const h = ticks(line(), 180)
    expect(h.discharged).toBeGreaterThan(0)
    expect(h.money).toBeGreaterThan(0)
  })

  it('stops spawning at fame 0', () => {
    const h = line()
    h.fame = 0
    const next = ticks(h, 20)
    expect(next.patients).toHaveLength(0)
  })

  it('does not kill a stage-3 patient already queued in treatment', () => {
    const h = line()
    const treat = h.rooms.find((r) => r.type === 'treatment')!
    const head = makePatient(h, 'cold')
    const queued = makePatient(h, 'cold')
    head.stage = 3
    queued.stage = 3
    head.state = 'treat'
    queued.state = 'queue'
    head.inRoomId = treat.id
    queued.inRoomId = treat.id
    treat.queue.push(head.id, queued.id)
    h.patients.push(head, queued)
    const next = tick(h)
    expect(next.deadCount).toBe(0)
    expect(next.patients.some((p) => p.id === queued.id && p.state === 'dead')).toBe(false)
  })

  it('does not kill a stage-3 patient who already left a care room', () => {
    const h = line()
    const pharm = h.rooms.find((r) => r.type === 'pharmacy')!
    const walking = makePatient(h, 'cold')
    walking.stage = 3
    walking.node = 3
    walking.state = 'walk'
    walking.x = 2
    walking.y = 2
    walking.walkFromX = 2
    walking.walkFromY = 2
    walking.walkToX = 2
    walking.walkToY = 1
    walking.walkRemain = 2
    walking.walkTotal = 2
    walking.toRoomId = pharm.id
    const queued = makePatient(h, 'cold')
    queued.stage = 3
    queued.node = 3
    queued.state = 'queue'
    queued.inRoomId = pharm.id
    pharm.queue.push(queued.id)
    h.patients.push(walking, queued)
    const next = tick(h)
    expect(next.deadCount).toBe(0)
    expect(next.patients.some((p) => p.id === walking.id && p.state === 'dead')).toBe(false)
    expect(next.patients.some((p) => p.id === queued.id && p.state === 'dead')).toBe(false)
  })

  it('still kills a stage-3 patient who has not reached care', () => {
    const h = line()
    const diag = h.rooms.find((r) => r.type === 'diagnosis')!
    const p = makePatient(h, 'cold')
    p.stage = 3
    p.node = 1
    p.state = 'queue'
    p.inRoomId = diag.id
    diag.queue.push(p.id)
    h.patients.push(p)
    const next = tick(h)
    expect(next.deadCount).toBe(1)
  })

  it('leaves when the next room is missing and rage is high', () => {
    const h = createHospital()
    h.rollMode = 'always'
    h.eventIn = 99999
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    assignDoctor(h, h.doctors[0].id, h.rooms[0].id)
    let next = ticks(h, 40)
    const stuck = next.patients.find((p) => p.blocked)
    expect(stuck).toBeTruthy()
    stuck!.rage = 80
    next = tick(next)
    expect(next.leftCount).toBeGreaterThan(0)
  })
})

describe('staff and pollution', () => {
  it('more nurses walk faster', () => {
    const a = createHospital()
    const b = createHospital()
    b.nurses = 4
    const from = { r: 4, c: 2 }
    const to = { r: 0, c: 2 }
    expect(walkDuration(b, from, to)).toBeLessThan(walkDuration(a, from, to))
    expect(nurseCoef(0)).toBe(1)
    expect(nurseCoef(1)).toBeCloseTo(0.85)
    expect(nurseCoef(4)).toBe(0.4)
    expect(nurseWalkLabel(1)).toBe('走路 ×0.85')
  })

  it('empty station has zero throughput so the room only blocks', () => {
    const h = createHospital()
    h.rollMode = 'always'
    h.eventIn = 99999
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    spawnPatient(h, 'cold')
    const next = ticks(h, 30)
    const reception = next.rooms[0]
    expect(reception.queue.length).toBeGreaterThan(0)
    expect(next.discharged).toBe(0)
  })

  it('upgrades queue cap', () => {
    const h = createHospital()
    h.money = 200
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    expect(upgradeQueue(h, h.rooms[0].id).ok).toBe(true)
    expect(h.rooms[0].levelFlags.queuePlus2).toBe(true)
  })

  it('hires a nurse', () => {
    const h = createHospital()
    h.money = 80
    expect(hireNurse(h).ok).toBe(true)
    expect(h.nurses).toBe(2)
  })

  it('rescales an in-progress walk when nurse count changes', () => {
    const h = createHospital()
    const p = makePatient(h, 'cold')
    p.state = 'walk'
    p.walkRemain = 8.5
    p.walkTotal = 8.5
    h.patients.push(p)
    expect(hireNurse(h).ok).toBe(true)
    expect(p.walkRemain).toBeCloseTo(7)
    expect(p.walkTotal).toBeCloseTo(7)
    expect(fireNurse(h).ok).toBe(true)
    expect(p.walkRemain).toBeCloseTo(8.5)
    expect(h.nurses).toBe(1)
  })

  it('does not refund gifted starting staff', () => {
    const h = createHospital()
    const money = h.money
    expect(fireNurse(h).ok).toBe(true)
    expect(h.nurses).toBe(0)
    expect(h.money).toBe(money)
    expect(fireDoctor(h, h.doctors[0].id).ok).toBe(true)
    expect(h.money).toBe(money)
  })

  it('refunds half after a hired nurse', () => {
    const h = createHospital()
    expect(hireNurse(h).ok).toBe(true)
    const money = h.money
    expect(fireNurse(h).ok).toBe(true)
    expect(h.nurses).toBe(1)
    expect(h.money).toBe(money + 40)
  })

  it('does not rewrite a week-match patient into infectious', () => {
    const h = createHospital()
    h.eventIn = 99999
    h.rollMode = 'always'
    h.elapsedS = 30
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    h.rooms[0].pollution = 80
    const p = makePatient(h, 'special')
    p.isSpecial = true
    p.recipeId = 'isolate'
    p.path = ['reception', 'diagnosis', 'ward', 'specialist', 'pharmacy']
    p.state = 'queue'
    p.inRoomId = h.rooms[0].id
    h.patients.push(p)
    h.rooms[0].queue.push(p.id)
    stepPollution(h)
    expect(p.disease).toBe('special')
    expect(p.isSpecial).toBe(true)
    expect(p.path).toEqual(['reception', 'diagnosis', 'ward', 'specialist', 'pharmacy'])
  })

  it('pollution coefficient drops after 30', () => {
    expect(pollutionCoef(30)).toBe(1)
    expect(pollutionCoef(40)).toBeCloseTo(0.9)
    expect(pollutionCoef(100)).toBeCloseTo(0.9 ** 7)
    expect(pollutionCoef(200)).toBe(0.4)
  })
})

describe('waiting hall and events', () => {
  it('overflows into a waiting hall when the next room is full', () => {
    const h = createHospital()
    h.rollMode = 'always'
    h.eventIn = 99999
    h.discharged = 15
    h.money = 400
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
    buildRoom(h, 'waiting', [{ r: 4, c: 0 }])
    assignDoctor(h, h.doctors[0].id, h.rooms[0].id)
    const diag = h.rooms.find((r) => r.type === 'diagnosis')!
    for (let i = 0; i < 4; i++) {
      const p = makePatient(h, 'cold')
      p.node = 1
      p.state = 'queue'
      p.inRoomId = diag.id
      h.patients.push(p)
      diag.queue.push(p.id)
    }
    const extra = makePatient(h, 'cold')
    extra.node = 1
    extra.state = 'walk'
    extra.x = 2
    extra.y = 4
    h.patients.push(extra)
    routePatient(h, extra)
    const hall = h.rooms.find((r) => r.type === 'waiting')!
    expect(extra.toHall).toBe(true)
    expect(extra.toRoomId).toBe(hall.id)
  })

  it('does not overflow into a hall when the next room is missing', () => {
    const h = createHospital()
    h.rollMode = 'always'
    h.eventIn = 99999
    h.discharged = 15
    h.money = 400
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    buildRoom(h, 'waiting', [{ r: 4, c: 0 }])
    const p = makePatient(h, 'cold')
    p.node = 1
    p.state = 'walk'
    p.x = 2
    p.y = 4
    h.patients.push(p)
    routePatient(h, p)
    expect(p.toHall).toBe(false)
    expect(p.blocked).toBe(true)
  })

  it('applies a daily event choice', () => {
    const h = createHospital()
    h.pendingEvent = 'media'
    expect(chooseEvent(h, 'left').ok).toBe(true)
    expect(h.buffs.some((b) => b.kind === 'spawnInterval')).toBe(true)
    expect(h.pendingEvent).toBeNull()
  })
})
