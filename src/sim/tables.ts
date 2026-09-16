import type { DiseaseId, EventId, RecipeId, RoomType, UnlockKey } from './types'

export const GRID_SIZE = 5

/** 0-indexed. 正门贴底边外侧，正对第 3 列。 */
export const DOOR_COL = 2
export const DOOR_ROW = GRID_SIZE
export const DOOR = { r: DOOR_ROW, c: DOOR_COL }

/** 急诊口贴底边外侧，正对第 1 列。不占 25 格。 */
export const ER_DOOR_COL = 0
export const ER_DOOR = { r: DOOR_ROW, c: ER_DOOR_COL }
export const ER_UNLOCK_AT = 80
export const ER_OPEN_COST = 80
export const ER_CLOSE_REFUND = 40
export const ER_CHANCE = 0.25
export const ER_SUCCESS_MUL = 0.85

/** 前台必须贴正门：底行、门所在列及其左右。 */
export const RECEPTION_COLS = [DOOR_COL - 1, DOOR_COL, DOOR_COL + 1]

export const START_MONEY = 5000
export const START_FAME = 50
export const START_DOCTORS = 4
export const START_NURSES = 1

export const MAX_FAME = 100
export const MAX_FIELD = 20
export const OFFLINE_CAP_S = 8 * 60 * 60
export const MAX_NURSES = 4
export const MAX_WAITING = 2
export const MAX_SPECIALIST = 1

export const SPAWN_BASE_S = 12
export const SPAWN_MIN_S = 5
export const WALK_S_PER_TILE = 2
export const NURSE_WALK_STEP = 0.15
export const NURSE_WALK_FLOOR = 0.4

export const RAGE_QUEUE = 4
export const RAGE_WALK = 2
export const RAGE_HALL = 1
export const RAGE_LEAVE_SOFT = 80
export const RAGE_LEAVE_HARD = 100
export const STAGE_EVERY_S = 30
export const RAGE_EVERY_S = 10

export const FAME_LEAVE = 2
export const FAME_LEAVE_VIP = 8
export const FAME_DEAD = 5
export const POLLUTE_DEAD = 15
export const POLLUTE_SURGERY_FAIL = 10
export const POLLUTE_INFECT = 8
export const POLLUTE_SPREAD = 3
export const POLLUTE_SPREAD_AT = 40
export const POLLUTE_CONVERT_AT = 70
export const CONVERT_CHANCE = 0.1

export const HIRE_DOCTOR = 100
export const HIRE_NURSE = 80
export const UPGRADE_QUEUE = 50
export const UPGRADE_DUAL = 90
export const UPGRADE_COMPACT = 150

export const SUCCESS = {
  treatment: 0.85,
  surgery: 0.7,
  specialist: 0.75,
} as const

export const ROOM_LABEL: Record<RoomType, string> = {
  reception: '前台',
  diagnosis: '诊断',
  treatment: '治疗室',
  surgery: '手术室',
  pharmacy: '药房',
  ward: '病房',
  specialist: '专科室',
  waiting: '候诊厅',
}

export const UNLOCK_LABEL: Partial<Record<UnlockKey, string>> = {
  ward: '病房',
  waiting: '候诊厅',
  disinfect: '消毒',
  sustain: '持续消毒',
  fracture: '骨折',
  surgery: '手术室',
  flush: '冲洗',
  infectious: '传染病',
  spray: '喷雾',
  vip: 'VIP',
  compact: '紧凑设备',
  er: '急诊口',
  specialist: '专科室',
  week: '周赛',
  intercept: '截诊',
  dual: '双工位',
}

export const DISEASE_LABEL: Record<DiseaseId, string> = {
  cold: '感冒',
  fracture: '骨折',
  infectious: '传染病',
  vip: 'VIP',
  special: '特殊',
}

export type RoomDef = {
  queueCap: number
  throughput: number
  cost: number
  tiles: number
}

export const ROOM_DEF: Record<RoomType, RoomDef> = {
  reception: { queueCap: 6, throughput: 8, cost: 0, tiles: 1 },
  diagnosis: { queueCap: 4, throughput: 5, cost: 40, tiles: 1 },
  treatment: { queueCap: 3, throughput: 3, cost: 60, tiles: 1 },
  surgery: { queueCap: 2, throughput: 1.5, cost: 120, tiles: 2 },
  pharmacy: { queueCap: 5, throughput: 6, cost: 50, tiles: 1 },
  ward: { queueCap: 4, throughput: 2, cost: 70, tiles: 1 },
  specialist: { queueCap: 3, throughput: 2, cost: 100, tiles: 1 },
  waiting: { queueCap: 8, throughput: 0, cost: 35, tiles: 1 },
}

export type DiseaseDef = {
  path: RoomType[]
  money: number
  fame: number
  weight: number
}

