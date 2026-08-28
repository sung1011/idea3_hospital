import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buildRoom, sellRoom, upgradeCompact, upgradeDual, upgradeQueue } from '../sim/build'
import { cloneHospital } from '../sim/clone'
import { createHospital } from '../sim/createHospital'
import { chooseEvent } from '../sim/events'
import { roomAt } from '../sim/query'
import {
  assignCleaner,
  assignDoctor,
  fireCleaner,
  fireDoctor,
  fireNurse,
  hireCleaner,
  hireDoctor,
  hireNurse,
  idleDoctors,
  unassignDoctor,
} from '../sim/staff'
import { tick } from '../sim/tick'
import type { ActionResult, Hospital, RoomType, Tile } from '../sim/types'

export const useGameStore = defineStore('game', () => {
  const hospital = ref<Hospital>(createHospital())
  const buildType = ref<RoomType | null>(null)
  const surgeryFirst = ref<Tile | null>(null)
  const selectedRoomId = ref<string | null>(null)
  const notice = ref('')
  let timer = 0

  const selectedRoom = computed(() => hospital.value.rooms.find((r) => r.id === selectedRoomId.value) ?? null)

  function apply(fn: (h: Hospital) => ActionResult): ActionResult {
    const next = cloneHospital(hospital.value)
    const result = fn(next)
    if (result.ok) hospital.value = next
    notice.value = result.ok ? '' : result.reason
    return result
  }

  function startClock() {
    stopClock()
    timer = window.setInterval(() => {
      hospital.value = tick(hospital.value)
    }, 1000)
  }

  function stopClock() {
    if (timer) {
      window.clearInterval(timer)
      timer = 0
    }
  }

  function pickBuild(type: RoomType) {
    buildType.value = buildType.value === type ? null : type
    surgeryFirst.value = null
    selectedRoomId.value = null
  }

  function clickTile(tile: Tile) {
    const room = roomAt(hospital.value, tile)
    if (room) {
      selectedRoomId.value = room.id
      buildType.value = null
      surgeryFirst.value = null
      return
    }
    if (!buildType.value) {
      selectedRoomId.value = null
      return
    }
    if (buildType.value === 'surgery') {
      if (!surgeryFirst.value) {
        surgeryFirst.value = tile
        notice.value = '再点相邻一格'
        return
      }
      apply((h) => buildRoom(h, 'surgery', [surgeryFirst.value!, tile]))
      surgeryFirst.value = null
      return
    }
    apply((h) => buildRoom(h, buildType.value!, [tile]))
  }

  function doSell() {
    if (!selectedRoomId.value) return
    apply((h) => sellRoom(h, selectedRoomId.value!))
    selectedRoomId.value = null
  }

  return {
    hospital,
    buildType,
    surgeryFirst,
    selectedRoomId,
    selectedRoom,
    notice,
    startClock,
    stopClock,
    pickBuild,
    clickTile,
    doSell,
    upgradeQueue: () => selectedRoomId.value && apply((h) => upgradeQueue(h, selectedRoomId.value!)),
    upgradeDual: () => selectedRoomId.value && apply((h) => upgradeDual(h, selectedRoomId.value!)),
    upgradeCompact: () => selectedRoomId.value && apply((h) => upgradeCompact(h, selectedRoomId.value!)),
    hireDoctor: () => apply(hireDoctor),
    hireNurse: () => apply(hireNurse),
    hireCleaner: () => apply(hireCleaner),
    fireNurse: () => apply(fireNurse),
    fireDoctor: (id: string) => apply((h) => fireDoctor(h, id)),
    fireCleaner: (id: string) => apply((h) => fireCleaner(h, id)),
    assignIdleDoctor: () => {
      const roomId = selectedRoomId.value
      const idle = idleDoctors(hospital.value)[0]
      if (!roomId || !idle) {
        notice.value = idle ? '先点房间' : '没有空闲医生'
        return
      }
      apply((h) => assignDoctor(h, idle.id, roomId))
    },
    unassignDoctor: (id: string) => apply((h) => unassignDoctor(h, id)),
    assignIdleCleaner: () => {
      const roomId = selectedRoomId.value
      const idle = hospital.value.cleaners.find((c) => !c.roomId)
      if (!roomId || !idle) {
        notice.value = idle ? '先点房间' : '没有空闲保洁'
        return
      }
      apply((h) => assignCleaner(h, idle.id, roomId))
    },
    chooseEvent: (side: 'left' | 'right') => apply((h) => chooseEvent(h, side)),
  }
})
