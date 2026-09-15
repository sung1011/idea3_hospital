import { inGrid, isUnlocked, neighbors4, roomAt, tilesEqual } from './query'
import type { ActionResult, Hospital, Hot, Skill, SkillId, SkillShape, Tile } from './types'

export type SkillDef = {
  id: SkillId
  label: string
  shape: SkillShape
  amount: number
  cdS: number
  unlockAt: number
  length?: number
  durationS?: number
  everyS?: number
}

export const SKILL_DEF: Record<SkillId, SkillDef> = {
  disinfect: { id: 'disinfect', label: '消毒', shape: 'point', amount: 30, cdS: 20, unlockAt: 15 },
  flush: { id: 'flush', label: '冲洗', shape: 'line', amount: 15, cdS: 45, unlockAt: 30, length: 5 },
  spray: { id: 'spray', label: '喷雾', shape: 'aoe', amount: 20, cdS: 40, unlockAt: 50 },
  sustain: { id: 'sustain', label: '持续消毒', shape: 'hot', amount: 8, cdS: 30, unlockAt: 15, durationS: 10, everyS: 2 },
}

export const SKILL_IDS: SkillId[] = ['disinfect', 'flush', 'spray', 'sustain']

export function createSkills(): Skill[] {
  return SKILL_IDS.map((id) => {
    const def = SKILL_DEF[id]
    return { id, shape: def.shape, cdS: def.cdS, cdLeft: 0, unlocked: false }
  })
}

export function getSkill(h: Hospital, id: SkillId): Skill | undefined {
  return h.skills.find((s) => s.id === id)
}

export function lineTiles(origin: Tile, toward: Tile, length = 5): Tile[] {
  const dr = toward.r - origin.r
  const dc = toward.c - origin.c
  const tiles: Tile[] = []
  for (let i = 0; i < length; i++) {
    const tile = { r: origin.r + dr * i, c: origin.c + dc * i }
    if (!inGrid(tile)) break
    tiles.push(tile)
  }
  return tiles
}

export function aoeTiles(center: Tile): Tile[] {
  return [center, ...neighbors4(center)]
}

export function skillTiles(id: SkillId, origin: Tile, toward?: Tile): Tile[] {
  const def = SKILL_DEF[id]
  if (def.shape === 'line') {
    if (!toward) return []
    return lineTiles(origin, toward, def.length ?? 5)
  }
  if (def.shape === 'aoe') return aoeTiles(origin)
  return [origin]
}

function reducePollution(h: Hospital, tiles: Tile[], amount: number) {
  for (const tile of tiles) {
    const room = roomAt(h, tile)
    if (!room) continue
    room.pollution = Math.max(0, room.pollution - amount)
  }
}

export function canCast(h: Hospital, id: SkillId): ActionResult {
  const skill = getSkill(h, id)
  if (!skill) return { ok: false, reason: '没有这个技能' }
  if (!isUnlocked(h, id)) return { ok: false, reason: '尚未解锁' }
  if (skill.cdLeft > 0) return { ok: false, reason: '冷却中' }
  return { ok: true }
}

export function castSkill(h: Hospital, id: SkillId, origin: Tile, toward?: Tile): ActionResult {
  const check = canCast(h, id)
  if (!check.ok) return check
  if (!inGrid(origin)) return { ok: false, reason: '格子无效' }

  const def = SKILL_DEF[id]
  const skill = getSkill(h, id)!

  if (def.shape === 'line') {
    if (!toward || !inGrid(toward)) return { ok: false, reason: '再点相邻格定方向' }
    if (Math.abs(toward.r - origin.r) + Math.abs(toward.c - origin.c) !== 1) {
      return { ok: false, reason: '再点相邻格定方向' }
    }
    reducePollution(h, lineTiles(origin, toward, def.length ?? 5), def.amount)
  } else if (def.shape === 'aoe') {
    reducePollution(h, aoeTiles(origin), def.amount)
  } else if (def.shape === 'hot') {
    const durationS = def.durationS ?? 10
    const everyS = def.everyS ?? 2
    const existing = h.hots.find((hot) => tilesEqual(hot.tile, origin))
    if (existing) {
      existing.remainS = durationS
      existing.everyS = everyS
      existing.amount = def.amount
      existing.accS = 0
    } else {
      const hot: Hot = {
        tile: { ...origin },
        remainS: durationS,
        everyS,
        amount: def.amount,
        accS: 0,
      }
      h.hots.push(hot)
    }
  } else {
    reducePollution(h, [origin], def.amount)
  }

  skill.cdLeft = def.cdS
  return { ok: true }
}

export function stepSkills(h: Hospital) {
  for (const skill of h.skills) {
    if (skill.cdLeft > 0) skill.cdLeft -= 1
    skill.unlocked = isUnlocked(h, skill.id)
  }

  const next: Hot[] = []
  for (const hot of h.hots) {
    hot.remainS -= 1
    hot.accS += 1
    if (hot.accS >= hot.everyS) {
      hot.accS = 0
      reducePollution(h, [hot.tile], hot.amount)
    }
    if (hot.remainS > 0) next.push(hot)
  }
  h.hots = next
}
