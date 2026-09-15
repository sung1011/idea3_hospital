<script setup lang="ts">
import { computed } from 'vue'
import { RECIPE } from '../sim/tables'
import { pendingOffer } from '../sim/week'
import { useGameStore } from './gameStore'

const game = useGameStore()
const city = computed(() => pendingOffer(game.hospital))
const name = computed(() => (city.value ? RECIPE[city.value.recipeId].name : ''))
</script>

<template>
  <div v-if="city" class="mask">
    <div class="card">
      <p class="kicker">城市特殊病人</p>
      <h2>本市出现了「{{ name }}」病人。</h2>
      <p class="sub">必须选一项。倒计时结束按转出处理。</p>
      <div class="choices">
        <button type="button" @click="game.chooseOffer('accept')">接诊。按本周配方走产线，治好拿钱和周分。</button>
        <button type="button" @click="game.chooseOffer('transfer')">转出。拿 10 钱情报费，对手去抢。</button>
        <button type="button" @click="game.chooseOffer('recipe')">改配方。专科立刻套上本周配方，病人转给下一家。</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 21;
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
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.4;
}

.sub {
  margin: 0 0 16px;
  color: #6a5c4c;
  font-size: 13px;
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
