<script setup lang="ts">
import { SKILL_DEF, SKILL_ORDER } from '../sim/tables'
import type { SkillId } from '../sim/types'
import { useGameStore } from './gameStore'

const game = useGameStore()

function skill(id: SkillId) {
  return game.hospital.skills.find((s) => s.id === id)
}
</script>

<template>
  <div class="row">
    <button
      v-for="id in SKILL_ORDER"
      :key="id"
      type="button"
      class="chip"
      :class="{
        on: game.skillId === id,
        locked: !skill(id)?.unlocked,
        cool: (skill(id)?.cdLeft ?? 0) > 0,
      }"
      :disabled="!skill(id)?.unlocked || (skill(id)?.cdLeft ?? 0) > 0"
      @click="game.pickSkill(id)"
    >
      {{ SKILL_DEF[id].label }}
      <em v-if="(skill(id)?.cdLeft ?? 0) > 0">{{ skill(id)?.cdLeft }}</em>
      <em v-else-if="!skill(id)?.unlocked">{{ SKILL_DEF[id].unlockAt }}</em>
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

.chip.locked,
.chip.cool {
  opacity: 0.35;
}
</style>
