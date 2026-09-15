<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { hasReception } from '../sim/query'
import Board from './board.vue'
import BuildBar from './buildBar.vue'
import EventCard from './eventCard.vue'
import { useGameStore } from './gameStore'
import OfflineSummary from './offlineSummary.vue'
import RoomPanel from './roomPanel.vue'
import SkillBar from './skillBar.vue'
import StaffBar from './staffBar.vue'
import TopBar from './topBar.vue'

const game = useGameStore()
const running = computed(() => hasReception(game.hospital))

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
      <p class="shift">{{ running ? '夜班 · 产线在转' : '夜班 · 先放前台' }}</p>
      <h1>格子医院</h1>
    </header>
    <TopBar />
    <StaffBar />
    <BuildBar />
    <SkillBar />
    <p v-if="game.notice" class="notice">{{ game.notice }}</p>
    <Board />
    <RoomPanel />
    <p class="hint">
      {{
        game.skillId === 'flush' && !game.lineFirst
          ? '冲洗：先点一格，再点相邻格定方向。点棋盘外空白取消。'
          : game.skillId === 'flush'
            ? '再点相邻一格定方向。点棋盘外空白取消。'
            : game.skillId
              ? '点地块施放。空地可点但没房无效。点棋盘外空白取消。'
              : game.buildType === 'reception'
                ? '前台只能放底行、贴着正门的三格（有绿框的那些）。'
                : game.buildType === 'surgery' && !game.surgeryFirst
                  ? '手术室：先点第一格，再点相邻格。'
                  : '选房间类型，点空地建造。点已建房派人、升级或卖掉。点技能再点地块清污染。'
      }}
    </p>
    <OfflineSummary />
    <EventCard v-if="!game.offlineSummary" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(720px, 100%);
  max-width: 720px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 24px 20px 32px;
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

.hint,
.notice {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.hint {
  color: var(--muted);
}

.notice {
  color: var(--iodine);
}
</style>
