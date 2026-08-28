<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from './gameStore'

const game = useGameStore()

const clock = computed(() => {
  const total = game.hospital.elapsedS
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
})
</script>

<template>
  <div class="board">
    <div class="cell">
      <span class="label">钱</span>
      <span class="value iodine">{{ game.hospital.money }}</span>
    </div>
    <div class="cell">
      <span class="label">口碑</span>
      <span class="value fame">{{ game.hospital.fame }}</span>
    </div>
    <div class="cell">
      <span class="label">值班</span>
      <span class="value">T+{{ clock }}</span>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background: #3d5555;
  border: 1px solid #4a6666;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 10px;
  background: #1e3c3c;
}

.label {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.16em;
}

.value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.iodine {
  color: var(--iodine);
}

.fame {
  color: var(--fame);
}
</style>
