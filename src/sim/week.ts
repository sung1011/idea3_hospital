import { applySpecialErPath } from './er'
import { makePatient, routePatient } from './flow'
import { applyRecipeToHospital, createNpcHospital } from './npcLayouts'
import { leavePatient, pullFromRooms } from './patientAct'
import {
  addFame,
  canEnterSpecialist,
  isUnlocked,
  nextId,
  roomsOf,
} from './query'
import { randInt } from './rng'
import { RECEPTION_COLS, GRID_SIZE } from './tables'
import {
  CITY_FAIL_INFECT_MUL,
  CITY_SPECIALS,
  FAME_CITY_FAIL,
  HOSPITAL_LABEL,
  INTERCEPT_FAME,
  INTERCEPT_POLLUTE,
  INTERCEPT_RAGE,
  NPC_IDS,
  OFFER_DEADLINE_MS,
  RECIPE,
  RECIPE_ORDER,
  SPECIAL_FAIL_FEE,
  SPECIAL_SPAWN_MAX_MS,
  SPECIAL_SPAWN_MIN_MS,
  SPECIAL_TRANSFER_FEE,
  TRANSFER_CAP,
  WEEK_MS,
  WEEK_REWARDS,
} from './tables'
import { applyTick, tick, type TickOpts } from './tick'
import type {
  ActionResult,
  CityPatient,
  Hospital,
  OfferChoice,
  Patient,
  RecipeId,
  WeekMatch,
  WeekRank,
} from './types'

export { canEnterSpecialist }

export function hospitalOf(owner: Hospital, id: string): Hospital | null {
  if (owner.id === id) return owner
  return owner.week?.rivals.find((r) => r.id === id) ?? null
}

export function allHospitals(owner: Hospital): Hospital[] {
  return owner.week ? [owner, ...owner.week.rivals] : [owner]
}

export function pendingOffer(h: Hospital): CityPatient | null {
  if (!h.week?.pendingOfferId) return null
  return h.week.cityQueue.find((c) => c.specialId === h.week!.pendingOfferId) ?? null
}

export function weekRemainingMs(h: Hospital, now = Date.now()): number {
  if (!h.week) return 0
  return Math.max(0, h.week.endsAt - now)
}

export function recipeName(id: RecipeId): string {
  return RECIPE[id].name
}

function scoreIndex(week: WeekMatch, hospitalId: string): number {
  return week.hospitalIds.indexOf(hospitalId)
}

function addWeekScore(week: WeekMatch, hospitalId: string, score: number) {
  const i = scoreIndex(week, hospitalId)
  if (i >= 0) week.scores[i] += score
}

function layoutFits(h: Hospital, city: CityPatient): boolean {
  const need = RECIPE[city.recipeId].path
  const types = new Set(h.rooms.map((r) => r.type))
  if (need.some((t) => !types.has(t))) return false
  if (city.recipeId === 'continue' && city.transferCount < 1) return false
  const spec = h.rooms.find((r) => r.type === 'specialist')
  return !!spec && spec.recipeId === city.recipeId
}

export function makeSpecialPatient(h: Hospital, city: CityPatient): Patient {
  const p = makePatient(h, 'special', h.erOpen)
  p.isSpecial = true
  p.specialId = city.specialId
  p.recipeId = city.recipeId
  p.visitLog = [...city.visitLog]
  p.transferCount = city.transferCount
  p.path = [...RECIPE[city.recipeId].path]
  p.node = 0
  p.weekSettled = false
  if (p.isEr) applySpecialErPath(p)
  return p
}

export function admitSpecial(dest: Hospital, city: CityPatient, _owner: Hospital): Patient {
  if (!city.visitLog.includes(dest.id)) city.visitLog.push(dest.id)
  city.currentHospitalId = dest.id
  const p = makeSpecialPatient(dest, city)
  dest.patients.push(p)
  routePatient(dest, p)
  return p
}

function npcGrab(owner: Hospital, city: CityPatient) {
  if (!owner.week) return
  const rivals = owner.week.rivals.filter((r) => !city.visitLog.includes(r.id))
  const dest = rivals.find((r) => layoutFits(r, city)) ?? rivals[0]
  if (!dest) {
    city.currentHospitalId = null
    return
  }
  admitSpecial(dest, city, owner)
}

