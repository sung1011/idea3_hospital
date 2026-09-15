<script setup lang="ts">
import { computed } from 'vue'
import { canReceiveAt } from '../sim/build'
import { isUnlocked, manhattan, queueCap } from '../sim/query'
import { DISEASE_LABEL, DOOR_COL, ER_DOOR_COL, GRID_SIZE, ROOM_LABEL } from '../sim/tables'
import type { Room, Tile } from '../sim/types'
import { useGameStore } from './gameStore'

const game = useGameStore()

const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
  r: Math.floor(i / GRID_SIZE),
  c: i % GRID_SIZE,
}))

function roomOn(tile: Tile): Room | undefined {
  return game.hospital.rooms.find((room) => room.tiles.some((t) => t.r === tile.r && t.c === tile.c))
}

function canDrop(tile: Tile): boolean {
  if (!game.buildType || roomOn(tile)) return false
  if (game.buildType === 'reception') return canReceiveAt(tile)
  if (game.buildType === 'surgery' && game.surgeryFirst) {
    return manhattan(game.surgeryFirst, tile) === 1
  }
  return true
}

function canAim(tile: Tile): boolean {
  if (!game.skillId) return false
  if (game.lineFirst) return manhattan(game.lineFirst, tile) === 1
  return true
}

function stain(room: Room | undefined): string {
  if (!room || room.pollution <= 0) return ''
  const a = Math.min(0.55, room.pollution / 160)
  return `rgba(90, 40, 80, ${a})`
}

const actors = computed(() =>
  game.hospital.patients.filter(
    (p) => p.state === 'walk' || p.state === 'queue' || p.state === 'treat' || p.state === 'waitHall',
  ),
)

function actorStyle(p: { x: number; y: number }) {
  return {
    left: `${((p.x + 0.5) / GRID_SIZE) * 100}%`,
    top: `${((p.y + 0.5) / (GRID_SIZE + 0.72)) * 100}%`,
  }
}

const erUnlocked = computed(() => isUnlocked(game.hospital, 'er'))
const erOpen = computed(() => game.hospital.erOpen)
</script>

<template>
  <div class="wrap" @click.self="game.cancelTarget()">
    <div class="map" @click.self="game.cancelTarget()">
      <div class="floor" :style="{ '--n': GRID_SIZE }">
        <button
          v-for="cell in cells"
          :key="`${cell.r}-${cell.c}`"
          type="button"
          class="tile"
          :class="{
            doorCol: cell.c === DOOR_COL && cell.r === GRID_SIZE - 1,
            erCol: erUnlocked && cell.c === ER_DOOR_COL && cell.r === GRID_SIZE - 1,
            on: game.selectedRoom && roomOn(cell)?.id === game.selectedRoom.id,
            pick:
              (game.surgeryFirst && game.surgeryFirst.r === cell.r && game.surgeryFirst.c === cell.c) ||
              (game.lineFirst && game.lineFirst.r === cell.r && game.lineFirst.c === cell.c),
            drop: canDrop(cell) || canAim(cell),
          }"
          @click="game.clickTile(cell)"
        >
          <span class="coord">{{ cell.r + 1 }}-{{ cell.c + 1 }}</span>
          <span v-if="roomOn(cell)" class="room">
            {{ ROOM_LABEL[roomOn(cell)!.type] }}
            <small v-if="roomOn(cell)!.type !== 'waiting' || roomOn(cell)!.queue.length"
              >{{ roomOn(cell)!.queue.length }}/{{ queueCap(roomOn(cell)!) }}</small
            >
          </span>
          <i class="dirt" :style="{ background: stain(roomOn(cell)) }" />
        </button>
      </div>
      <div class="apron" :style="{ '--n': GRID_SIZE }" @click="game.cancelTarget()">
        <span
          v-for="col in GRID_SIZE"
          :key="col"
          class="slot"
          :class="{
            door: col - 1 === DOOR_COL,
            er: erUnlocked && col - 1 === ER_DOOR_COL,
            erShut: erUnlocked && !erOpen && col - 1 === ER_DOOR_COL,
          }"
        >
          <template v-if="col - 1 === DOOR_COL">正门</template>
          <template v-else-if="erUnlocked && col - 1 === ER_DOOR_COL">{{ erOpen ? '急诊' : '急诊关' }}</template>
        </span>
      </div>
      <div class="actors">
        <i
          v-for="p in actors"
          :key="p.id"
          class="dot"
          :class="[p.disease, { erDot: p.isEr }]"
          :title="`${DISEASE_LABEL[p.disease]}${p.isEr ? ' · 急诊' : ''} 怒${p.rage}`"
          :style="actorStyle(p)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  padding: 14px 14px 10px;
  background: var(--paper);
  box-shadow: 0 12px 0 #8f8674;
}

.map {
  position: relative;
}

.floor {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  aspect-ratio: 1;
  background: var(--grout);
  gap: 2px;
  border: 2px solid var(--ink);
}

.tile {
  position: relative;
  overflow: hidden;
  min-height: 0;
  padding: 0;
  border: 0;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 14%) 0 1px, transparent 1px),
    var(--linoleum);
  color: var(--ink);
  font: inherit;
  text-align: left;
}

.tile.doorCol {
  box-shadow: inset 0 -3px 0 var(--stamp);
}

.tile.erCol {
  box-shadow: inset 0 -3px 0 var(--iodine);
}

.tile.on {
  outline: 2px solid var(--stamp);
  outline-offset: -2px;
}

.tile.pick {
  outline: 2px dashed #2a4a32;
  outline-offset: -2px;
}

.tile.drop {
  outline: 2px dashed #3d6b3a;
  outline-offset: -2px;
  cursor: pointer;
}

.coord {
  position: absolute;
  top: 5px;
  left: 6px;
  z-index: 1;
  color: #6f6756;
  font-family: var(--font-mono);
  font-size: 11px;
}

.room {
  position: absolute;
  right: 6px;
  bottom: 6px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.15;
}

.room small {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

.dirt {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.apron {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  margin-top: 6px;
}

.slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.door {
  color: #fff8f0;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2em;
  background: var(--stamp);
  box-shadow: 2px 2px 0 #7a1f28;
}

.er {
  color: #1a1410;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
  background: var(--iodine);
  box-shadow: 2px 2px 0 #8a5a10;
}

.er.erShut {
  color: var(--paper);
  background: #3d5555;
  box-shadow: 2px 2px 0 #2a3c3c;
}

.actors {
  position: absolute;
  inset: 0 0 0 0;
  pointer-events: none;
}

.dot {
  position: absolute;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border: 1px solid #1a1410;
  border-radius: 50%;
}

.dot.cold {
  background: #4f7d48;
}
.dot.fracture {
  background: #c47b2b;
}
.dot.infectious {
  background: #6b3fa0;
}
.dot.vip {
  background: #e0b12a;
}

.dot.erDot {
  box-shadow: 0 0 0 2px var(--iodine);
}
</style>
