import { createSkills, SKILL_IDS } from '../sim/skills'
import { EVENT_IDS, PLAYER_ID, START_FAME, START_MONEY, START_NURSES } from '../sim/tables'
import type { Doctor, EventId, Hospital, Hot, Patient, Room, Skill, WeekMatch } from '../sim/types'

export const SAVE_KEY = 'idea3Hospital'

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function migrateRoom(raw: unknown, index: number): Room | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Room>
  if (!r.type || !Array.isArray(r.tiles) || r.tiles.length === 0) return null
  const flags =
    r.levelFlags && typeof r.levelFlags === 'object'
      ? (r.levelFlags as Partial<Room['levelFlags']>)
      : {}
  return {
    id: typeof r.id === 'string' && r.id ? r.id : `room-m${index}`,
    type: r.type,
    tiles: r.tiles.map((t) => ({ r: num(t?.r, 0), c: num(t?.c, 0) })),
    levelFlags: {
      queuePlus2: bool(flags.queuePlus2, false),
      dualStation: bool(flags.dualStation, false),
      compact: bool(flags.compact, false),
    },
    doctorIds: Array.isArray(r.doctorIds) ? r.doctorIds.filter((id): id is string => typeof id === 'string') : [],
    queue: Array.isArray(r.queue) ? r.queue.filter((id): id is string => typeof id === 'string') : [],
    pollution: Math.max(0, Math.min(100, num(r.pollution, 0))),
    builtCost: Math.max(0, num(r.builtCost, 0)),
    upgradeSpent: Math.max(0, num(r.upgradeSpent, 0)),
    progress: Math.max(0, num(r.progress, 0)),
    recipeId: r.recipeId,
  }
}

function migrateDoctor(raw: unknown, index: number): Doctor | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<Doctor>
  if (typeof d.id !== 'string' || !d.id) return null
  return {
    id: d.id || `doc-m${index}`,
    roomId: typeof d.roomId === 'string' ? d.roomId : null,
    hireCost: Math.max(0, num(d.hireCost, 0)),
  }
}

function migratePatient(raw: unknown): Patient | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<Patient>
  if (typeof p.id !== 'string' || !p.id || !p.disease || !Array.isArray(p.path)) return null
  return {
    id: p.id,
    disease: p.disease,
    path: p.path,
    node: Math.max(0, num(p.node, 0)),
    state: p.state ?? 'walk',
    isEr: bool(p.isEr, false),
    rage: Math.max(0, Math.min(100, num(p.rage, 0))),
    stage: Math.max(1, Math.min(3, num(p.stage, 1))),
    waitS: Math.max(0, num(p.waitS, 0)),
    tickInState: Math.max(0, num(p.tickInState, 0)),
    x: num(p.x, 0),
    y: num(p.y, 0),
    walkFromX: num(p.walkFromX, num(p.x, 0)),
    walkFromY: num(p.walkFromY, num(p.y, 0)),
    walkToX: num(p.walkToX, num(p.x, 0)),
    walkToY: num(p.walkToY, num(p.y, 0)),
    walkRemain: Math.max(0, num(p.walkRemain, 0)),
    walkTotal: Math.max(0, num(p.walkTotal, 0)),
    inRoomId: typeof p.inRoomId === 'string' ? p.inRoomId : null,
    toRoomId: typeof p.toRoomId === 'string' ? p.toRoomId : null,
    toHall: bool(p.toHall, false),
    toDoor: bool(p.toDoor, false),
    blocked: bool(p.blocked, false),
    isSpecial: bool(p.isSpecial, false),
    specialId: p.specialId,
    recipeId: p.recipeId,
    visitLog: Array.isArray(p.visitLog) ? p.visitLog.filter((id): id is string => typeof id === 'string') : [],
    transferCount: Math.max(0, num(p.transferCount, 0)),
    weekSettled: p.weekSettled,
  }
}

function migrateSkills(raw: unknown): Skill[] {
  const list = Array.isArray(raw) ? raw : []
  const byId = new Map<string, Skill>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const s = item as Skill
    if (typeof s.id === 'string') byId.set(s.id, s)
  }
  return createSkills().map((fresh) => {
    const old = byId.get(fresh.id)
    if (!old) return fresh
    return {
      ...fresh,
      cdLeft: Math.max(0, num(old.cdLeft, 0)),
      unlocked: bool(old.unlocked, fresh.unlocked),
    }
  }).filter((s) => SKILL_IDS.includes(s.id))
}