function cityWipe(owner: Hospital, city: CityPatient) {
  if (!owner.week) return
  owner.week.cityQueue = owner.week.cityQueue.filter((c) => c.specialId !== city.specialId)
  if (owner.week.pendingOfferId === city.specialId) owner.week.pendingOfferId = null
  owner.week.pendingInfectMul = CITY_FAIL_INFECT_MUL
  for (const hosp of allHospitals(owner)) addFame(hosp, -FAME_CITY_FAIL)
}

function transferSpecial(owner: Hospital, city: CityPatient) {
  if (!owner.week) return
  city.transferCount += 1
  city.currentHospitalId = null
  if (city.transferCount >= TRANSFER_CAP) {
    cityWipe(owner, city)
    return
  }
  const nextId = owner.week.hospitalIds.find((id) => !city.visitLog.includes(id))
  if (!nextId) {
    cityWipe(owner, city)
    return
  }
  const dest = hospitalOf(owner, nextId)
  if (!dest) {
    cityWipe(owner, city)
    return
  }
  admitSpecial(dest, city, owner)
}

export function resolveSpecials(owner: Hospital) {
  if (!owner.week) return
  const finished: { hosp: Hospital; p: Patient }[] = []
  for (const hosp of allHospitals(owner)) {
    for (const p of hosp.patients) {
      if (!p.isSpecial || p.weekSettled) continue
      if (p.state === 'done' || p.state === 'leave' || p.state === 'dead') finished.push({ hosp, p })
    }
  }
  for (const { hosp, p } of finished) {
    p.weekSettled = true
    const city = owner.week.cityQueue.find((c) => c.specialId === p.specialId)
    if (!city) continue
    if (p.state === 'done') {
      const recipe = p.recipeId ? RECIPE[p.recipeId] : RECIPE[owner.week.recipeId]
      addWeekScore(owner.week, hosp.id, recipe.score)
      owner.week.cityQueue = owner.week.cityQueue.filter((c) => c.specialId !== city.specialId)
      if (owner.week.pendingOfferId === city.specialId) owner.week.pendingOfferId = null
      continue
    }
    transferSpecial(owner, city)
  }
}

export function tickRivals(owner: Hospital, opts: TickOpts = {}) {
  if (!owner.week) return
  for (const rival of owner.week.rivals) {
    applyTick(rival, { ...opts, spawnEvents: false })
  }
  resolveSpecials(owner)
}

function spawnCityPatient(h: Hospital, now: number) {
  if (!h.week) return
  if (h.week.spawned >= CITY_SPECIALS) return
  const city: CityPatient = {
    specialId: `sp-${h.week.weekId}-${h.week.spawned + 1}`,
    recipeId: h.week.recipeId,
    visitLog: [],
    transferCount: 0,
    currentHospitalId: null,
    offerDeadline: now + OFFER_DEADLINE_MS,
  }
  h.week.cityQueue.push(city)
  h.week.spawned += 1
  h.week.nextSpawnAt = now + randInt(h, SPECIAL_SPAWN_MIN_MS, SPECIAL_SPAWN_MAX_MS)
  if (!h.week.pendingOfferId) h.week.pendingOfferId = city.specialId
}

function spawnDue(h: Hospital, now: number) {
  if (!h.week) return
  let guard = 0
  while (h.week.spawned < CITY_SPECIALS && now >= h.week.nextSpawnAt && guard++ < CITY_SPECIALS) {
    spawnCityPatient(h, now)
  }
}

export function backfillWeekOffer(h: Hospital, now = Date.now()): boolean {
  if (!h.week || h.week.pendingOfferId) return false
  const waiting = h.week.cityQueue.find(
    (c) => !c.currentHospitalId && !c.visitLog.includes(h.id),
  )
  if (!waiting) return false
  h.week.pendingOfferId = waiting.specialId
  waiting.offerDeadline = now + OFFER_DEADLINE_MS
  return true
}

function expireOffers(h: Hospital, now: number) {
  if (!h.week) return
  const pending = pendingOffer(h)
  if (pending && now >= pending.offerDeadline) {
    chooseOffer(h, 'transfer')
  }
  if (!h.week) return
  for (const city of [...h.week.cityQueue]) {
    if (city.currentHospitalId) continue
    if (city.specialId === h.week.pendingOfferId) continue
    if (now >= city.offerDeadline) npcGrab(h, city)
  }
}

