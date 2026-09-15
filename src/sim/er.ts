import { isUnlocked } from './query'
import { ER_CHANCE, ER_CLOSE_REFUND, ER_OPEN_COST } from './tables'
import { rand } from './rng'
import type { ActionResult, DiseaseId, Hospital, Patient, RoomType } from './types'

export function erInsertType(disease: DiseaseId): 'treatment' | 'surgery' {
  return disease === 'fracture' ? 'surgery' : 'treatment'
}

/** 跳过前台和诊断，从治疗/手术起走该病剩余节点。 */
export function applyErPath(p: Patient) {
  const insert = erInsertType(p.disease)
  const skip = new Set<RoomType>(['reception', 'diagnosis'])
  const rest = p.path.filter((t) => !skip.has(t))
  const idx = rest.indexOf(insert)
  p.path = idx >= 0 ? rest.slice(idx) : [insert, ...rest]
  p.node = 0
}

/** 特殊病人只跳过前台，插到路径下一环队头，不跳专科。 */
export function applySpecialErPath(p: Patient) {
  if (p.path[0] === 'reception') {
    p.path = p.path.slice(1)
    p.node = 0
  }
}

export function shouldMarkEr(h: Hospital): boolean {
  if (!h.erOpen) return false
  return rand(h) < ER_CHANCE
}

export function cutsToFront(p: Patient, roomType: RoomType): boolean {
  if (p.disease === 'vip') return true
  if (p.isSpecial && p.isEr) return p.node === 0 && roomType === p.path[0]
  return p.isEr && roomType === erInsertType(p.disease)
}

export function setErOpen(h: Hospital, open: boolean): ActionResult {
  if (!isUnlocked(h, 'er')) return { ok: false, reason: '急诊口尚未解锁' }
  if (open === h.erOpen) return { ok: false, reason: open ? '急诊口已开' : '急诊口已关' }
  if (open) {
    if (h.money < ER_OPEN_COST) return { ok: false, reason: '钱不够' }
    h.money -= ER_OPEN_COST
    h.erOpen = true
  } else {
    h.money += ER_CLOSE_REFUND
    h.erOpen = false
  }
  return { ok: true }
}

export function toggleEr(h: Hospital): ActionResult {
  return setErOpen(h, !h.erOpen)
}
