<script setup lang="ts">
import { computed } from 'vue'
import { OFFLINE_CAP_S } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()

const duration = computed(() => {
  const s = game.offlineSummary?.seconds ?? 0
  if (s >= OFFLINE_CAP_S) return '8 小时（已封顶）'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${sec} 秒`
  return `${sec} 秒`
})

const blocked = computed(() => {
  const s = game.offlineSummary
  if (!s?.blockedLabel) return '没有明显堵点'
  if (s.blockedS > 0) return `${s.blockedLabel}（堵了 ${s.blockedS} 秒）`
  return s.blockedLabel
})
</script>

<template>
  <div v-if="game.offlineSummary" class="mask">
    <div class="card">
      <p class="kicker">挂机结算</p>
      <h2>离线 {{ duration }}</h2>
      <p class="line">完成 {{ game.offlineSummary.done }} / 走人 {{ game.offlineSummary.left }} / 死亡 {{ game.offlineSummary.dead }}</p>
      <p class="line muted">堵得最久：{{ blocked }}</p>
      <button type="button" autofocus @click="game.dismissOfflineSummary()">接班</button>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 19;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(10 20 20 / 55%);
}

.card {
  width: min(480px, 100%);
  padding: 18px 16px 16px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 6px 6px 0 #7a1f28;
}

.kicker {
  margin: 0 0 6px;
  color: var(--stamp);
  font-size: 12px;
  letter-spacing: 0.2em;
}

h2 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.4;
}

.line {
  margin: 0 0 8px;
  font-size: 16px;
  line-height: 1.5;
}

.muted {
  color: #6a5c4c;
  font-size: 14px;
}

button {
  margin-top: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ink);
  background: #f3ead8;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
}
</style>
