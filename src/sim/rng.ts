import type { Hospital } from './types'

export function rand(h: Hospital): number {
  h.rng = (Math.imul(h.rng, 1664525) + 1013904223) >>> 0
  return h.rng / 4294967296
}

export function randInt(h: Hospital, min: number, max: number): number {
  return min + Math.floor(rand(h) * (max - min + 1))
}

export function pick<T>(h: Hospital, list: T[]): T {
  return list[Math.floor(rand(h) * list.length)]
}

export function roll(h: Hospital, chance: number): boolean {
  if (h.rollMode === 'always') return true
  if (h.rollMode === 'never') return false
  return rand(h) < chance
}
