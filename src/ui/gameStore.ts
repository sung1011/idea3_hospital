import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buildRoom, sellRoom, upgradeCompact, upgradeDual, upgradeQueue } from '../sim/build'
import { cloneHospital } from '../sim/clone'
import { createHospital } from '../sim/createHospital'
import { chooseEvent } from '../sim/events'
import { manhattan, roomAt } from '../sim/query'
import { skillOf, useSkill } from '../sim/skills'
import { assignDoctor, fireDoctor, fireNurse, hireDoctor, hireNurse, idleDoctors, unassignDoctor } from '../sim/staff'
import { tick } from '../sim/tick'
import type { ActionResult, Hospital, RoomType, SkillId, Tile } from '../sim/types'

export const useGameStore = defineStore('game', () => {
  const hospital = ref<Hospital>(createHospital())
  const buildType = ref<RoomType | null>(null)
  const surgeryFirst = ref<Tile | null>(null)
  const selectedRoomId = ref<string | null>(null)
  const skillId = ref<SkillId | null>(null)
  const skillLineFrom = ref<Tile | null>(null)
  const notice = ref('')
  let timer = 0

  const selectedRoom = computed(() => hospital.value.rooms.find((r) => r.id === selectedRoomId.value) ?? null)
  const aimingSkill = computed(() => (skillId.value ? skillOf(hospital.value, skillId.value) ?? null : null))

  function apply(fn: (h: Hospital) => ActionResult): ActionResult {
    const next = cloneHospital(hospital.value)
    const result = fn(next)
    if (result.ok) hospital.value = next
    notice.value = result.ok ? '' : result.reason
    return result
  }

  function clearSkillAim() {
    skillId.value = null
    skillLineFrom.value = null
  }

  function cancelSkill() {
    if (!skillId.value) return
    clearSkillAim()
    notice.value = ''
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
    clearSkillAim()
    buildType.value = buildType.value === type ? null : type
    surgeryFirst.value = null
    selectedRoomId.value = null
  }

  function pickSkill(id: SkillId) {
    const skill = skillOf(hospital.value, id)
    if (!skill || !skill.unlocked) {
      notice.value = '尚未解锁'
      return
    }
    if (skill.cdLeft > 0) {
      notice.value = '冷却中'
      return
    }
    if (skillId.value === id) {
      cancelSkill()
      return
    }
    skillId.value = id
    skillLineFrom.value = null
    buildType.value = null
    surgeryFirst.value = null
    selectedRoomId.value = null
    notice.value = skill.shape === 'line' ? '先点一格，再点相邻格定方向' : '点地块施放，点空白取消'
  }

  function clickTile(tile: Tile) {
    if (skillId.value) {
      const skill = skillOf(hospital.value, skillId.value)
      if (!skill) {
        cancelSkill()
        return
      }
      if (skill.shape === 'line') {
        if (!skillLineFrom.value) {
          skillLineFrom.value = tile
          notice.value = '再点相邻格定方向'
          return
        }
        if (manhattan(skillLineFrom.value, tile) !== 1) {
          cancelSkill()
          return
        }
        apply((h) => useSkill(h, skill.id, skillLineFrom.value!, tile))
        clearSkillAim()
        return
      }
      apply((h) => useSkill(h, skill.id, tile))
      clearSkillAim()
      return
    }
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
    skillId,
    skillLineFrom,
    aimingSkill,
    notice,
    startClock,
    stopClock,
    pickBuild,
    pickSkill,
    cancelSkill,
    clickTile,
    doSell,
    upgradeQueue: () => selectedRoomId.value && apply((h) => upgradeQueue(h, selectedRoomId.value!)),
    upgradeDual: () => selectedRoomId.value && apply((h) => upgradeDual(h, selectedRoomId.value!)),
    upgradeCompact: () => selectedRoomId.value && apply((h) => upgradeCompact(h, selectedRoomId.value!)),
    hireDoctor: () => apply(hireDoctor),
    hireNurse: () => apply(hireNurse),
    fireNurse: () => apply(fireNurse),
    fireDoctor: (id: string) => apply((h) => fireDoctor(h, id)),
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
    chooseEvent: (side: 'left' | 'right') => apply((h) => chooseEvent(h, side)),
  }
})
