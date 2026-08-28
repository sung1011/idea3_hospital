import type { Hospital } from './types'

/** Vue 的 reactive 代理不能 structuredClone，用 JSON 走属性取值。 */
export function cloneHospital(h: Hospital): Hospital {
  return JSON.parse(JSON.stringify(h)) as Hospital
}
