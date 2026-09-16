import {
  DOOR,
  ER_DOOR,
  GRID_SIZE,
  NURSE_WALK_FLOOR,
  NURSE_WALK_STEP,
  ROOM_DEF,
  SPAWN_BASE_S,
  SPAWN_MIN_S,
  UNLOCK_AT,
  UNLOCK_LABEL,
} from './tables'
import type { Hospital, Patient, Room, RoomType, Tile, UnlockKey } from './types'

export function nextId(h: Hospital, prefix: string): string {
  h.nextId += 1
  return `${prefix}-${h.nextId}`
}

export function clampFame(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export function addFame(h: Hospital, delta: number) {
  h.fame = clampFame(h.fame + delta)
}

export function isUnlocked(h: Hospital, key: UnlockKey): boolean {
  return UNLOCK_AT.some((row) => h.discharged >= row.at && row.keys.includes(key))
}

export function unlockAt(key: UnlockKey): number {
  return UNLOCK_AT.find((row) => row.keys.includes(key))?.at ?? 0
}

export function nextUnlock(h: Hospital): { at: number; keys: UnlockKey[] } | null {
  return UNLOCK_AT.find((row) => h.discharged < row.at) ?? null
}

export function nextUnlockHint(h: Hospital): string | null {
  const row = nextUnlock(h)
  if (!row) return null
  const names = row.keys.map((k) => UNLOCK_LABEL[k]).filter((s): s is string => !!s)
  if (!names.length) return `再出院 ${row.at - h.discharged} 人解锁下一档`
  return `下一档 ${row.at} 出院 · ${names.join(' / ')}`
}

export function nurseCoef(nursesOrHospital: number | Hospital): number {
  const nurses = typeof nursesOrHospital === 'number' ? nursesOrHospital : nursesOrHospital.nurses
  return Math.max(NURSE_WALK_FLOOR, 1 - NURSE_WALK_STEP * nurses)
}

export function nurseWalkLabel(nursesOrHospital: number | Hospital): string {
  return `走路 ×${nurseCoef(nursesOrHospital).toFixed(2)}`
}

export function manhattan(a: Tile, b: Tile): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c)
}

export function tilesEqual(a: Tile, b: Tile): boolean {
  return a.r === b.r && a.c === b.c
}

export function inGrid(t: Tile): boolean {
  return t.r >= 0 && t.r < GRID_SIZE && t.c >= 0 && t.c < GRID_SIZE
}

export function neighbors4(t: Tile): Tile[] {
  return [
    { r: t.r - 1, c: t.c },
    { r: t.r + 1, c: t.c },
    { r: t.r, c: t.c - 1 },
    { r: t.r, c: t.c + 1 },
  ].filter(inGrid)
}

export function occupied(h: Hospital): Set<string> {
  const set = new Set<string>()
  for (const room of h.rooms) {
    for (const tile of room.tiles) set.add(`${tile.r},${tile.c}`)
  }
  return set
}

export function roomAt(h: Hospital, tile: Tile): Room | undefined {
  return h.rooms.find((room) => room.tiles.some((t) => tilesEqual(t, tile)))
}

export function queueCap(room: Room): number {
  return ROOM_DEF[room.type].queueCap + (room.levelFlags.queuePlus2 ? 2 : 0)
}

export function stationSlots(room: Room): number {
  if (room.type === 'waiting') return 0
  return room.levelFlags.dualStation ? 2 : 1
}

export function roomTile(room: Room, from: Tile): Tile {
  return room.tiles.slice().sort((a, b) => manhattan(from, a) - manhattan(from, b))[0]
}

export function patientTile(p: { x: number; y: number }): Tile {
  return { r: Math.round(p.y), c: Math.round(p.x) }
}

export function pollutionCoef(pollution: number): number {
  if (pollution <= 30) return 1
  const steps = Math.floor((pollution - 30) / 10)
  return Math.max(0.4, 0.9 ** steps)
}

