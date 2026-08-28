<script setup lang="ts">
import { computed } from 'vue'
import { actualThroughput, isUnlocked, queueCap, stationSlots } from '../sim/query'
import { ROOM_LABEL, UPGRADE_COMPACT, UPGRADE_DUAL, UPGRADE_QUEUE } from '../sim/tables'
import { useGameStore } from './gameStore'

const game = useGameStore()
const room = computed(() => game.selectedRoom)
const idleCleaner = computed(() => game.hospital.cleaners.find((c) => !c.roomId))
</script>

<template>
  <section v-if="room" class="panel">
    <header>
      <strong>{{ ROOM_LABEL[room.type] }}</strong>
      <span>队 {{ room.queue.length }}/{{ queueCap(room) }}</span>
      <span>污 {{ Math.round(room.pollution) }}</span>
      <span v-if="room.type !== 'waiting'">吞吐 {{ actualThroughput(game.hospital, room).toFixed(1) }}</span>
    </header>
    <div class="row">
      <button type="button" @click="game.assignIdleDoctor()">派空闲医生</button>
      <button
        v-for="id in room.doctorIds"
        :key="id"
        type="button"
        @click="game.unassignDoctor(id)"
      >
        撤 {{ id }}
      </button>
      <span class="muted">工位 {{ room.doctorIds.length }}/{{ stationSlots(room) }}</span>
    </div>
    <div v-if="isUnlocked(game.hospital, 'cleaner')" class="row">
      <button type="button" :disabled="!idleCleaner" @click="game.assignIdleCleaner()">派保洁</button>
    </div>
    <div class="row">
      <button type="button" :disabled="room.levelFlags.queuePlus2" @click="game.upgradeQueue()">
        队列+2 · {{ UPGRADE_QUEUE }}
      </button>
      <button
        v-if="room.type !== 'waiting'"
        type="button"
        :disabled="room.levelFlags.dualStation || !isUnlocked(game.hospital, 'dual')"
        @click="game.upgradeDual()"
      >
        双工位 · {{ UPGRADE_DUAL }}
      </button>
      <button
        v-if="room.type === 'surgery'"
        type="button"
        :disabled="room.levelFlags.compact || !isUnlocked(game.hospital, 'compact')"
        @click="game.upgradeCompact()"
      >
        紧凑 · {{ UPGRADE_COMPACT }}
      </button>
      <button type="button" class="danger" @click="game.doSell()">卖掉</button>
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