function rankWeek(week: WeekMatch): WeekRank[] {
  const rows = week.hospitalIds.map((id, i) => ({ id, score: week.scores[i] ?? 0, place: 0 }))
  rows.sort((a, b) => b.score - a.score || week.hospitalIds.indexOf(a.id) - week.hospitalIds.indexOf(b.id))
  rows.forEach((row, i) => {
    row.place = i + 1
  })
  return rows
}

function applyRewards(owner: Hospital, ranks: WeekRank[]) {
  for (const row of ranks) {
    const reward = WEEK_REWARDS[row.place - 1]
    if (!reward) continue
    const hosp = hospitalOf(owner, row.id)
    if (!hosp) continue
    hosp.money += reward.money
    addFame(hosp, reward.fame)
  }
}

function flushLeftoverSpecials(owner: Hospital) {
  if (!owner.week) return
  for (const hosp of allHospitals(owner)) {
    for (const p of [...hosp.patients]) {
      if (p.isSpecial && p.state !== 'done' && p.state !== 'leave' && p.state !== 'dead') {
        leavePatient(hosp, p)
      }
    }
  }
  resolveSpecials(owner)
  owner.week.cityQueue = []
  owner.week.pendingOfferId = null
}

function nextRecipe(current: RecipeId): RecipeId {
  const i = RECIPE_ORDER.indexOf(current)
  return RECIPE_ORDER[(i + 1) % RECIPE_ORDER.length]
}

function openWeek(
  h: Hospital,
  now: number,
  weekId: number,
  recipeId: RecipeId,
  infectMul: number,
  rivals?: Hospital[],
) {
  h.interceptUsed = false
  const kept = rivals ?? NPC_IDS.map((id) => createNpcHospital(id, recipeId))
  for (const rival of kept) applyRecipeToHospital(rival, recipeId)
  applyRecipeToHospital(h, recipeId)
  h.week = {
    weekId,
    recipeId,
    startedAt: now,
    endsAt: now + WEEK_MS,
    nextSpawnAt: now,
    spawned: 0,
    hospitalIds: [h.id, ...NPC_IDS],
    scores: [0, 0, 0, 0],
    cityQueue: [],
    pendingOfferId: null,
    pendingRecipeId: recipeId,
    infectMul,
    pendingInfectMul: 1,
    rivals: kept,
    lastResult: h.week?.lastResult ?? null,
  }
}

function settleWeek(h: Hospital, now: number) {
  if (!h.week) return
  flushLeftoverSpecials(h)
  const ranks = rankWeek(h.week)
  applyRewards(h, ranks)
  const recipeId = nextRecipe(h.week.recipeId)
  const infectMul = h.week.pendingInfectMul
  const weekId = h.week.weekId + 1
  const rivals = h.week.rivals
  const lastResult = ranks
  openWeek(h, now, weekId, recipeId, infectMul, rivals)
  if (h.week) h.week.lastResult = lastResult
}

export function ensureWeek(h: Hospital, now = Date.now()) {
  if (!isUnlocked(h, 'week')) return
  if (h.week) return
  openWeek(h, now, 1, RECIPE_ORDER[0], 1)
}

export function demoUnlockWeek(h: Hospital, now = Date.now()) {
  h.discharged = Math.max(h.discharged, 100)
  ensureWeek(h, now)
}

export function advanceGame(hospital: Hospital, now = Date.now()): Hospital {
  const h = tick(hospital, { now })
  tickRivals(h, { now, spawnEvents: false })
  stepWeek(h, now)
  return h
}

export function stepWeek(h: Hospital, now = Date.now()) {
  if (!isUnlocked(h, 'week')) return
  ensureWeek(h, now)
  if (!h.week) return
  let guard = 0
  while (now >= h.week.endsAt && guard++ < 60) {
    expireOffers(h, h.week.endsAt)
    spawnDue(h, h.week.endsAt)
    settleWeek(h, h.week.endsAt)
    if (!h.week) return
  }
  expireOffers(h, now)
  spawnDue(h, now)
  backfillWeekOffer(h, now)
}

