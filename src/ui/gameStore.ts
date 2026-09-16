import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buildRoom, sellRoom, upgradeCompact, upgradeDual, upgradeQueue } from '../sim/build'
import { cloneHospital } from '../sim/clone'
import { createHospital } from '../sim/createHospital'
import { chooseEvent } from '../sim/events'
import { settleOffline, type OfflineSummary } from '../sim/offline'
import { isUnlocked, manhattan, roomAt } from '../sim/query'
import { SKILL_DEF, castSkill } from '../sim/skills'
import { toggleEr } from '../sim/er'
import { assignDoctor, fireDoctor, fireNurse, hireDoctor, hireNurse, idleDoctors, unassignDoctor } from '../sim/staff'
import { advanceGame, chooseOffer, demoUnlockWeek, intercept, stepWeek } from '../sim/week'
import type { ActionResult, Hospital, OfferChoice, RoomType, SkillId, Tile } from '../sim/types'
import { loadHospital, saveHospital } from './saveGame'
import { clockGate, type ClockGateEvent } from './visClock'

function worthShow(s: OfflineSummary): boolean {
  return s.seconds >= 5 || s.done > 0 || s.left > 0 || s.dead > 0
}

export const useGameStore = defineStore('game', () => {
  const hospital = ref<Hospital>(createHospital())
  const offlineSummary = ref<OfflineSummary | null>(null)
  const buildType = ref<RoomType | null>(null)
  const surgeryFirst = ref<Tile | null>(null)
  const selectedRoomId = ref<string | null>(null)
  const skillId = ref<SkillId | null>(null)
  const lineFirst = ref<Tile | null>(null)
  const notice = ref('')
  let timer = 0
  let booted = false

  const selectedRoom = computed(() => hospital.value.rooms.find((r) => r.id === selectedRoomId.value) ?? null)

  function apply(fn: (h: Hospital) => ActionResult): ActionResult {
    const next = cloneHospital(hospital.value)
    const result = fn(next)
    if (result.ok) {
      const fameWas = hospital.value.fame
      hospital.value = next
      saveHospital(hospital.value)
      notice.value = fameWas > 0 && next.fame <= 0 ? '口碑到 0，日常进场停了' : ''
    } else {
      notice.value = result.reason
    }
    return result
  }

  function catchUp() {
    const fameWas = hospital.value.fame
    const result = settleOffline(hospital.value)
    hospital.value = result.hospital
    if (worthShow(result.summary)) offlineSummary.value = result.summary
    if (fameWas > 0 && hospital.value.fame <= 0) {
      notice.value = '口碑到 0，日常进场停了'
    }
    saveHospital(hospital.value)
  }

  function persist() {
    saveHospital(hospital.value)
  }

  function pauseClock(shouldPersist: boolean) {
    if (timer) {
      window.clearInterval(timer)
      timer = 0
    }
    if (shouldPersist) persist()
  }

  function runClock() {
    if (timer) return
    timer = window.setInterval(() => {
      const fameWas = hospital.value.fame
      hospital.value = advanceGame(hospital.value)
      if (fameWas > 0 && hospital.value.fame <= 0) {
        notice.value = '口碑到 0，日常进场停了'
      }
      persist()
    }, 1000)
  }

  function resumeClock() {
    catchUp()
    runClock()
  }

  function applyClock(event: ClockGateEvent) {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    const action = clockGate(event, hidden)
    if (action === 'pause') pauseClock(true)
    else if (action === 'resume') resumeClock()
    else if (action === 'run') runClock()
  }

  function onVis() {
    applyClock('visibilitychange')
  }

  function onPageHide() {
    applyClock('pagehide')
  }

  function onPageShow() {
    applyClock('pageshow')
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') cancelTarget()
  }

  function boot() {
    if (booted) return
    booted = true
    const saved = loadHospital()
    if (saved) {
      const result = settleOffline(saved)
      hospital.value = result.hospital
      if (worthShow(result.summary)) offlineSummary.value = result.summary
    }
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('week') === '1') {
      const next = cloneHospital(hospital.value)
      demoUnlockWeek(next)
      stepWeek(next, Date.now())
      hospital.value = next
    } else if (isUnlocked(hospital.value, 'week')) {
      const next = cloneHospital(hospital.value)
      stepWeek(next, Date.now())
      hospital.value = next
    }
    persist()
  }

  function startClock() {
    stopClock()
    boot()
    applyClock('start')
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('beforeunload', persist)
    window.addEventListener('keydown', onKey)
  }

  function stopClock() {
    pauseClock(false)
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('beforeunload', persist)
    window.removeEventListener('keydown', onKey)
  }

  function dismissOfflineSummary() {
    offlineSummary.value = null
  }

  function clearSkill() {
    skillId.value = null
    lineFirst.value = null
  }

  function pickBuild(type: RoomType) {
    buildType.value = buildType.value === type ? null : type
    surgeryFirst.value = null
    selectedRoomId.value = null
    clearSkill()
  }

  function pickSkill(id: SkillId) {
    if (skillId.value === id) {
      clearSkill()
      notice.value = ''
      return
    }
    const skill = hospital.value.skills.find((s) => s.id === id)
    if (!skill || !isUnlocked(hospital.value, id)) {
      notice.value = '尚未解锁'
      return
    }
    if (skill.cdLeft > 0) {
      notice.value = '冷却中'
      return
    }
    skillId.value = id
    lineFirst.value = null
    buildType.value = null
    surgeryFirst.value = null
    selectedRoomId.value = null
    notice.value = SKILL_DEF[id].shape === 'line' ? '先点一格，再点相邻格定方向' : '点地块施放'
  }

  function clickTile(tile: Tile) {
    if (skillId.value) {
      const def = SKILL_DEF[skillId.value]
      if (def.shape === 'line') {
        if (!lineFirst.value) {
          lineFirst.value = tile
          notice.value = '再点相邻格定方向'
          return
        }
        if (manhattan(lineFirst.value, tile) !== 1) {
          lineFirst.value = tile
          notice.value = '再点相邻格定方向'
          return
        }
        apply((h) => castSkill(h, skillId.value!, lineFirst.value!, tile))
        clearSkill()
        return
      }
      apply((h) => castSkill(h, skillId.value!, tile))
      clearSkill()
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
        notice.value = '再点相邻一格。点错保留第一格，Esc 或「取消指定」取消。'
        return
      }
      const result = apply((h) => buildRoom(h, 'surgery', [surgeryFirst.value!, tile]))
      if (result.ok) surgeryFirst.value = null
      else notice.value = result.reason
      return
    }
    apply((h) => buildRoom(h, buildType.value!, [tile]))
  }

  function cancelTarget() {
    if (skillId.value || lineFirst.value || surgeryFirst.value) {
      clearSkill()
      surgeryFirst.value = null
      notice.value = ''
    }
  }

  function doSell() {
    if (!selectedRoomId.value) return
    apply((h) => sellRoom(h, selectedRoomId.value!))
    selectedRoomId.value = null
  }

  return {
    hospital,
    offlineSummary,
    buildType,
    surgeryFirst,
    selectedRoomId,
    selectedRoom,
    skillId,
    lineFirst,
    notice,
    startClock,
    stopClock,
    dismissOfflineSummary,
    pickBuild,
    pickSkill,
    clickTile,
    cancelTarget,
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
    chooseOffer: (choice: OfferChoice) => apply((h) => chooseOffer(h, choice)),
    intercept: () => apply(intercept),
    toggleEr: () => apply(toggleEr),
  }
})
