import { nextId, nurseCoef, stationSlots } from './query'
import { HIRE_DOCTOR, HIRE_NURSE, MAX_NURSES, START_NURSES } from './tables'
import type { ActionResult, Hospital } from './types'

function rescaleWalks(h: Hospital, prevCoef: number) {
  const next = nurseCoef(h)
  if (prevCoef <= 0 || prevCoef === next) return
  const ratio = next / prevCoef
  for (const p of h.patients) {
    if (p.state !== 'walk' || p.blocked) continue
    p.walkRemain *= ratio
    p.walkTotal *= ratio
  }
}

export function hireDoctor(h: Hospital): ActionResult {
  if (h.money < HIRE_DOCTOR) return { ok: false, reason: '钱不够' }
  h.money -= HIRE_DOCTOR
  h.doctors.push({ id: nextId(h, 'doc'), roomId: null, hireCost: HIRE_DOCTOR })
  return { ok: true }
}

export function hireNurse(h: Hospital): ActionResult {
  if (h.nurses >= MAX_NURSES) return { ok: false, reason: '护士满了' }
  if (h.money < HIRE_NURSE) return { ok: false, reason: '钱不够' }
  const prev = nurseCoef(h)
  h.money -= HIRE_NURSE
  h.nurses += 1
  rescaleWalks(h, prev)
  return { ok: true }
}

export function fireDoctor(h: Hospital, doctorId: string): ActionResult {
  const doctor = h.doctors.find((d) => d.id === doctorId)
  if (!doctor) return { ok: false, reason: '没有这个人' }
  if (doctor.roomId) {
    const room = h.rooms.find((r) => r.id === doctor.roomId)
    if (room) room.doctorIds = room.doctorIds.filter((id) => id !== doctor.id)
  }
  h.money += Math.floor(doctor.hireCost * 0.5)
  h.doctors = h.doctors.filter((d) => d.id !== doctor.id)
  return { ok: true }
}

export function fireNurse(h: Hospital): ActionResult {
  if (h.nurses <= 0) return { ok: false, reason: '没有护士' }
  const refund = h.nurses > START_NURSES ? Math.floor(HIRE_NURSE * 0.5) : 0
  const prev = nurseCoef(h)
  h.nurses -= 1
  h.money += refund
  rescaleWalks(h, prev)
  return { ok: true }
}

export function assignDoctor(h: Hospital, doctorId: string, roomId: string): ActionResult {
  const doctor = h.doctors.find((d) => d.id === doctorId)
  const room = h.rooms.find((r) => r.id === roomId)
  if (!doctor || !room) return { ok: false, reason: '找不到人或房' }
  if (room.type === 'waiting') return { ok: false, reason: '候诊厅不能派医生' }
  if (room.doctorIds.length >= stationSlots(room)) return { ok: false, reason: '工位满了' }
  if (doctor.roomId) {
    const old = h.rooms.find((r) => r.id === doctor.roomId)
    if (old) old.doctorIds = old.doctorIds.filter((id) => id !== doctor.id)
  }
  doctor.roomId = room.id
  room.doctorIds.push(doctor.id)
  return { ok: true }
}

export function unassignDoctor(h: Hospital, doctorId: string): ActionResult {
  const doctor = h.doctors.find((d) => d.id === doctorId)
  if (!doctor || !doctor.roomId) return { ok: false, reason: '没在岗' }
  const room = h.rooms.find((r) => r.id === doctor.roomId)
  if (room) room.doctorIds = room.doctorIds.filter((id) => id !== doctor.id)
  doctor.roomId = null
  return { ok: true }
}

export function idleDoctors(h: Hospital) {
  return h.doctors.filter((d) => !d.roomId)
}