export function doctorSpeed(h: Hospital): number {
  return h.buffs.reduce((mul, b) => (b.kind === 'doctorSpeed' ? mul * b.mul : mul), 1)
}

export function roomThroughputMul(h: Hospital, roomId: string): number {
  return h.buffs.reduce(
    (mul, b) => (b.kind === 'roomThroughput' && b.roomId === roomId ? mul * b.mul : mul),
    1,
  )
}

export function isVacant(h: Hospital, roomId: string): boolean {
  return h.buffs.some((b) => b.kind === 'roomVacant' && b.roomId === roomId)
}

export function actualThroughput(h: Hospital, room: Room): number {
  if (room.type === 'waiting') return 0
  if (isVacant(h, room.id)) return 0
  const stations = new Set(room.doctorIds).size
  if (stations === 0) return 0
  return (
    ROOM_DEF[room.type].throughput *
    doctorSpeed(h) *
    pollutionCoef(room.pollution) *
    stations *
    roomThroughputMul(h, room.id)
  )
}

export function spawnInterval(h: Hospital): number {
  const fromFame = Math.max(SPAWN_MIN_S, SPAWN_BASE_S - Math.floor(h.fame / 10))
  const mul = h.buffs.reduce((m, b) => (b.kind === 'spawnInterval' ? m * b.mul : m), 1)
  return fromFame * mul
}

export function infectWeightMul(h: Hospital): number {
  const fromBuffs = h.buffs.reduce((m, b) => (b.kind === 'infectWeight' ? m * b.mul : m), 1)
  return fromBuffs * (h.week?.infectMul ?? 1)
}

export function fieldCount(h: Hospital): number {
  return h.patients.filter((p) => p.state === 'walk' || p.state === 'queue' || p.state === 'treat' || p.state === 'waitHall')
    .length
}

export function hasReception(h: Hospital): boolean {
  return h.rooms.some((r) => r.type === 'reception')
}

export function roomsOf(h: Hospital, type: RoomType): Room[] {
  return h.rooms.filter((r) => r.type === type)
}

export function canEnterSpecialist(room: Room, p: Patient): boolean {
  if (room.type !== 'specialist') return false
  if (!p.isSpecial) return false
  if (p.recipeId && room.recipeId !== p.recipeId) return false
  if (p.recipeId === 'continue' && p.transferCount < 1) return false
  return true
}

export function enterableRooms(h: Hospital, type: RoomType, p?: Patient): Room[] {
  return roomsOf(h, type).filter((r) => {
    if (type === 'specialist' && p?.isSpecial && !canEnterSpecialist(r, p)) return false
    return true
  })
}

export function pickOpenRoom(h: Hospital, type: RoomType, from: Tile, p?: Patient): Room | undefined {
  const open = enterableRooms(h, type, p).filter((r) => r.queue.length < queueCap(r))
  open.sort((a, b) => manhattan(from, roomTile(a, from)) - manhattan(from, roomTile(b, from)))
  return open[0]
}

/** 候诊厅只接「下一环存在但队满」。缺房 / 专科进不去不溢入。 */
export function canOverflowToHall(h: Hospital, type: RoomType, p?: Patient): boolean {
  const dests = enterableRooms(h, type, p)
  return dests.length > 0 && dests.every((r) => r.queue.length >= queueCap(r))
}

export function pickOpenHall(h: Hospital): Room | undefined {
  return roomsOf(h, 'waiting').find((r) => r.queue.length < queueCap(r))
}

export function nearestRoom(h: Hospital, from: Tile): Room | undefined {
  if (h.rooms.length === 0) return undefined
  return h.rooms.slice().sort((a, b) => manhattan(from, roomTile(a, from)) - manhattan(from, roomTile(b, from)))[0]
}

export function roomsAdjacent(a: Room, b: Room): boolean {
  return a.tiles.some((t) => b.tiles.some((u) => manhattan(t, u) === 1))
}

export function doorTile(): Tile {
  return { ...DOOR }
}

export function erDoorTile(): Tile {
  return { ...ER_DOOR }
}
