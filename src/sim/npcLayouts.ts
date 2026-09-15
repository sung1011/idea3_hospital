import { buildRoom } from './build'
import { createHospital } from './createHospital'
import { assignDoctor } from './staff'
import { HIRE_DOCTOR } from './tables'
import type { Hospital, RecipeId } from './types'

function staffAll(h: Hospital) {
  const rooms = h.rooms.filter((r) => r.type !== 'waiting')
  while (h.doctors.length < rooms.length) {
    h.doctors.push({ id: `doc-${h.id}-${h.doctors.length + 1}`, roomId: null, hireCost: HIRE_DOCTOR })
  }
  rooms.forEach((room, i) => assignDoctor(h, h.doctors[i].id, room.id))
}

function baseNpc(id: string, recipeId: RecipeId): Hospital {
  const h = createHospital(id)
  h.discharged = 100
  h.eventIn = 999_999
  h.pendingEvent = null
  h.week = null
  return h
}

/** 隔离院：前台→诊断→病房→专科→药房 */
function isolateNpc(recipeId: RecipeId): Hospital {
  const h = baseNpc('npc-isolate', recipeId)
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'ward', [{ r: 2, c: 2 }])
  buildRoom(h, 'specialist', [{ r: 1, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 0, c: 2 }])
  staffAll(h)
  return h
}

/** 显微院：前台→诊断→手术→专科→药房 */
function microNpc(recipeId: RecipeId): Hospital {
  const h = baseNpc('npc-micro', recipeId)
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'surgery', [
    { r: 2, c: 1 },
    { r: 2, c: 2 },
  ])
  buildRoom(h, 'specialist', [{ r: 1, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 0, c: 2 }])
  staffAll(h)
  return h
}

/** 续治院：前台→诊断→专科→治疗→药房 */
function continueNpc(recipeId: RecipeId): Hospital {
  const h = baseNpc('npc-continue', recipeId)
  buildRoom(h, 'reception', [{ r: 4, c: 2 }])
  buildRoom(h, 'diagnosis', [{ r: 3, c: 2 }])
  buildRoom(h, 'specialist', [{ r: 2, c: 2 }])
  buildRoom(h, 'treatment', [{ r: 1, c: 2 }])
  buildRoom(h, 'pharmacy', [{ r: 0, c: 2 }])
  staffAll(h)
  return h
}

export function createNpcHospital(id: string, recipeId: RecipeId): Hospital {
  const h = id === 'npc-micro' ? microNpc(recipeId) : id === 'npc-continue' ? continueNpc(recipeId) : isolateNpc(recipeId)
  applyRecipeToHospital(h, recipeId)
  return h
}

export function applyRecipeToHospital(h: Hospital, recipeId: RecipeId) {
  for (const room of h.rooms) {
    if (room.type === 'specialist') room.recipeId = recipeId
  }
}