export function chooseOffer(h: Hospital, choice: OfferChoice): ActionResult {
  if (!isUnlocked(h, 'week')) return { ok: false, reason: '周赛尚未解锁' }
  const city = pendingOffer(h)
  if (!h.week || !city) return { ok: false, reason: '没有特殊病人' }
  h.week.pendingOfferId = null
  if (choice === 'accept') {
    admitSpecial(h, city, h)
    return { ok: true }
  }
  if (choice === 'transfer') {
    h.money += SPECIAL_TRANSFER_FEE
    npcGrab(h, city)
    return { ok: true }
  }
  h.week.pendingRecipeId = city.recipeId
  applyRecipeToHospital(h, city.recipeId)
  npcGrab(h, city)
  return { ok: true }
}

function stealable(p: Patient, playerId: string): boolean {
  if (!p.isSpecial) return false
  if (p.state === 'done' || p.state === 'leave' || p.state === 'dead') return false
  if (p.toDoor) return false
  if (p.visitLog.includes(playerId)) return false
  return true
}

function defaultInterceptTarget(rival: Hospital, playerId: string): Patient | null {
  const list = rival.patients.filter((p) => stealable(p, playerId))
  const treating = list.find((p) => p.state === 'treat')
  if (treating) return treating
  for (const room of rival.rooms) {
    const head = list.find((p) => room.queue[0] === p.id)
    if (head) return head
  }
  return list[0] ?? null
}

export function findInterceptTarget(h: Hospital): { rival: Hospital; patient: Patient; city: CityPatient } | null {
  if (!h.week) return null
  for (const rival of h.week.rivals) {
    const patient = defaultInterceptTarget(rival, h.id)
    if (!patient?.specialId) continue
    const city = h.week.cityQueue.find((c) => c.specialId === patient.specialId)
    if (!city) continue
    if (city.visitLog.includes(h.id)) continue
    return { rival, patient, city }
  }
  return null
}

export function canIntercept(h: Hospital): boolean {
  if (!isUnlocked(h, 'intercept')) return false
  if (h.interceptUsed) return false
  if (h.fame < INTERCEPT_FAME) return false
  return !!findInterceptTarget(h)
}

export function interceptReason(h: Hospital): string {
  if (!isUnlocked(h, 'intercept')) return '累计出院 100 解锁截诊'
  if (h.interceptUsed) return '本周截诊已用'
  if (h.fame < INTERCEPT_FAME) return `口碑不足 ${INTERCEPT_FAME}`
  if (!findInterceptTarget(h)) return '对手手里没有可截的特殊病人'
  return ''
}

function polluteOnIntercept(h: Hospital) {
  const doorAdj = h.rooms.filter((r) =>
    r.tiles.some((t) => t.r === GRID_SIZE - 1 && RECEPTION_COLS.includes(t.c)),
  )
  const room = doorAdj[0] ?? roomsOf(h, 'specialist')[0]
  if (room) room.pollution = Math.min(100, room.pollution + INTERCEPT_POLLUTE)
}

export function intercept(h: Hospital): ActionResult {
  const reason = interceptReason(h)
  if (reason) return { ok: false, reason }
  const target = findInterceptTarget(h)
  if (!target) return { ok: false, reason: '没有可截的病人' }
  const { rival, patient, city } = target
  h.interceptUsed = true
  addFame(h, -INTERCEPT_FAME)
  rival.money += SPECIAL_FAIL_FEE
  pullFromRooms(rival, patient)
  rival.patients = rival.patients.filter((p) => p.id !== patient.id)
  if (!city.visitLog.includes(h.id)) city.visitLog.push(h.id)
  city.currentHospitalId = h.id
  patient.id = nextId(h, 'p')
  patient.visitLog = [...city.visitLog]
  patient.transferCount = city.transferCount
  patient.rage = Math.min(100, patient.rage + INTERCEPT_RAGE)
  patient.inRoomId = null
  patient.toRoomId = null
  patient.toHall = false
  patient.toDoor = false
  patient.blocked = false
  patient.weekSettled = false
  h.patients.push(patient)
  polluteOnIntercept(h)
  routePatient(h, patient)
  return { ok: true }
}

export function weekBoard(h: Hospital): { id: string; label: string; score: number }[] {
  if (!h.week) return []
  return h.week.hospitalIds.map((id, i) => ({
    id,
    label: HOSPITAL_LABEL[id] ?? id,
    score: h.week!.scores[i] ?? 0,
  }))
}

export { HOSPITAL_LABEL, RECIPE }
