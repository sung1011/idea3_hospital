<script setup lang="ts">
import { BUILD_ORDER, ROOM_DEF, ROOM_LABEL } from '../sim/tables'
import { isUnlocked } from '../sim/query'
import { useGameStore } from './gameStore'

const game = useGameStore()
</script>

<template>
  <div class="row">
    <button
      v-for="type in BUILD_ORDER"
      :key="type"
      type="button"
      class="chip"
      :class="{ on: game.buildType === type, locked: !isUnlocked(game.hospital, type) }"
      :disabled="!isUnlocked(game.hospital, type)"
      @click="game.pickBuild(type)"
    >
      {{ ROOM_LABEL[type] }}
      <em>{{ ROOM_DEF[type].cost }}</em>
    </button>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 6px 8px;
  border: 1px solid #4a6666;
  background: #1e3c3c;
  color: var(--paper);
  font: inherit;
  font-size: 13px;
}

.chip em {
  color: var(--iodine);
  font-family: var(--font-mono);
  font-style: normal;
  font-size: 11px;
}

.chip.on {
  border-color: var(--iodine);
  background: #2a4a32;
}

.chip.locked {
  opacity: 0.35;
}
</style>
