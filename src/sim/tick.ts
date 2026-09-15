import { cloneHospital } from './clone'
import { stepEvents } from './events'
import { stepHalls, stepNeeds, stepRooms, stepSpawn, stepWalk, stepWard, sweepGone } from './flow'
import { stepPollution } from './pollution'
import { stepSkills } from './skills'
import type { Hospital } from './types'

export type TickOpts = {
  now?: number
  /** 挂机追 tick 时不发事件卡，只走 buff / 倒计时。默认 true。 */
  spawnEvents?: boolean
}

export function applyTick(h: Hospital, opts: TickOpts = {}): void {
  h.elapsedS += 1
  h.lastTick = opts.now ?? Date.now()
  stepEvents(h, { spawn: opts.spawnEvents !== false })
  stepPollution(h)
  stepSkills(h)
  stepNeeds(h)
  stepWard(h)
  stepHalls(h)
  stepRooms(h)
  stepWalk(h)
  stepSpawn(h)
  sweepGone(h)
}

export function tick(hospital: Hospital, opts?: TickOpts): Hospital {
  const h = cloneHospital(hospital)
  applyTick(h, opts)
  return h
}

export function ticks(hospital: Hospital, n: number, opts?: TickOpts): Hospital {
  const h = cloneHospital(hospital)
  for (let i = 0; i < n; i++) applyTick(h, opts)
  return h
}
