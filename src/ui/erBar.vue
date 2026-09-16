<script setup lang="ts">
import { computed } from 'vue'
import { isUnlocked } from '../sim/query'
import { ER_CLOSE_REFUND, ER_OPEN_COST, ER_UNLOCK_AT } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()

const unlocked = computed(() => isUnlocked(game.hospital, 'er'))
const open = computed(() => game.hospital.erOpen)
const remain = computed(() => Math.max(0, ER_UNLOCK_AT - game.hospital.discharged))
</script>

<template>
  <div class="er">
    <span>急诊口</span>
    <button
      v-if="unlocked"
      type="button"
      :class="{ on: open }"
      @click="game.toggleEr()"
    >
      {{ open ? `关闭 · 退 ${ER_CLOSE_REFUND}` : `开启 · 花 ${ER_OPEN_COST}` }}
    </button>
    <em v-else>再出院 {{ remain }} 人解锁急诊口</em>
  </div>
</template>

<style scoped>
.er {
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

button.on {
  border-color: var(--iodine);
  background: #2a4a32;
  color: var(--iodine);
}

em {
  font-style: normal;
  opacity: 0.7;
}
</style>
