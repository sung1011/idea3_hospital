import { applyErPath, cutsToFront, shouldMarkEr } from './er'
import {
  addFame,
  actualThroughput,
  doorTile,
  erDoorTile,
  fieldCount,
  hasReception,
  infectWeightMul,
  isUnlocked,
  manhattan,
  nearestRoom,
  nextId,
  nurseCoef,
  patientTile,
  pickOpenHall,
  pickOpenRoom,
  queueCap,
  roomTile,
  spawnInterval,
} from './query'
import { rand, roll } from './rng'
import {
  DISEASE,
  FAME_DEAD,
  MAX_FIELD,
  POLLUTE_DEAD,
  POLLUTE_INFECT,
  POLLUTE_SURGERY_FAIL,
  RAGE_EVERY_S,
  RAGE_HALL,
  RAGE_LEAVE_HARD,
  RAGE_LEAVE_SOFT,
  RAGE_QUEUE,
  RAGE_WALK,
  STAGE_EVERY_S,
  ER_SUCCESS_MUL,
  SUCCESS,
  WALK_S_PER_TILE,
} from './tables'
import { leavePatient, pullFromRooms, refreshQueueStates, startWalkTo } from './patientAct'
import type { DiseaseId, Hospital, Patient, Room } from './types'

export { leavePatient, startWalkTo } from './patientAct'

export function makePatient(h: Hospital, disease: DiseaseId, isEr = false): Patient {
  const door = isEr ? erDoorTile() : doorTile()
  return {
    id: nextId(h, 'p'),
    disease,
    path: [...DISEASE[disease].path],
    node: 0,
    state: 'walk',
    isEr,
    rage: 0,
    stage: 1,
    waitS: 0,
    tickInState: 0,
    x: door.c,
    y: door.r,
    walkFromX: door.c,
    walkFromY: door.r,
    walkToX: door.c,
    walkToY: door.r,
    walkRemain: 0,
    walkTotal: 0,
    inRoomId: null,
    toRoomId: null,
    toHall: false,
    toDoor: false,
    blocked: false,
  }
}

export function pickDisease(h: Hospital): DiseaseId | null {
  const pool: { id: DiseaseId; w: number }[] = []
  const ids: DiseaseId[] = ['cold', 'fracture', 'infectious', 'vip']
  for (const id of ids) {
    if (!isUnlocked(h, id)) continue
    let w = DISEASE[id].weight
    if (id === 'infectious') w *= infectWeightMul(h)
    if (w > 0) pool.push({ id, w })
  }
  if (pool.length === 0) return null
  const total = pool.reduce((s, x) => s + x.w, 0)
  let cursor = 0
  const at = h.rollMode === 'always' ? 0 : rand(h)
  for (const item of pool) {
    cursor += item.w / total
    if (at < cursor) return item.id
  }
  return pool[pool.length - 1].id
}

export function spawnPatient(h: Hospital, disease?: DiseaseId, isEr?: boolean): Patient | null {
  if (h.fame <= 0) return null
  if (!hasReception(h)) return null
  if (fieldCount(h) >= MAX_FIELD) return null
  const id = disease ?? pickDisease(h)
  if (!id) return null
  const er = isEr ?? shouldMarkEr(h)
  const p = makePatient(h, id, er)
  if (er) applyErPath(p)
  h.patients.push(p)
  routePatient(h, p)
  return p
}

export function routePatient(h: Hospital, p: Patient) {
  if (p.node >= p.path.length) {
    startWalkTo(h, p, doorTile(), null, false, true)
    return
  }
  const from = patientTile(p)
  const room = pickOpenRoom(h, p.path[p.node], from)
  if (room) {
    startWalkTo(h, p, roomTile(room, from), room.id, false, false)
    return
  }
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
}

function enterRoom(h: Hospital, p: Patient, room: Room) {
  p.blocked = false
  p.inRoomId = room.id
  p.toRoomId = null
  p.toHall = false
  p.x = room.tiles[0].c
  p.y = room.tiles[0].r
  p.tickInState = 0
  if (room.type === 'waiting') {
    room.queue.push(p.id)
    p.state = 'waitHall'
    return
  }
  if (cutsToFront(p, room.type)) room.queue.unshift(p.id)
  else room.queue.push(p.id)
  refreshQueueStates(room, h)
}

