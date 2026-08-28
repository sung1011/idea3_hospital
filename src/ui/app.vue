<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Board from './board.vue'
import { useGameStore } from './gameStore'
import TopBar from './topBar.vue'

const game = useGameStore()

onMounted(() => {
  game.startClock()
})

onUnmounted(() => {
  game.stopClock()
})
</script>

<template>
  <div class="shell">
    <header class="mast">
      <p class="shift">夜班 · 产线未开</p>
      <h1>格子医院</h1>
    </header>
    <TopBar />
    <Board />
    <p class="hint">先放前台。正门在底边正中，前台必须贴着它。</p>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 420px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 20px 16px 28px;
  background:
    radial-gradient(ellipse at 50% -10%, #2a4f4f 0%, transparent 55%),
    var(--night);
}

.mast {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shift {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.18em;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
