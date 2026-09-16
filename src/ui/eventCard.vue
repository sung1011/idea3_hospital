<script setup lang="ts">
import { EVENT_TEXT } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()
</script>

<template>
  <div v-if="game.hospital.pendingEvent" class="mask">
    <div class="card">
      <p class="kicker">值班室</p>
      <h2>{{ EVENT_TEXT[game.hospital.pendingEvent].title }}</h2>
      <div class="choices">
        <button type="button" autofocus @click="game.chooseEvent('left')">
          {{ EVENT_TEXT[game.hospital.pendingEvent].left }}
        </button>
        <button type="button" @click="game.chooseEvent('right')">
          {{ EVENT_TEXT[game.hospital.pendingEvent].right }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 20;
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
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.4;
}

.choices {
  display: grid;
  gap: 8px;
}

button {
  padding: 10px 12px;
  border: 1px solid var(--ink);
  background: #f3ead8;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  text-align: left;
}
</style>
