<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { hasReception } from '../sim/query'
import { pendingOffer } from '../sim/week'
import Board from './board.vue'
import BuildBar from './buildBar.vue'
import ErBar from './erBar.vue'
import EventCard from './eventCard.vue'
import { useGameStore } from './gameStore'
import OfflineSummary from './offlineSummary.vue'
import RoomPanel from './roomPanel.vue'
import SkillBar from './skillBar.vue'
import StaffBar from './staffBar.vue'
import TopBar from './topBar.vue'
import WeekBar from './weekBar.vue'
import WeekOffer from './weekOffer.vue'

const game = useGameStore()
const running = computed(() => hasReception(game.hospital))
const hasOffer = computed(() => !!pendingOffer(game.hospital))
const shift = computed(() => {
  if (game.hospital.fame <= 0) return '夜班 · 口碑见底，日常病人不进门'
  if (!running.value) return '夜班 · 先放前台'
  return '夜班 · 产线在转'
})

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
      <p class="shift">{{ shift }}</p>
      <h1>格子医院</h1>
    </header>
    <TopBar />
    <StaffBar />
    <ErBar />
    <WeekBar />
    <BuildBar />
    <SkillBar />
    <p v-if="game.notice" class="notice" role="status" aria-live="polite">{{ game.notice }}</p>
    <Board />
    <RoomPanel />
    <p class="hint">
      {{
        game.skillId === 'flush' && !game.lineFirst
          ? '冲洗：先点一格，再点相邻格定方向。再点技能、点「取消指定」、Esc 或棋盘外空白取消。'
          : game.skillId === 'flush'
            ? '再点相邻一格定方向。再点技能、点「取消指定」、Esc 或棋盘外空白取消。'
            : game.skillId
              ? '点地块施放。空地可点但没房无效。再点技能、点「取消指定」、Esc 或棋盘外空白取消。'
              : game.buildType === 'reception'
                ? '前台只能放底行、贴着正门的三格（有绿框的那些）。'
                : game.buildType === 'surgery' && !game.surgeryFirst
                  ? '手术室：先点第一格，再点相邻格。'
                  : game.hospital.fame <= 0
                    ? '口碑到 0：日常进场停了。事件卡、场内出院或周结算才能拉回来。特殊病人仍可三选一。'
                    : '选房间类型，点空地建造。点已建房派人、升级或卖掉。点技能再点地块清污染。累计出院 80 开急诊，100 开周赛 / 专科 / 截诊。试玩加 ?week=1 会把出院至少拉到 100。'
      }}
    </p>
    <OfflineSummary />
    <EventCard v-if="!game.offlineSummary && !hasOffer" />
    <WeekOffer />
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

@media (max-width: 520px) {
  .shell {
    gap: 8px;
    padding: 12px 10px 20px;
  }

  h1 {
    font-size: 22px;
    letter-spacing: 0.08em;
  }
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
