import { createSkills } from '../sim/skills'
import type { Hospital } from '../sim/types'

export const SAVE_KEY = 'idea3Hospital'

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

export function loadHospital(): Hospital | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Hospital
    if (!parsed || typeof parsed.lastTick !== 'number' || !Array.isArray(parsed.rooms)) return null
    if (!Array.isArray(parsed.skills)) parsed.skills = createSkills()
    if (!Array.isArray(parsed.hots)) parsed.hots = []
    if (!Array.isArray(parsed.buffs)) parsed.buffs = []
    if (!Array.isArray(parsed.patients)) parsed.patients = []
    if (!Array.isArray(parsed.doctors)) parsed.doctors = []
    if (typeof parsed.erOpen !== 'boolean') parsed.erOpen = false
    return parsed
  } catch {
    return null
  }
}

export function saveHospital(h: Hospital) {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(h))
  } catch {
    // quota / private mode
  }
}
