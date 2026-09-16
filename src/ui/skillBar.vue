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
      aiming: game.skillId === id,
      cdText: !unlocked
        ? `${SKILL_DEF[id].unlockAt}出院`
        : cdLeft > 0
          ? `${cdLeft}秒`
          : game.skillId === id
            ? '指定中'
            : '就绪',
      title: unlocked
        ? cdLeft > 0
          ? `冷却 ${cdLeft} 秒`
          : game.skillId === id
            ? '再点取消指定'
            : `冷却 ${SKILL_DEF[id].cdS} 秒`
        : `${SKILL_DEF[id].unlockAt} 出院解锁`,
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
      :class="{ on: chip.aiming, locked: chip.locked }"
      :disabled="chip.locked"
      :aria-pressed="game.skillId === chip.id"
      :aria-label="`${chip.label} ${chip.title}`"
      :title="chip.title"
      @click="game.pickSkill(chip.id)"
    >
      {{ chip.label }}
      <em>{{ chip.cdText }}</em>
    </button>
    <button
      v-if="game.skillId || game.lineFirst"
      type="button"
      class="chip cancel"
      aria-label="取消指定"
      @click="game.cancelTarget()"
    >
      取消指定
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

.chip.cancel {
  border-color: var(--stamp);
  color: #ffd4d4;
}

@media (max-width: 520px) {
  .chip {
    padding: 8px 10px;
    min-height: 36px;
  }
}
</style>