export const DISEASE: Record<DiseaseId, DiseaseDef> = {
  cold: { path: ['reception', 'diagnosis', 'treatment', 'pharmacy'], money: 10, fame: 1, weight: 1 },
  fracture: { path: ['reception', 'diagnosis', 'surgery', 'ward', 'pharmacy'], money: 28, fame: 2, weight: 1 },
  infectious: { path: ['reception', 'diagnosis', 'ward', 'treatment', 'pharmacy'], money: 22, fame: 2, weight: 1 },
  vip: { path: ['reception', 'diagnosis', 'treatment', 'pharmacy'], money: 40, fame: 4, weight: 1 },
  special: { path: ['reception', 'diagnosis', 'specialist', 'pharmacy'], money: 0, fame: 0, weight: 0 },
}

export const UNLOCK_AT: { at: number; keys: UnlockKey[] }[] = [
  { at: 0, keys: ['cold', 'reception', 'treatment', 'pharmacy', 'diagnosis'] },
  { at: 15, keys: ['ward', 'waiting', 'disinfect', 'sustain'] },
  { at: 30, keys: ['fracture', 'surgery', 'flush'] },
  { at: 50, keys: ['infectious', 'spray'] },
  { at: 80, keys: ['vip', 'compact', 'er'] },
  { at: 100, keys: ['specialist', 'week', 'intercept'] },
  { at: 120, keys: ['dual'] },
]

export const BUILD_ORDER: RoomType[] = [
  'reception',
  'diagnosis',
  'treatment',
  'pharmacy',
  'ward',
  'surgery',
  'waiting',
  'specialist',
]

export const WEEK_UNLOCK_AT = 100
/** demo：10 分钟当一周。正式局按北京时间周一重置。 */
export const WEEK_MS = 10 * 60 * 1000
export const CITY_SPECIALS = 8
export const SPECIAL_SPAWN_MIN_MS = 75_000
export const SPECIAL_SPAWN_MAX_MS = 90_000
/** demo：要约倒计时 2 分钟。正式局 2 小时。 */
export const OFFER_DEADLINE_MS = 2 * 60 * 1000
export const TRANSFER_CAP = 4
export const SPECIAL_FAIL_FEE = 15
export const SPECIAL_TRANSFER_FEE = 10
export const FAME_SPECIAL_FAIL = 6
export const FAME_CITY_FAIL = 8
export const INTERCEPT_FAME = 8
export const INTERCEPT_RAGE = 25
export const INTERCEPT_POLLUTE = 20
export const CITY_FAIL_INFECT_MUL = 1.5

export const PLAYER_ID = 'player'
export const NPC_IDS = ['npc-isolate', 'npc-micro', 'npc-continue'] as const
export type NpcId = (typeof NPC_IDS)[number]

export const HOSPITAL_LABEL: Record<string, string> = {
  player: '本院',
  'npc-isolate': '隔离院',
  'npc-micro': '显微院',
  'npc-continue': '续治院',
}

export const RECIPE_ORDER: RecipeId[] = ['isolate', 'micro', 'continue']

export type RecipeDef = {
  name: string
  path: RoomType[]
  money: number
  score: number
}

export const RECIPE: Record<RecipeId, RecipeDef> = {
  isolate: {
    name: '隔离处置',
    path: ['reception', 'diagnosis', 'ward', 'specialist', 'pharmacy'],
    money: 80,
    score: 10,
  },
  micro: {
    name: '显微手术',
    path: ['reception', 'diagnosis', 'surgery', 'specialist', 'pharmacy'],
    money: 110,
    score: 14,
  },
  continue: {
    name: '跨院续治',
    path: ['reception', 'diagnosis', 'specialist', 'treatment', 'pharmacy'],
    money: 90,
    score: 12,
  },
}

export const WEEK_REWARDS = [
  { money: 150, fame: 8 },
  { money: 80, fame: 3 },
  { money: 30, fame: 0 },
  { money: 0, fame: 0 },
] as const

export const EVENT_IDS: EventId[] = ['infectAdmit', 'vipCut', 'inspect', 'vendor', 'raise', 'media']

export const EVENT_TEXT: Record<EventId, { title: string; left: string; right: string }> = {
  infectAdmit: {
    title: '门口来了一群发热病人，收不收？',
    left: '收。之后 3 分钟传染病权重 ×3。',
    right: '拒。口碑 -6。',
  },
  vipCut: {
    title: '有人要插队，说是董事的亲戚。',
    left: '让。立刻进场 1 个 VIP（可超过场上 20 人上限，口碑见底也能进）。',
    right: '不让。口碑 +3，不加钱。',
  },
  inspect: {
    title: '检查团在楼下。',
    left: '打扫一天。所有房污染 -20，钱 -40。',
    right: '硬扛。若任一房污染 ≥50，口碑 -10。',
  },
  vendor: {
    title: '设备商堵在值班室推销。',
    left: '买。钱 -80，随机一间已建房吞吐 ×1.3，持续 3 分钟。',
    right: '不买。无事。',
  },
  raise: {
    title: '医生要加薪。',
    left: '加。钱 -30，全体医生速度 ×1.2，持续 3 分钟。',
    right: '不加。随机一间有工位的房空岗 60 秒。',
  },
  media: {
    title: '媒体要来拍产线。',
    left: '开放。之后 3 分钟进场间隔 ×0.7（人更多）。',
    right: '谢绝。无事。',
  },
}
