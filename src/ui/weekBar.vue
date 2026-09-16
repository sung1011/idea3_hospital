<script setup lang="ts">
import { computed } from 'vue'
import { isUnlocked } from '../sim/query'
import { INTERCEPT_FAME, RECIPE, WEEK_UNLOCK_AT } from '../sim/tables'
import { canIntercept, interceptReason, weekBoard, weekRemainingMs } from '../sim/week'
import { useGameStore } from './gameStore'

const game = useGameStore()

const unlocked = computed(() => isUnlocked(game.hospital, 'week'))
const week = computed(() => game.hospital.week)
const board = computed(() => weekBoard(game.hospital))
const remain = computed(() => {
  const ms = weekRemainingMs(game.hospital)
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
})
const remainUnlock = computed(() => Math.max(0, WEEK_UNLOCK_AT - game.hospital.discharged))
const interceptOk = computed(() => canIntercept(game.hospital))
const interceptTip = computed(() => interceptReason(game.hospital))
const lastPlace = computed(() => {
  const mine = week.value?.lastResult?.find((r) => r.id === game.hospital.id)
  return mine?.place ?? null
})
</script>

<template>
  <div class="week">
    <template v-if="unlocked && week">
      <div class="head">
        <strong>周赛 · {{ RECIPE[week.recipeId].name }}</strong>
        <span>剩余 {{ remain }}</span>
        <span v-if="lastPlace">上周第 {{ lastPlace }}</span>
      </div>
      <div class="scores">
        <span v-for="row in board" :key="row.id" :class="{ me: row.id === game.hospital.id }">
          {{ row.label }} {{ row.score }}
        </span>
      </div>
      <button type="button" :disabled="!interceptOk" :title="interceptTip" @click="game.intercept()">
        {{ interceptOk ? `截诊 · 花 ${INTERCEPT_FAME} 口碑` : interceptTip || '截诊' }}
      </button>
    </template>
    <em v-else-if="unlocked">周赛开启中…</em>
    <em v-else>再出院 {{ remainUnlock }} 人解锁周赛 / 专科 / 截诊</em>
  </div>
</template>

<style scoped>
.week {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}

.head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: baseline;
}

.head strong {
  color: var(--paper);
  font-size: 13px;
}

.scores {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scores span {
  padding: 2px 6px;
  border: 1px solid #4a6666;
  background: #163333;
}

.scores .me {
  border-color: var(--iodine);
  color: var(--iodine);
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
  opacity: 0.45;
}

em {
  font-style: normal;
  opacity: 0.7;
}
</style>
