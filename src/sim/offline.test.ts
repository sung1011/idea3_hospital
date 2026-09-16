import { describe, expect, it } from 'vitest'
import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { backfillEvent } from './events'
import { makePatient } from './flow'
import { offlineSeconds, settleOffline } from './offline'
import { castSkill, getSkill } from './skills'
import { assignDoctor, unassignDoctor } from './staff'
import { OFFLINE_CAP_S, SPECIAL_TRANSFER_FEE } from './tables'
import { ticks } from './tick'
import type { Hospital } from './types'
import { demoUnlockWeek, pendingOffer, stepWeek } from './week'

function line(): Hospital {
  const h = createHospital()
  h.rollMode = 'always'
  h.eventIn = 99999
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'treatment', [{ r: 2, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 1, c: 2 }])
  h.rooms.forEach((room, i) => assignDoctor(h, h.doctors[i].id, room.id))
  return h
}

describe('offlineSeconds', () => {
  it('floors to whole seconds and never goes negative', () => {
    expect(offlineSeconds(1000, 1000)).toBe(0)
    expect(offlineSeconds(1000, 1999)).toBe(0)
    expect(offlineSeconds(1000, 2500)).toBe(1)
    expect(offlineSeconds(5000, 1000)).toBe(0)
    expect(offlineSeconds(0, 1_000_000)).toBe(0)
    expect(offlineSeconds(-12, 1_000_000)).toBe(0)
    expect(offlineSeconds(Number.NaN, 1_000_000)).toBe(0)
  })

  it('caps at 8 hours (28800 ticks)', () => {
    const now = 1_700_000_000_000
    expect(offlineSeconds(now - 10 * 3600 * 1000, now)).toBe(OFFLINE_CAP_S)
    expect(OFFLINE_CAP_S).toBe(28800)
    expect(offlineSeconds(now - OFFLINE_CAP_S * 1000, now)).toBe(OFFLINE_CAP_S)
    expect(offlineSeconds(now - (OFFLINE_CAP_S + 1) * 1000, now)).toBe(OFFLINE_CAP_S)
  })
})

describe('settleOffline catch-up', () => {
  it('runs the shared tick() that many times and summary matches counters', () => {
    const now = 2_000_000
    const gap = 180
    const saved = line()
    saved.lastTick = now - gap * 1000

    const settled = settleOffline(saved, now)
    const manual = ticks(line(), gap, { spawnEvents: false, now })
    backfillEvent(manual)
    manual.lastTick = now

    expect(settled.summary.seconds).toBe(gap)
    expect(settled.summary.done).toBe(manual.discharged - saved.discharged)
    expect(settled.summary.left).toBe(manual.leftCount - saved.leftCount)
    expect(settled.summary.dead).toBe(manual.deadCount - saved.deadCount)
    expect(settled.hospital.discharged).toBe(manual.discharged)
    expect(settled.hospital.leftCount).toBe(manual.leftCount)
    expect(settled.hospital.deadCount).toBe(manual.deadCount)
    expect(settled.hospital.elapsedS).toBe(manual.elapsedS)
    expect(settled.hospital.money).toBe(manual.money)
    expect(settled.hospital.lastTick).toBe(now)
    expect(settled.summary.done).toBeGreaterThan(0)
  })

  it('does nothing when the gap is under one second', () => {
    const h = line()
    const now = h.lastTick + 400
    const result = settleOffline(h, now)
    expect(result.hospital).toBe(h)
    expect(result.summary.seconds).toBe(0)
    expect(result.summary.done).toBe(0)
  })

  it('does not treat lastTick 0 as an 8-hour gap', () => {
    const h = createHospital()
    h.eventIn = 99999
    h.lastTick = 0
    const result = settleOffline(h, 1_000_000)
    expect(result.summary.seconds).toBe(0)
    expect(result.hospital.elapsedS).toBe(h.elapsedS)
  })

  it('counts a cured special in 完成 even though discharged stays put', () => {
    const now = 9_000_000
    const h = line()
    const p = makePatient(h, 'special')
    p.isSpecial = true
    p.recipeId = 'isolate'
    p.state = 'walk'
    p.toDoor = true
    p.walkRemain = 0
    p.walkTotal = 0
    h.patients.push(p)
    h.lastTick = now - 3000
    const discharged = h.discharged
    const result = settleOffline(h, now)
    expect(result.hospital.discharged).toBe(discharged)
    expect(result.summary.done).toBeGreaterThanOrEqual(1)
    expect(result.summary.seconds).toBe(3)
  })

  it('caps catch-up at 28800 ticks even if lastTick is 10 hours ago', () => {
    const now = 1_700_000_000_000
    const h = createHospital()
    h.eventIn = 99999
    h.lastTick = now - 10 * 3600 * 1000
    const started = h.elapsedS
    const result = settleOffline(h, now)
    expect(result.summary.seconds).toBe(OFFLINE_CAP_S)
    expect(result.hospital.elapsedS).toBe(started + OFFLINE_CAP_S)
    expect(result.hospital.lastTick).toBe(now)
  })

  it('bad layout loses more: unstaffed treatment dies and earns nothing', () => {
    const now = 3_000_000
    const gap = 150
    const good = line()
    const bad = line()
    const treat = bad.rooms.find((r) => r.type === 'treatment')!
    unassignDoctor(bad, treat.doctorIds[0])
    good.lastTick = now - gap * 1000
    bad.lastTick = now - gap * 1000

    const goodS = settleOffline(good, now)
    const badS = settleOffline(bad, now)

    expect(goodS.summary.done).toBeGreaterThan(badS.summary.done)
    expect(goodS.hospital.money - good.money).toBeGreaterThan(badS.hospital.money - bad.money)
    expect(badS.summary.done).toBe(0)
    expect(badS.summary.blockedLabel).toBe('治疗室')
  })

  it('idle is not pure profit: unstaffed rooms still kill queued patients', () => {
    const now = 3_500_000
    const h = createHospital()
    h.rollMode = 'always'
    h.eventIn = 99999
    buildRoom(h, 'reception', [{ r: 4, c: 2 }])
    h.lastTick = now - 90 * 1000

    const result = settleOffline(h, now)
    expect(result.summary.dead).toBeGreaterThan(0)
    expect(result.summary.done).toBe(0)
  })
})

