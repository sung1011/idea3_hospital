import { roomsAdjacent } from './query'
import { roll } from './rng'
import { CONVERT_CHANCE, POLLUTE_CONVERT_AT, POLLUTE_SPREAD, POLLUTE_SPREAD_AT } from './tables'
import { rewriteInfectious } from './flow'
import type { Hospital } from './types'

export function stepPollution(h: Hospital) {
  if (h.elapsedS > 0 && h.elapsedS % 15 === 0) {
    const add = new Map<string, number>()
    for (const room of h.rooms) {
      if (room.pollution < POLLUTE_SPREAD_AT) continue
      for (const other of h.rooms) {
        if (other.id === room.id || !roomsAdjacent(room, other)) continue
        add.set(other.id, (add.get(other.id) ?? 0) + POLLUTE_SPREAD)
      }
    }
    for (const room of h.rooms) {
      const extra = add.get(room.id) ?? 0
      if (extra) room.pollution = Math.min(100, room.pollution + extra)
    }
  }
  if (h.elapsedS > 0 && h.elapsedS % 30 === 0) {
    for (const room of h.rooms) {
      if (room.pollution < POLLUTE_CONVERT_AT) continue
      for (const id of room.queue) {
        const p = h.patients.find((x) => x.id === id)
        if (!p || p.disease === 'infectious' || p.isSpecial) continue
        if (roll(h, CONVERT_CHANCE)) rewriteInfectious(p)
      }
    }
  }
}
