export type RoomType =
  | 'reception'
  | 'diagnosis'
  | 'treatment'
  | 'surgery'
  | 'pharmacy'
  | 'ward'
  | 'specialist'
  | 'waiting'

export type DiseaseId = 'cold' | 'fracture' | 'infectious' | 'vip' | 'special'

export type RecipeId = 'isolate' | 'micro' | 'continue'

export type OfferChoice = 'accept' | 'transfer' | 'recipe'

export type PatientState =
  | 'walk'
  | 'queue'
  | 'treat'
  | 'waitHall'
  | 'done'
  | 'leave'
  | 'dead'

export type SkillId = 'disinfect' | 'flush' | 'spray' | 'sustain'

export type SkillShape = 'point' | 'line' | 'aoe' | 'hot'

export type UnlockKey =
  | DiseaseId
  | RoomType
  | SkillId
  | 'compact'
  | 'dual'
  | 'er'
  | 'week'
  | 'intercept'

export type EventId =
  | 'infectAdmit'
  | 'vipCut'
  | 'inspect'
  | 'vendor'
  | 'raise'
  | 'media'

export type Buff =
  | { kind: 'infectWeight'; remainS: number; mul: number }
  | { kind: 'spawnInterval'; remainS: number; mul: number }
  | { kind: 'doctorSpeed'; remainS: number; mul: number }
  | { kind: 'roomThroughput'; remainS: number; roomId: string; mul: number }
  | { kind: 'roomVacant'; remainS: number; roomId: string }

export type Tile = {
  r: number
  c: number
}

export type Room = {
  id: string
  type: RoomType
  tiles: Tile[]
  levelFlags: {
    queuePlus2: boolean
    dualStation: boolean
    compact: boolean
  }
  doctorIds: string[]
  queue: string[]
  pollution: number
  builtCost: number
  upgradeSpent: number
  recipeId?: RecipeId
  progress: number
}

export type Patient = {
  id: string
  disease: DiseaseId
  path: RoomType[]
  node: number
  state: PatientState
  isEr: boolean
  rage: number
  stage: number
  waitS: number
  tickInState: number
  x: number
  y: number
  walkFromX: number
  walkFromY: number
  walkToX: number
  walkToY: number
  walkRemain: number
  walkTotal: number
  inRoomId: string | null
  toRoomId: string | null
  toHall: boolean
  toDoor: boolean
  blocked: boolean
  isSpecial: boolean
  specialId?: string
  recipeId?: RecipeId
  visitLog: string[]
  transferCount: number
  weekSettled?: boolean
}

export type Doctor = {
  id: string
  roomId: string | null
  hireCost: number
}

export type Skill = {
  id: SkillId
  shape: SkillShape
  cdS: number
  cdLeft: number
  unlocked: boolean
}

export type Hot = {
  tile: Tile
  remainS: number
  everyS: number
  amount: number
  accS: number
}

export type RollMode = 'rand' | 'always' | 'never'

export type CityPatient = {
  specialId: string
  recipeId: RecipeId
  visitLog: string[]
  transferCount: number
  currentHospitalId: string | null
  offerDeadline: number
}

export type WeekRank = {
  id: string
  score: number
  place: number
}

export type WeekMatch = {
  weekId: number
  recipeId: RecipeId
  startedAt: number
  endsAt: number
  nextSpawnAt: number
  spawned: number
  hospitalIds: string[]
  scores: number[]
  cityQueue: CityPatient[]
  pendingOfferId: string | null
  pendingRecipeId: RecipeId
  infectMul: number
  pendingInfectMul: number
  rivals: Hospital[]
  lastResult: WeekRank[] | null
}

export type Hospital = {
  id: string
  money: number
  fame: number
  nurses: number
  doctors: Doctor[]
  rooms: Room[]
  patients: Patient[]
  lastTick: number
  elapsedS: number
  spawnAcc: number
  nextId: number
  rng: number
  rollMode: RollMode
  discharged: number
  leftCount: number
  deadCount: number
  erOpen: boolean
  interceptUsed: boolean
  pendingEvent: EventId | null
  eventIn: number
  buffs: Buff[]
  skills: Skill[]
  hots: Hot[]
  week: WeekMatch | null
}

export type ActionResult = { ok: true } | { ok: false; reason: string }
