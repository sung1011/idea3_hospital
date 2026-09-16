import { describe, expect, it } from 'vitest'
import { fireDoctor } from '../sim/staff'
import { START_MONEY } from '../sim/tables'
import { migrateHospital } from './saveGame'

describe('migrateHospital', () => {
  it('rejects junk that is not a hospital snapshot', () => {
    expect(migrateHospital(null)).toBeNull()
    expect(migrateHospital('nope')).toBeNull()
    expect(migrateHospital({ money: 10 })).toBeNull()
  })

  it('fills missing fields so old Pages saves can load', () => {
    const now = 5_000
    const h = migrateHospital(
      {
        rooms: [{ id: 'r1', type: 'reception', tiles: [{ r: 4, c: 2 }] }],
        doctors: [{ id: 'doc-1', roomId: null }],
        skills: [{ id: 'disinfect', cdLeft: 7 }],
        lastTick: 0,
        pendingEvent: 'ghost',
        patients: [
          {
            id: 'p-1',
            disease: 'cold',
            path: ['reception', 'diagnosis', 'treatment', 'pharmacy'],
            node: 0,
            state: 'walk',
          },
        ],
      },
      now,
    )
    expect(h).toBeTruthy()
    expect(h!.lastTick).toBe(now)
    expect(h!.money).toBe(START_MONEY)
    expect(h!.rooms[0].levelFlags).toEqual({ queuePlus2: false, dualStation: false, compact: false })
    expect(h!.rooms[0].queue).toEqual([])
    expect(h!.rooms[0].progress).toBe(0)
    expect(h!.rooms[0].upgradeSpent).toBe(0)
    expect(h!.doctors[0].hireCost).toBe(0)
    expect(h!.skills).toHaveLength(4)
    expect(h!.skills.find((s) => s.id === 'disinfect')?.cdLeft).toBe(7)
    expect(h!.skills.find((s) => s.id === 'spray')?.cdLeft).toBe(0)
    expect(h!.pendingEvent).toBeNull()
    expect(h!.patients[0].isSpecial).toBe(false)
    expect(h!.patients[0].visitLog).toEqual([])
    expect(h!.week).toBeNull()
  })

  it('does not NaN money when firing a doctor saved without hireCost', () => {
    const h = migrateHospital(
      {
        lastTick: 1000,
        money: 200,
        rooms: [],
        doctors: [{ id: 'doc-old', roomId: null }],
      },
      1000,
    )!
    expect(fireDoctor(h, 'doc-old').ok).toBe(true)
    expect(h.money).toBe(200)
    expect(Number.isFinite(h.money)).toBe(true)
  })

  it('drops a stale pendingOfferId and junk city patients', () => {
    const h = migrateHospital(
      {
        lastTick: 1000,
        rooms: [],
        week: {
          recipeId: 'isolate',
          hospitalIds: ['player', 'npc-isolate'],
          rivals: [
            {
              id: 'npc-isolate',
              rooms: [{ id: 'nr', type: 'reception', tiles: [{ r: 4, c: 2 }] }],
              doctors: [],
            },
          ],
          pendingOfferId: 'ghost',
          cityQueue: [{ visitLog: [] }, { specialId: 'sp-1', recipeId: 'isolate' }],
        },
      },
      1000,
    )
    expect(h!.week?.pendingOfferId).toBeNull()
    expect(h!.week?.cityQueue).toHaveLength(1)
    expect(h!.week?.cityQueue[0].visitLog).toEqual([])
    expect(h!.week?.cityQueue[0].transferCount).toBe(0)
  })

  it('drops a malformed week instead of crashing on rivals', () => {
    const h = migrateHospital(
      {
        lastTick: 1000,
        rooms: [],
        week: { recipeId: 'isolate', hospitalIds: ['player'] },
      },
      1000,
    )
    expect(h!.week).toBeNull()
  })
})
