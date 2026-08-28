import type { Hospital } from './types'

/** 第 0 档只走时钟。进场 / 走路 / 吞吐从第 1 档接入。 */
export function tick(hospital: Hospital): Hospital {
  return {
    ...hospital,
    elapsedS: hospital.elapsedS + 1,
    lastTick: Date.now(),
  }
}
