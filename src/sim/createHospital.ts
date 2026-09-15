import { randInt } from './rng'
import { createSkills } from './skills'
import { HIRE_DOCTOR, START_DOCTORS, START_FAME, START_MONEY, START_NURSES } from './tables'
import type { Hospital } from './types'

export function createHospital(): Hospital {
  const h: Hospital = {
    money: START_MONEY,
    fame: START_FAME,
    nurses: START_NURSES,
    doctors: Array.from({ length: START_DOCTORS }, (_, i) => ({
      id: `doc-${i + 1}`,
      roomId: null,
      hireCost: HIRE_DOCTOR,
    })),
    rooms: [],
    patients: [],
    lastTick: Date.now(),
    elapsedS: 0,
    spawnAcc: 0,
    nextId: START_DOCTORS,
    rng: 1,
    rollMode: 'rand',
    discharged: 0,
    leftCount: 0,
    deadCount: 0,
    erOpen: false,
    interceptUsed: false,
    pendingEvent: null,
    eventIn: 0,
    buffs: [],
    skills: createSkills(),
    hots: [],
  }
  h.eventIn = randInt(h, 90, 150)
  return h
}
