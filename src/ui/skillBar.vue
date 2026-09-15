<script setup lang="ts">
import { computed } from 'vue'
import { isUnlocked } from '../sim/query'
import { SKILL_DEF, SKILL_IDS } from '../sim/skills'
import { useGameStore } from './gameStore'

const game = useGameStore()

const chips = computed(() =>
  SKILL_IDS.map((id) => {
    const skill = game.hospital.skills.find((s) => s.id === id)
    const unlocked = isUnlocked(game.hospital, id)
    const cdLeft = skill?.cdLeft ?? 0
    return {
      id,
      label: SKILL_DEF[id].label,
      unlocked,
      cdLeft,
      locked: !unlocked || cdLeft > 0,
      cdText: cdLeft > 0 ? String(cdLeft) : `CD ${SKILL_DEF[id].cdS}`,
      title: unlocked ? '' : `${SKILL_DEF[id].unlockAt} 出院解锁`,
    }
  }),
)
</script>

<template>
  <div class="row">
    <button
      v-for="chip in chips"
      :key="chip.id"
      type="button"
      class="chip"
      :class="{ on: game.skillId === chip.id, locked: chip.locked }"
      :disabled="chip.locked"
      :title="chip.title"
      @click="game.pickSkill(chip.id)"
    >
      {{ chip.label }}
      <em>{{ chip.cdText }}</em>
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
