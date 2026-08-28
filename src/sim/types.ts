export type RoomType =
  | 'reception'
  | 'diagnosis'
  | 'treatment'
  | 'surgery'
  | 'pharmacy'
  | 'ward'
  | 'specialist'
  | 'waiting'

export type DiseaseId = 'cold' | 'fracture' | 'infectious' | 'vip'

export type PatientState =
  | 'walk'
  | 'queue'
  | 'treat'
  | 'waitHall'
  | 'done'
  | 'leave'
  | 'dead'

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
  recipeId?: string
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
  x: number
  y: number
}

export type Doctor = {
  id: string
  roomId: string | null
}

export type Cleaner = {
  id: string
  roomId: string | null
}

export type Hospital = {
  money: number
  fame: number
  nurses: number
  doctors: Doctor[]
  cleaners: Cleaner[]
  rooms: Room[]
  patients: Patient[]
  unlocks: string[]
  lastTick: number
  elapsedS: number
  erOpen: boolean
  interceptUsed: boolean
}
