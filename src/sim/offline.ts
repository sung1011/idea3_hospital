import { cloneHospital } from './clone'
import { backfillEvent } from './events'
import { actualThroughput, isUnlocked, queueCap } from './query'
import { OFFLINE_CAP_S, ROOM_LABEL } from './tables'
import { applyTick } from './tick'
import { stepWeek, tickRivals } from './week'
import type { Hospital, Room, RoomType } from './types'

export type OfflineSummary = {
  seconds: number
  done: number
  left: number
  dead: number
  blockedRoomId: string | null
  blockedLabel: string | null
  blockedS: number
}

export type OfflineResult = {
  hospital: Hospital
  summary: OfflineSummary
}

export function offlineSeconds(lastTick: number, now = Date.now(), cap = OFFLINE_CAP_S): number {
  if (!Number.isFinite(lastTick) || !Number.isFinite(now)) return 0
  return Math.max(0, Math.min(cap, Math.floor((now - lastTick) / 1000)))
}

function emptySummary(seconds: number): OfflineSummary {
  return {
    seconds,
    done: 0,
    left: 0,
    dead: 0,
    blockedRoomId: null,
    blockedLabel: null,
    blockedS: 0,
  }
}

function roomIsStuck(h: Hospital, room: Room): boolean {
  if (room.queue.length >= queueCap(room)) return true
  return room.type !== 'waiting' && room.queue.length > 0 && actualThroughput(h, room) <= 0
}

function noteBlocked(h: Hospital, roomAcc: Map<string, number>, typeAcc: Map<RoomType, number>) {
  for (const room of h.rooms) {
    if (roomIsStuck(h, room)) roomAcc.set(room.id, (roomAcc.get(room.id) ?? 0) + 1)
  }
  const types = new Set<RoomType>()
  for (const p of h.patients) {
    if (p.blocked && p.node < p.path.length) types.add(p.path[p.node])
  }
  for (const type of types) typeAcc.set(type, (typeAcc.get(type) ?? 0) + 1)
}

function pickBlocked(
  h: Hospital,
  roomAcc: Map<string, number>,
  typeAcc: Map<RoomType, number>,
): { id: string | null; label: string; s: number } | null {
  let bestRoom: Room | null = null
  let bestRoomS = 0
  for (const room of h.rooms) {
    const s = roomAcc.get(room.id) ?? 0
    if (s > bestRoomS) {
      bestRoomS = s
      bestRoom = room
    }
  }

  let bestType: RoomType | null = null
  let bestTypeS = 0
  for (const [type, s] of typeAcc) {
    if (s > bestTypeS) {
      bestTypeS = s
      bestType = type
    }
  }

  if (bestRoom && bestRoomS >= bestTypeS) {
    return { id: bestRoom.id, label: ROOM_LABEL[bestRoom.type], s: bestRoomS }
  }
  if (!bestType) return null
  const existing = h.rooms.find((r) => r.type === bestType)
  if (existing) return { id: existing.id, label: ROOM_LABEL[bestType], s: bestTypeS }
  return { id: null, label: `缺${ROOM_LABEL[bestType]}`, s: bestTypeS }
}

export function settleOffline(hospital: Hospital, now = Date.now()): OfflineResult {
  const seconds = offlineSeconds(hospital.lastTick, now)
  if (seconds <= 0) {
    if (!isUnlocked(hospital, 'week') && !hospital.week) {
      return { hospital, summary: emptySummary(0) }
    }
    const h = cloneHospital(hospital)
    stepWeek(h, now)
    h.lastTick = now
    return { hospital: h, summary: emptySummary(0) }
  }

  const before = {
    discharged: hospital.discharged,
    leftCount: hospital.leftCount,
    deadCount: hospital.deadCount,
  }
  const roomAcc = new Map<string, number>()
  const typeAcc = new Map<RoomType, number>()
  const h = cloneHospital(hospital)
  const startedAt = hospital.lastTick

  for (let i = 0; i < seconds; i++) {
    const t = startedAt + (i + 1) * 1000
    applyTick(h, { now: t, spawnEvents: false })
    tickRivals(h, { now: t, spawnEvents: false })
    stepWeek(h, t)
    noteBlocked(h, roomAcc, typeAcc)
  }

  backfillEvent(h)
  h.lastTick = now

  const blocked = pickBlocked(h, roomAcc, typeAcc)
  return {
    hospital: h,
    summary: {
      seconds,
      done: h.discharged - before.discharged,
      left: h.leftCount - before.leftCount,
      dead: h.deadCount - before.deadCount,
      blockedRoomId: blocked?.id ?? null,
      blockedLabel: blocked?.label ?? null,
      blockedS: blocked?.s ?? 0,
    },
  }
}
