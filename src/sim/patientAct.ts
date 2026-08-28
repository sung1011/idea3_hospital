import { addFame, nurseCoef } from './query'
import { FAME_LEAVE, FAME_LEAVE_VIP, WALK_S_PER_TILE } from './tables'
import type { Hospital, Patient, Room } from './types'

export function refreshQueueStates(room: Room, h: Hospital) {
  room.queue.forEach((id, i) => {
    const p = h.patients.find((x) => x.id === id)
    if (!p) return
    if (room.type === 'waiting') p.state = 'waitHall'
    else p.state = i === 0 ? 'treat' : 'queue'
  })
}

export function pullFromRooms(h: Hospital, p: Patient) {
  for (const room of h.rooms) {
    if (!room.queue.includes(p.id)) continue
    room.queue = room.queue.filter((id) => id !== p.id)
    refreshQueueStates(room, h)
  }
}

export function startWalkTo(
  h: Hospital,
  p: Patient,
  dest: { r: number; c: number },
  roomId: string | null,
  toHall: boolean,
  toDoor: boolean,
) {
  const dist = Math.abs(p.y - dest.r) + Math.abs(p.x - dest.c)
  const duration = dist * WALK_S_PER_TILE * nurseCoef(h)
  p.state = 'walk'
  p.blocked = false
  p.inRoomId = null
  p.toRoomId = roomId
  p.toHall = toHall
  p.toDoor = toDoor
  p.walkFromX = p.x
  p.walkFromY = p.y
  p.walkToX = dest.c
  p.walkToY = dest.r
  p.walkRemain = duration
  p.walkTotal = duration
  p.tickInState = 0
}

export function leavePatient(h: Hospital, p: Patient) {
  pullFromRooms(h, p)
  addFame(h, p.disease === 'vip' ? -FAME_LEAVE_VIP : -FAME_LEAVE)
  h.leftCount += 1
  p.state = 'leave'
  p.blocked = false
  p.inRoomId = null
}
