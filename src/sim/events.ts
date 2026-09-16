import { spawnPatient } from './flow'
import { addFame, hasReception, isUnlocked } from './query'
import { pick, randInt } from './rng'
import { EVENT_IDS } from './tables'
import type { ActionResult, EventId, Hospital } from './types'

export function availableEvents(h: Hospital): EventId[] {
  return EVENT_IDS.filter((id) => {
    if (id === 'infectAdmit') return isUnlocked(h, 'infectious')
    if (id === 'vipCut') return isUnlocked(h, 'vip')
    return true
  })
}

export function stepEvents(h: Hospital, opts: { spawn?: boolean } = {}) {
  for (const buff of h.buffs) buff.remainS -= 1
  h.buffs = h.buffs.filter((b) => b.remainS > 0)
  if (h.pendingEvent) return
  if (h.eventIn > 0) h.eventIn -= 1
  if (h.eventIn <= 0 && opts.spawn !== false) {
    if (!hasReception(h)) return
    const pool = availableEvents(h)
    if (!pool.length) return
    h.pendingEvent = pick(h, pool)
    h.eventIn = randInt(h, 90, 150)
  }
}

/** 上线最多补 1 张。已有待处理卡或倒计时未到则不补。 */
export function backfillEvent(h: Hospital): boolean {
  if (h.pendingEvent || h.eventIn > 0) return false
  if (!hasReception(h)) return false
  const pool = availableEvents(h)
  if (!pool.length) return false
  h.pendingEvent = pick(h, pool)
  h.eventIn = randInt(h, 90, 150)
  return true
}

export function chooseEvent(h: Hospital, side: 'left' | 'right'): ActionResult {
  const id = h.pendingEvent
  if (!id) return { ok: false, reason: '没有事件' }
  h.pendingEvent = null
  applyEvent(h, id, side)
  return { ok: true }
}

function applyEvent(h: Hospital, id: EventId, side: 'left' | 'right') {
  if (id === 'infectAdmit') {
    if (side === 'left') h.buffs.push({ kind: 'infectWeight', remainS: 180, mul: 3 })
    else addFame(h, -6)
    return
  }
  if (id === 'vipCut') {
    if (side === 'left') spawnPatient(h, 'vip', undefined, { ignoreCap: true })
    else addFame(h, 3)
    return
  }
  if (id === 'inspect') {
    if (side === 'left') {
      h.money -= 40
      for (const room of h.rooms) room.pollution = Math.max(0, room.pollution - 20)
    } else if (h.rooms.some((r) => r.pollution >= 50)) {
      addFame(h, -10)
    }
    return
  }
  if (id === 'vendor') {
    if (side === 'left') {
      h.money -= 80
      const rooms = h.rooms.filter((r) => r.type !== 'waiting')
      if (rooms.length) {
        const room = pick(h, rooms)
        h.buffs.push({ kind: 'roomThroughput', remainS: 180, roomId: room.id, mul: 1.3 })
      }
    }
    return
  }
  if (id === 'raise') {
    if (side === 'left') {
      h.money -= 30
      h.buffs.push({ kind: 'doctorSpeed', remainS: 180, mul: 1.2 })
    } else {
      const staffed = h.rooms.filter((r) => r.type !== 'waiting' && r.doctorIds.length > 0)
      const rooms = staffed.length ? staffed : h.rooms.filter((r) => r.type !== 'waiting')
      if (rooms.length) h.buffs.push({ kind: 'roomVacant', remainS: 60, roomId: pick(h, rooms).id })
    }
    return
  }
  if (id === 'media' && side === 'left') {
    h.buffs.push({ kind: 'spawnInterval', remainS: 180, mul: 0.7 })
  }
}
