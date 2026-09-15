import { inGrid, isUnlocked, manhattan, neighbors4, roomAt, tilesEqual } from './query'
import { SKILL_DEF, SKILL_ORDER } from './tables'
import type { ActionResult, Hospital, Skill, SkillId, Tile } from './types'

export function createSkills(discharged = 0): Skill[] {
  return SKILL_ORDER.map((id) => {
    const def = SKILL_DEF[id]
    return {
      id,
      shape: def.shape,
      cdS: def.cdS,
      cdLeft: 0,
      unlocked: discharged >= def.unlockAt,
    }
  })
}

export function skillOf(h: Hospital, id: SkillId): Skill | undefined {
  return h.skills.find((s) => s.id === id)
}

export function reducePollutionAt(h: Hospital, tile: Tile, amount: number) {
  const room = roomAt(h, tile)
  if (!room) return
  room.pollution = Math.max(0, room.pollution - amount)
}

export function lineTiles(origin: Tile, toward: Tile, maxLen = 5): Tile[] {
  const dr = toward.r - origin.r
  const dc = toward.c - origin.c
  if (manhattan(origin, toward) !== 1) return []
  const tiles: Tile[] = []
  for (let i = 0; i < maxLen; i++) {
    const tile = { r: origin.r + dr * i, c: origin.c + dc * i }
    if (!inGrid(tile)) break
    tiles.push(tile)
  }
  return tiles
}

export function aoeTiles(center: Tile): Tile[] {
  return [center, ...neighbors4(center)]
}

export function affectedTiles(skillId: SkillId, origin: Tile, toward?: Tile): Tile[] {
  const def = SKILL_DEF[skillId]
  if (def.shape === 'line') {
    if (!toward) return []
    return lineTiles(origin, toward, def.length ?? 5)
  }
  if (def.shape === 'aoe') return aoeTiles(origin)
  return inGrid(origin) ? [{ ...origin }] : []
}

export function useSkill(h: Hospital, skillId: SkillId, origin: Tile, toward?: Tile): ActionResult {
  const skill = skillOf(h, skillId)
  if (!skill) return { ok: false, reason: '没有这个技能' }
  if (!isUnlocked(h, skillId)) return { ok: false, reason: '尚未解锁' }
  if (skill.cdLeft > 0) return { ok: false, reason: '冷却中' }

  const def = SKILL_DEF[skillId]
  if (def.shape === 'line') {
    if (!toward) return { ok: false, reason: '再点相邻格定方向' }
    if (manhattan(origin, toward) !== 1) return { ok: false, reason: '要选相邻格定方向' }
  }

  const tiles = affectedTiles(skillId, origin, toward)
  if (def.shape === 'hot') {
    const tile = tiles[0] ?? origin
    const existing = h.hots.find((hot) => tilesEqual(hot.tile, tile))
    const remainS = def.durationS ?? 10
    const everyS = def.everyS ?? 2
    if (existing) {
      existing.remainS = remainS
      existing.everyS = everyS
      existing.amount = def.amount
      existing.waitS = everyS
    } else {
      h.hots.push({
        tile: { ...tile },
        remainS,
        everyS,
        amount: def.amount,
        waitS: everyS,
      })
    }
  } else {
    for (const tile of tiles) reducePollutionAt(h, tile, def.amount)
  }

  skill.cdLeft = skill.cdS
  skill.unlocked = true
  return { ok: true }
}

export function stepSkills(h: Hospital) {
  for (const skill of h.skills) {
    if (skill.cdLeft > 0) skill.cdLeft -= 1
    skill.unlocked = isUnlocked(h, skill.id)
  }
  const keep = []
  for (const hot of h.hots) {
    hot.remainS -= 1
    hot.waitS -= 1
    if (hot.waitS <= 0) {
      reducePollutionAt(h, hot.tile, hot.amount)
      hot.waitS = hot.everyS
    }
    if (hot.remainS > 0) keep.push(hot)
  }
  h.hots = keep
}
