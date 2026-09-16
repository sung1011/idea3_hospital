import {
  canOverflowToHall,
  inGrid,
  isUnlocked,
  manhattan,
  nextId,
  occupied,
  pickOpenHall,
  pickOpenRoom,
  roomTile,
} from './query'
import {
  GRID_SIZE,
  MAX_SPECIALIST,
  MAX_WAITING,
  RAGE_LEAVE_SOFT,
  RECEPTION_COLS,
  ROOM_DEF,
  UPGRADE_COMPACT,
  UPGRADE_DUAL,
  UPGRADE_QUEUE,
} from './tables'
import type { ActionResult, Hospital, Patient, RoomType, Tile } from './types'
import { leavePatient, startWalkTo } from './patientAct'

export function canReceiveAt(tile: Tile): boolean {
  return tile.r === GRID_SIZE - 1 && RECEPTION_COLS.includes(tile.c)
}

function tilesFree(h: Hospital, tiles: Tile[]): boolean {
  const used = occupied(h)
  return tiles.every((t) => inGrid(t) && !used.has(`${t.r},${t.c}`))
}

export function canBuild(h: Hospital, type: RoomType, tiles: Tile[]): ActionResult {
  if (!isUnlocked(h, type)) return { ok: false, reason: '尚未解锁' }
  if (h.money < 0) return { ok: false, reason: '没钱' }
  const def = ROOM_DEF[type]
  if (h.money < def.cost) return { ok: false, reason: '钱不够' }
  if (tiles.length !== def.tiles) return { ok: false, reason: type === 'surgery' ? '手术室要两格' : '占地不对' }
  if (type === 'surgery' && manhattan(tiles[0], tiles[1]) !== 1) return { ok: false, reason: '两格必须相邻' }
  if (!tilesFree(h, tiles)) return { ok: false, reason: '格子被占' }
  if (type === 'reception' && !canReceiveAt(tiles[0])) return { ok: false, reason: '前台必须贴正门' }
  if (type === 'waiting' && h.rooms.filter((r) => r.type === 'waiting').length >= MAX_WAITING) {
    return { ok: false, reason: '候诊厅最多 2 间' }
  }
  if (type === 'specialist' && h.rooms.filter((r) => r.type === 'specialist').length >= MAX_SPECIALIST) {
    return { ok: false, reason: '专科室只能 1 间' }
  }
  return { ok: true }
}

export function buildRoom(h: Hospital, type: RoomType, tiles: Tile[]): ActionResult {
  const check = canBuild(h, type, tiles)
  if (!check.ok) return check
  const def = ROOM_DEF[type]
  h.money -= def.cost
  h.rooms.push({
    id: nextId(h, 'room'),
    type,
    tiles: tiles.map((t) => ({ ...t })),
    levelFlags: { queuePlus2: false, dualStation: false, compact: false },
    doctorIds: [],
    queue: [],
    pollution: 0,
    builtCost: def.cost,
    upgradeSpent: 0,
    progress: 0,
    recipeId: type === 'specialist' ? (h.week?.pendingRecipeId ?? h.week?.recipeId) : undefined,
  })
  return { ok: true }
}

export function sellRoom(h: Hospital, roomId: string): ActionResult {
  const room = h.rooms.find((r) => r.id === roomId)
  if (!room) return { ok: false, reason: '没有这间房' }
  const refund = Math.floor(room.builtCost * 0.5 + room.upgradeSpent * 0.5)
  h.money += refund
  const ids = [...room.queue]
  for (const doctorId of room.doctorIds) {
    const doctor = h.doctors.find((d) => d.id === doctorId)
    if (doctor) doctor.roomId = null
  }
  h.rooms = h.rooms.filter((r) => r.id !== roomId)
  for (const id of ids) {
    const p = h.patients.find((x) => x.id === id)
    if (!p) continue
    p.inRoomId = null
    p.rage = Math.min(100, p.rage + 20)
    rerouteAfterSell(h, p, room.type)
  }
  for (const p of h.patients) {
    if (p.toRoomId !== roomId) continue
    if (p.state === 'done' || p.state === 'leave' || p.state === 'dead') continue
    p.toRoomId = null
    rerouteAfterSell(h, p, room.type)
  }
  for (const p of h.patients) {
    if (p.inRoomId !== roomId) continue
    if (p.state === 'done' || p.state === 'leave' || p.state === 'dead') continue
    p.inRoomId = null
    p.rage = Math.min(100, p.rage + 20)
    rerouteAfterSell(h, p, room.type)
  }
  return { ok: true }
}

function rerouteAfterSell(h: Hospital, p: Patient, type: RoomType) {
  const from = { r: Math.round(p.y), c: Math.round(p.x) }
  const next = pickOpenRoom(h, type, from, p)
  if (next) {
    p.toHall = false
    p.toDoor = false
    startWalkTo(h, p, roomTile(next, from), next.id, false, false)
    return
  }
  if (canOverflowToHall(h, type, p)) {
    const hall = pickOpenHall(h)
    if (hall) {
      startWalkTo(h, p, roomTile(hall, from), hall.id, true, false)
      return
    }
    if (p.rage >= RAGE_LEAVE_SOFT) {
      leavePatient(h, p)
      return
    }
    p.blocked = true
    p.state = 'walk'
    p.walkRemain = 0
    p.walkTotal = 0
    p.toRoomId = null
    p.toHall = false
    p.toDoor = false
    return
  }
  leavePatient(h, p)
}

export function upgradeQueue(h: Hospital, roomId: string): ActionResult {
  const room = h.rooms.find((r) => r.id === roomId)
  if (!room) return { ok: false, reason: '没有这间房' }
  if (room.levelFlags.queuePlus2) return { ok: false, reason: '已经升过' }
  if (h.money < UPGRADE_QUEUE) return { ok: false, reason: '钱不够' }
  h.money -= UPGRADE_QUEUE
  room.levelFlags.queuePlus2 = true
  room.upgradeSpent += UPGRADE_QUEUE
  return { ok: true }
}

export function upgradeDual(h: Hospital, roomId: string): ActionResult {
  const room = h.rooms.find((r) => r.id === roomId)
  if (!room) return { ok: false, reason: '没有这间房' }
  if (room.type === 'waiting') return { ok: false, reason: '候诊厅没有工位' }
  if (!isUnlocked(h, 'dual')) return { ok: false, reason: '尚未解锁' }
  if (room.levelFlags.dualStation) return { ok: false, reason: '已经升过' }
  if (h.money < UPGRADE_DUAL) return { ok: false, reason: '钱不够' }
  h.money -= UPGRADE_DUAL
  room.levelFlags.dualStation = true
  room.upgradeSpent += UPGRADE_DUAL
  return { ok: true }
}

export function upgradeCompact(h: Hospital, roomId: string): ActionResult {
  const room = h.rooms.find((r) => r.id === roomId)
  if (!room || room.type !== 'surgery') return { ok: false, reason: '只有手术室能紧凑' }
  if (!isUnlocked(h, 'compact')) return { ok: false, reason: '尚未解锁' }
  if (room.levelFlags.compact) return { ok: false, reason: '已经升过' }
  if (h.money < UPGRADE_COMPACT) return { ok: false, reason: '钱不够' }
  h.money -= UPGRADE_COMPACT
  room.levelFlags.compact = true
  room.upgradeSpent += UPGRADE_COMPACT
  room.tiles = [room.tiles[0]]
  return { ok: true }
}
