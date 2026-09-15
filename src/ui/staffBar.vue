<script setup lang="ts">
import { computed } from 'vue'
import { HIRE_DOCTOR, HIRE_NURSE, MAX_NURSES } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()
const idleDoctor = computed(() => game.hospital.doctors.find((d) => !d.roomId))
</script>

<template>
  <div class="staff">
    <span
      >医生 {{ game.hospital.doctors.filter((d) => d.roomId).length }}/{{ game.hospital.doctors.length }}</span
    >
    <button type="button" @click="game.hireDoctor()">招 {{ HIRE_DOCTOR }}</button>
    <button v-if="idleDoctor" type="button" @click="game.fireDoctor(idleDoctor.id)">解雇医生</button>
    <span>护士 {{ game.hospital.nurses }}/{{ MAX_NURSES }}</span>
    <button type="button" @click="game.hireNurse()">招 {{ HIRE_NURSE }}</button>
    <button type="button" @click="game.fireNurse()">解雇护士</button>
  </div>
</template>

<style scoped>
.staff {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}

button {
  padding: 4px 8px;
  border: 1px solid #4a6666;
  background: #1e3c3c;
  color: var(--paper);
  font: inherit;
  font-size: 12px;
}
</style>
