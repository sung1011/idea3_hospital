<script setup lang="ts">
import { computed } from 'vue'
import { actualThroughput, isUnlocked, queueCap, stationSlots } from '../sim/query'
import { RECIPE, ROOM_LABEL, UPGRADE_COMPACT, UPGRADE_DUAL, UPGRADE_QUEUE } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()
const room = computed(() => game.selectedRoom)
const refund = computed(() => {
  if (!room.value) return 0
  return Math.floor(room.value.builtCost * 0.5 + room.value.upgradeSpent * 0.5)
})
</script>

<template>
  <section v-if="room" class="panel">
    <header>
      <strong>{{ ROOM_LABEL[room.type] }}</strong>
      <span>队 {{ room.queue.length }}/{{ queueCap(room) }}</span>
      <span>污 {{ Math.round(room.pollution) }}</span>
      <span v-if="room.type !== 'waiting'">吞吐 {{ actualThroughput(game.hospital, room).toFixed(1) }}</span>
      <span v-if="room.type === 'specialist' && room.recipeId">配方 {{ RECIPE[room.recipeId].name }}</span>
    </header>
    <div class="row">
      <template v-if="room.type !== 'waiting'">
        <button type="button" @click="game.assignIdleDoctor()">派空闲医生</button>
        <button
          v-for="id in room.doctorIds"
          :key="id"
          type="button"
          @click="game.unassignDoctor(id)"
        >
          撤下
        </button>
        <span class="muted">工位 {{ room.doctorIds.length }}/{{ stationSlots(room) }}</span>
      </template>
      <span v-else class="muted">候诊厅是箱子，不用派医生。</span>
    </div>
    <div class="row">
      <button type="button" :disabled="room.levelFlags.queuePlus2" @click="game.upgradeQueue()">
        队列+2 · {{ UPGRADE_QUEUE }}
      </button>
      <button
        v-if="room.type !== 'waiting'"
        type="button"
        :disabled="room.levelFlags.dualStation || !isUnlocked(game.hospital, 'dual')"
        :title="room.levelFlags.dualStation ? '已升级' : isUnlocked(game.hospital, 'dual') ? '' : '120 出院解锁'"
        @click="game.upgradeDual()"
      >
        双工位 · {{ UPGRADE_DUAL }}
      </button>
      <button
        v-if="room.type === 'surgery'"
        type="button"
        :disabled="room.levelFlags.compact || !isUnlocked(game.hospital, 'compact')"
        :title="room.levelFlags.compact ? '已升级' : isUnlocked(game.hospital, 'compact') ? '' : '80 出院解锁'"
        @click="game.upgradeCompact()"
      >
        紧凑 · {{ UPGRADE_COMPACT }}
      </button>
      <button type="button" class="danger" :aria-label="`卖掉，退 ${refund}`" @click="game.doSell()">
        卖掉 · 退 {{ refund }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #4a6666;
  background: #1e3c3c;
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

button {
  padding: 5px 8px;
  border: 1px solid #4a6666;
  background: #163333;
  color: var(--paper);
  font: inherit;
  font-size: 12px;
}

button:disabled {
  opacity: 0.4;
}

.danger {
  border-color: var(--stamp);
  color: #ffd4d4;
}

.muted {
  color: var(--muted);
  font-size: 12px;
}
</style>