export function arrivePatient(h: Hospital, p: Patient) {
  p.x = p.walkToX
  p.y = p.walkToY
  p.walkRemain = 0
  if (p.toDoor) {
    dischargePatient(h, p)
    return
  }
  if (p.toRoomId) {
    const room = h.rooms.find((r) => r.id === p.toRoomId)
    if (!room) {
      routePatient(h, p)
      return
    }
    if (room.queue.length >= queueCap(room)) {
      routePatient(h, p)
      return
    }
    enterRoom(h, p, room)
    return
  }
  routePatient(h, p)
}

export function killPatient(h: Hospital, p: Patient) {
  pullFromRooms(h, p)
  addFame(h, -FAME_DEAD)
  h.deadCount += 1
  p.state = 'dead'
  p.blocked = false
  const from = patientTile(p)
  const room = p.inRoomId ? h.rooms.find((r) => r.id === p.inRoomId) : nearestRoom(h, from)
  if (room) room.pollution = Math.min(100, room.pollution + POLLUTE_DEAD)
  p.inRoomId = null
}

export function dischargePatient(h: Hospital, p: Patient) {
  const def = DISEASE[p.disease]
  h.money += def.money
  addFame(h, def.fame)
  h.discharged += 1
  p.state = 'done'
  p.inRoomId = null
}

export function rewriteInfectious(p: Patient) {
  const finished = p.path.slice(0, p.node)
  const current = p.path[p.node] ?? 'reception'
  const used = new Set([...finished, current])
  const rest = DISEASE.infectious.path.filter((t) => !used.has(t))
  p.path = [...finished, current, ...rest]
  p.disease = 'infectious'
}

export function stepSpawn(h: Hospital) {
  if (h.fame <= 0 || !hasReception(h) || fieldCount(h) >= MAX_FIELD) {
    h.spawnAcc = 0
    return
  }
  h.spawnAcc += 1
  const need = spawnInterval(h)
  if (h.spawnAcc >= need) {
    h.spawnAcc = 0
    spawnPatient(h)
  }
}

export function stepNeeds(h: Hospital) {
  for (const p of [...h.patients]) {
    if (p.state === 'done' || p.state === 'leave' || p.state === 'dead') continue
    p.waitS += 1
    p.tickInState += 1
    if (p.tickInState % RAGE_EVERY_S === 0) {
      if (p.state === 'queue') p.rage = Math.min(100, p.rage + RAGE_QUEUE)
      else if (p.state === 'walk') p.rage = Math.min(100, p.rage + RAGE_WALK)
      else if (p.state === 'waitHall') p.rage = Math.min(100, p.rage + RAGE_HALL)
    }
    if ((p.state === 'queue' || p.state === 'waitHall') && p.tickInState % STAGE_EVERY_S === 0) {
      p.stage = Math.min(3, p.stage + 1)
    }
    if (p.disease === 'infectious' && p.inRoomId && p.waitS % 20 === 0) {
      const room = h.rooms.find((r) => r.id === p.inRoomId)
      if (room) room.pollution = Math.min(100, room.pollution + POLLUTE_INFECT)
    }
    if (p.rage >= RAGE_LEAVE_HARD) {
      leavePatient(h, p)
      continue
    }
    if (p.stage >= 3 && !inCureRoom(h, p) && !inWard(h, p)) {
      killPatient(h, p)
    }
  }
}

function inCureRoom(h: Hospital, p: Patient): boolean {
  if (p.state !== 'treat' || !p.inRoomId) return false
  const room = h.rooms.find((r) => r.id === p.inRoomId)
  return !!room && (room.type === 'treatment' || room.type === 'surgery' || room.type === 'specialist')
}

function inWard(h: Hospital, p: Patient): boolean {
  if (!p.inRoomId) return false
  const room = h.rooms.find((r) => r.id === p.inRoomId)
  return room?.type === 'ward'
}

