import { START_FAME, START_MONEY } from './tables'
import type { Hospital } from './types'

export function createHospital(): Hospital {
  return {
    money: START_MONEY,
    fame: START_FAME,
    nurses: 1,
    doctors: [{ id: 'doc-1', roomId: null }],
    cleaners: [],
    rooms: [],
    patients: [],
    unlocks: ['cold', 'reception', 'treatment', 'pharmacy', 'diagnosis'],
    lastTick: Date.now(),
    elapsedS: 0,
    erOpen: false,
    interceptUsed: false,
  }
}
