import { describe, expect, it } from 'vitest'
import { createHospital } from './createHospital'
import { START_FAME, START_MONEY } from './tables'
import { tick } from './tick'

describe('createHospital', () => {
  it('opens with starting money, fame, one doctor and one nurse', () => {
    const hospital = createHospital()
    expect(hospital.money).toBe(START_MONEY)
    expect(hospital.fame).toBe(START_FAME)
    expect(hospital.nurses).toBe(1)
    expect(hospital.doctors).toHaveLength(1)
    expect(hospital.rooms).toHaveLength(0)
    expect(hospital.patients).toHaveLength(0)
  })
})

describe('tick', () => {
  it('advances elapsedS by 1 and does not spawn anyone', () => {
    const hospital = createHospital()
    const next = tick(hospital)
    expect(next.elapsedS).toBe(1)
    expect(next.patients).toHaveLength(0)
    expect(next.money).toBe(hospital.money)
  })
})