export function stepWard(h: Hospital) {
  if (h.elapsedS === 0 || h.elapsedS % 20 !== 0) return
  for (const room of h.rooms) {
    if (room.type !== 'ward') continue
    for (const id of [...room.queue]) {
      const p = h.patients.find((x) => x.id === id)
      if (!p || p.stage < 3) continue
      if (!roll(h, 0.5)) killPatient(h, p)
    }
  }
}

export function stepHalls(h: Hospital) {
  const waiting = h.rooms.filter((r) => r.type === 'waiting')
  const guests = waiting.flatMap((room) =>
    room.queue
      .map((id) => h.patients.find((p) => p.id === id))
      .filter((p): p is Patient => !!p),
  )
  guests.sort((a, b) => b.waitS - a.waitS)
  for (const p of guests) {
    const from = patientTile(p)
    const room = pickOpenRoom(h, p.path[p.node], from)
    if (!room) continue
    pullFromRooms(h, p)
    p.inRoomId = null
    startWalkTo(h, p, roomTile(room, from), room.id, false, false)
  }
}

export function stepWalk(h: Hospital) {
  for (const p of [...h.patients]) {
    if (p.state !== 'walk') continue
    if (p.blocked) {
      routePatient(h, p)
      continue
    }
    if (p.walkRemain <= 0) {
      arrivePatient(h, p)
      continue
    }
    p.walkRemain = Math.max(0, p.walkRemain - 1)
    const t = p.walkTotal <= 0 ? 1 : 1 - p.walkRemain / p.walkTotal
    p.x = p.walkFromX + (p.walkToX - p.walkFromX) * t
    p.y = p.walkFromY + (p.walkToY - p.walkFromY) * t
    if (p.walkRemain <= 0) arrivePatient(h, p)
  }
}

export function stepRooms(h: Hospital) {
  for (const room of h.rooms) {
    if (room.type === 'waiting') continue
    const th = actualThroughput(h, room)
    if (th <= 0 || room.queue.length === 0) continue
    room.progress += th / 60
    while (room.progress >= 1 && room.queue.length > 0) {
      room.progress -= 1
      const id = room.queue[0]
      const p = h.patients.find((x) => x.id === id)
      if (!p) {
        room.queue.shift()
        continue
      }
      finishInRoom(h, room, p)
    }
    refreshQueueStates(room, h)
  }
}

function finishInRoom(h: Hospital, room: Room, p: Patient) {
  const risky = room.type === 'treatment' || room.type === 'surgery' || room.type === 'specialist'
  if (risky && !treatOk(h, room, p)) {
    if (room.type === 'surgery') room.pollution = Math.min(100, room.pollution + POLLUTE_SURGERY_FAIL)
    if ((room.type === 'surgery' || room.type === 'specialist') && p.stage >= 3) {
      room.queue = room.queue.filter((id) => id !== p.id)
      killPatient(h, p)
      return
    }
    p.stage = Math.min(3, p.stage + 1)
    room.queue = room.queue.filter((id) => id !== p.id)
    room.queue.push(p.id)
    p.tickInState = 0
    return
  }
  room.queue = room.queue.filter((id) => id !== p.id)
  p.inRoomId = null
  p.node += 1
  routePatient(h, p)
}

export function treatChance(room: Room, p: Patient): number {
  let chance = 1
  if (room.type === 'treatment') chance = SUCCESS.treatment
  else if (room.type === 'surgery') chance = SUCCESS.surgery
  else if (room.type === 'specialist') chance = SUCCESS.specialist
  if (p.isEr && (room.type === 'treatment' || room.type === 'surgery')) chance *= ER_SUCCESS_MUL
  return chance
}

function treatOk(h: Hospital, room: Room, p: Patient): boolean {
  return roll(h, treatChance(room, p))
}

export function sweepGone(h: Hospital) {
  h.patients = h.patients.filter((p) => p.state !== 'done' && p.state !== 'leave' && p.state !== 'dead')
}

export function walkDuration(h: Hospital, from: { r: number; c: number }, to: { r: number; c: number }): number {
  return manhattan(from, to) * WALK_S_PER_TILE * nurseCoef(h)
}
