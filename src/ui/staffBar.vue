<script setup lang="ts">
import { computed } from 'vue'
import { HIRE_DOCTOR, HIRE_NURSE, MAX_NURSES } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()
const idleDoctor = computed(() => game.hospital.doctors.find((d) => !d.roomId))
const canHireDoctor = computed(() => game.hospital.money >= HIRE_DOCTOR)
const canHireNurse = computed(() => game.hospital.nurses < MAX_NURSES && game.hospital.money >= HIRE_NURSE)
const canFireNurse = computed(() => game.hospital.nurses > 0)
</script>

<template>
  <div class="staff">
    <span
      >医生 {{ game.hospital.doctors.filter((d) => d.roomId).length }}/{{ game.hospital.doctors.length }}</span
    >
    <button type="button" :disabled="!canHireDoctor" :title="canHireDoctor ? '' : '钱不够'" @click="game.hireDoctor()">
      招医生 · {{ HIRE_DOCTOR }}
    </button>
    <button v-if="idleDoctor" type="button" @click="game.fireDoctor(idleDoctor.id)">解雇空闲医生</button>
    <span>护士 {{ game.hospital.nurses }}/{{ MAX_NURSES }}</span>
    <button type="button" :disabled="!canHireNurse" :title="canHireNurse ? '' : game.hospital.nurses >= MAX_NURSES ? '护士满了' : '钱不够'" @click="game.hireNurse()">
      招护士 · {{ HIRE_NURSE }}
    </button>
    <button type="button" :disabled="!canFireNurse" @click="game.fireNurse()">解雇护士</button>
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

button:disabled {
  opacity: 0.4;
}
</style>
