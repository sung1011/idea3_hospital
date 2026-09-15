import { cloneHospital } from './clone'
import { stepEvents } from './events'
import { stepHalls, stepNeeds, stepRooms, stepSpawn, stepWalk, stepWard, sweepGone } from './flow'
import { stepPollution } from './pollution'
import { stepSkills } from './skills'
import type { Hospital } from './types'

export function tick(hospital: Hospital): Hospital {
  const h = cloneHospital(hospital)
  h.elapsedS += 1
  h.lastTick = Date.now()
  stepEvents(h)
  stepSkills(h)
  stepPollution(h)
  stepNeeds(h)
  stepWard(h)
  stepHalls(h)
  stepRooms(h)
  stepWalk(h)
  stepSpawn(h)
  sweepGone(h)
  return h
}

export function ticks(hospital: Hospital, n: number): Hospital {
  let h = hospital
  for (let i = 0; i < n; i++) h = tick(h)
  return h
}
