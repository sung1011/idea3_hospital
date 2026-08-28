import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createHospital } from '../sim/createHospital'
import { tick } from '../sim/tick'
import type { Hospital } from '../sim/types'

export const useGameStore = defineStore('game', () => {
  const hospital = ref<Hospital>(createHospital())
  let timer = 0

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

  return { hospital, startClock, stopClock }
})
