<script setup lang="ts">
import { DOOR_COL, GRID_SIZE } from '../sim/tables'

const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
  r: Math.floor(i / GRID_SIZE),
  c: i % GRID_SIZE,
}))
</script>

<template>
  <div class="wrap">
    <div class="floor" :style="{ '--n': GRID_SIZE }">
      <div
        v-for="cell in cells"
        :key="`${cell.r}-${cell.c}`"
        class="tile"
        :class="{ doorCol: cell.c === DOOR_COL && cell.r === GRID_SIZE - 1 }"
      >
        <span class="coord">{{ cell.r + 1 }}-{{ cell.c + 1 }}</span>
      </div>
    </div>
    <div class="apron" :style="{ '--n': GRID_SIZE }">
      <span
        v-for="col in GRID_SIZE"
        :key="col"
        class="slot"
        :class="{ door: col - 1 === DOOR_COL }"
      >
        <template v-if="col - 1 === DOOR_COL">正门</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  padding: 14px 14px 10px;
  background: var(--paper);
  box-shadow: 0 12px 0 #8f8674;
}

.floor {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  aspect-ratio: 1;
  background: var(--grout);
  gap: 2px;
  border: 2px solid var(--ink);
}

.tile {
  position: relative;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 14%) 0 1px, transparent 1px),
    var(--linoleum);
}

.tile.doorCol {
  box-shadow: inset 0 -3px 0 var(--stamp);
}

.coord {
  position: absolute;
  top: 4px;
  left: 5px;
  color: #6f6756;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
}

.apron {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  margin-top: 6px;
}

.slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
}

.door {
  color: #fff8f0;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2em;
  background: var(--stamp);
  box-shadow: 2px 2px 0 #7a1f28;
}
</style>