describe('offline events', () => {
  it('backfills at most one pending card after a long gap', () => {
    const now = 4_000_000
    const h = line()
    h.eventIn = 8
    h.pendingEvent = null
    h.lastTick = now - 400 * 1000

    const first = settleOffline(h, now)
    expect(first.hospital.pendingEvent).not.toBeNull()
    expect(first.hospital.eventIn).toBeGreaterThan(0)

    first.hospital.lastTick = now - 500 * 1000
    const owed = first.hospital.pendingEvent
    const second = settleOffline(first.hospital, now)
    expect(second.hospital.pendingEvent).toBe(owed)
  })

  it('keeps an already pending card and does not stack another', () => {
    const now = 5_000_000
    const h = line()
    h.pendingEvent = 'media'
    h.eventIn = 12
    h.lastTick = now - 300 * 1000

    const result = settleOffline(h, now)
    expect(result.hospital.pendingEvent).toBe('media')
    expect(result.hospital.eventIn).toBe(12)
  })

  it('does not spawn a card when the countdown would not have elapsed', () => {
    const now = 6_000_000
    const h = line()
    h.eventIn = 90
    h.pendingEvent = null
    h.lastTick = now - 20 * 1000

    const result = settleOffline(h, now)
    expect(result.hospital.pendingEvent).toBeNull()
    expect(result.hospital.eventIn).toBe(70)
  })
})

describe('offline skills', () => {
  it('advances skill CD during catch-up', () => {
    const now = 7_000_000
    const h = line()
    h.discharged = 15
    expect(castSkill(h, 'disinfect', { r: 4, c: 2 }).ok).toBe(true)
    expect(getSkill(h, 'disinfect')!.cdLeft).toBe(20)
    h.lastTick = now - 20 * 1000

    const result = settleOffline(h, now)
    expect(getSkill(result.hospital, 'disinfect')!.cdLeft).toBe(0)
  })

  it('does not chain-timeout week offers while catching up', () => {
    const now = 12_000_000
    const h = line()
    h.fame = 0
    h.discharged = 100
    demoUnlockWeek(h, now - 180_000)
    stepWeek(h, now - 180_000)
    expect(pendingOffer(h)).toBeTruthy()
    h.lastTick = now - 180_000
    const money = h.money
    const result = settleOffline(h, now)
    expect(result.hospital.money).toBe(money + SPECIAL_TRANSFER_FEE)
    expect(result.hospital.week?.pendingOfferId ? 1 : 0).toBeLessThanOrEqual(1)
    const pending = pendingOffer(result.hospital)
    if (pending) expect(result.hospital.week?.pendingOfferId).toBe(pending.specialId)
  })

  it('syncs a stale week clock after catch-up', () => {
    const started = 20_000_000
    const h = line()
    h.fame = 0
    h.discharged = 100
    demoUnlockWeek(h, started)
    stepWeek(h, started)
    h.week!.endsAt = started + 1500
    h.week!.nextSpawnAt = 1e15
    h.week!.scores = [0, 0, 0, 0]
    h.lastTick = started
    const money = h.money
    const result = settleOffline(h, started + 4000)
    expect(result.hospital.money).toBe(money)
    expect(result.hospital.week!.weekId).toBe(2)
    expect(result.hospital.week!.endsAt).toBeGreaterThan(started + 4000)
  })

  it('runs HoT during catch-up', () => {
    const now = 8_000_000
    const h = line()
    h.discharged = 15
    h.rooms[0].pollution = 80
    expect(castSkill(h, 'sustain', { r: 4, c: 2 }).ok).toBe(true)
    h.lastTick = now - 10 * 1000

    const result = settleOffline(h, now)
    const reception = result.hospital.rooms.find((r) => r.type === 'reception')
    expect(reception?.pollution).toBe(40)
    expect(result.hospital.hots).toHaveLength(0)
  })
})