function migrateHots(raw: unknown): Hot[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const hot = item as Partial<Hot>
      if (!hot.tile || typeof hot.tile !== 'object') return null
      return {
        tile: { r: num(hot.tile.r, 0), c: num(hot.tile.c, 0) },
        remainS: Math.max(0, num(hot.remainS, 0)),
        everyS: Math.max(1, num(hot.everyS, 2)),
        amount: Math.max(0, num(hot.amount, 0)),
        accS: Math.max(0, num(hot.accS, 0)),
      }
    })
    .filter((hot): hot is Hot => !!hot)
}

function migrateWeek(raw: unknown, now: number): WeekMatch | null {
  if (!raw || typeof raw !== 'object') return null
  const w = raw as Partial<WeekMatch>
  if (!Array.isArray(w.rivals) || !Array.isArray(w.hospitalIds) || !w.recipeId) return null
  const rivals = w.rivals
    .map((rival) => migrateHospital(rival, now, { nested: true }))
    .filter((rival): rival is Hospital => !!rival)
  return {
    weekId: Math.max(1, num(w.weekId, 1)),
    recipeId: w.recipeId,
    startedAt: num(w.startedAt, now),
    endsAt: num(w.endsAt, now + 1),
    nextSpawnAt: num(w.nextSpawnAt, now),
    spawned: Math.max(0, num(w.spawned, 0)),
    hospitalIds: w.hospitalIds.filter((id): id is string => typeof id === 'string'),
    scores: Array.isArray(w.scores) ? w.scores.map((s) => num(s, 0)) : [0, 0, 0, 0],
    cityQueue: Array.isArray(w.cityQueue) ? w.cityQueue : [],
    pendingOfferId: typeof w.pendingOfferId === 'string' ? w.pendingOfferId : null,
    pendingRecipeId: w.pendingRecipeId ?? w.recipeId,
    infectMul: num(w.infectMul, 1),
    pendingInfectMul: num(w.pendingInfectMul, 1),
    rivals,
    lastResult: Array.isArray(w.lastResult) ? w.lastResult : null,
  }
}

export function migrateHospital(
  raw: unknown,
  now = Date.now(),
  opts: { nested?: boolean } = {},
): Hospital | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<Hospital>
  if (!Array.isArray(parsed.rooms)) return null

  const rooms = parsed.rooms.map((room, i) => migrateRoom(room, i)).filter((room): room is Room => !!room)
  const doctors = (Array.isArray(parsed.doctors) ? parsed.doctors : [])
    .map((d, i) => migrateDoctor(d, i))
    .filter((d): d is Doctor => !!d)
  const patients = (Array.isArray(parsed.patients) ? parsed.patients : [])
    .map((p) => migratePatient(p))
    .filter((p): p is Patient => !!p)

  const lastTick = num(parsed.lastTick, 0)
  const pendingEvent =
    typeof parsed.pendingEvent === 'string' && (EVENT_IDS as string[]).includes(parsed.pendingEvent)
      ? (parsed.pendingEvent as EventId)
      : null

  const hospital: Hospital = {
    id: typeof parsed.id === 'string' && parsed.id ? parsed.id : PLAYER_ID,
    money: num(parsed.money, START_MONEY),
    fame: Math.max(0, Math.min(100, num(parsed.fame, START_FAME))),
    nurses: Math.max(0, num(parsed.nurses, START_NURSES)),
    doctors,
    rooms,
    patients,
    lastTick: lastTick > 0 ? lastTick : now,
    elapsedS: Math.max(0, num(parsed.elapsedS, 0)),
    spawnAcc: Math.max(0, num(parsed.spawnAcc, 0)),
    nextId: Math.max(0, num(parsed.nextId, doctors.length)),
    rng: num(parsed.rng, 1) || 1,
    rollMode: parsed.rollMode === 'always' || parsed.rollMode === 'never' ? parsed.rollMode : 'rand',
    discharged: Math.max(0, num(parsed.discharged, 0)),
    leftCount: Math.max(0, num(parsed.leftCount, 0)),
    deadCount: Math.max(0, num(parsed.deadCount, 0)),
    erOpen: bool(parsed.erOpen, false),
    interceptUsed: bool(parsed.interceptUsed, false),
    pendingEvent,
    eventIn: Math.max(0, num(parsed.eventIn, 90)),
    buffs: Array.isArray(parsed.buffs) ? parsed.buffs : [],
    skills: migrateSkills(parsed.skills),
    hots: migrateHots(parsed.hots),
    week: opts.nested ? null : migrateWeek(parsed.week, now),
  }
  return hospital
}

export function loadHospital(): Hospital | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return migrateHospital(JSON.parse(raw))
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
