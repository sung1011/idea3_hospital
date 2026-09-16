export type ClockGateEvent = 'start' | 'visibilitychange' | 'pagehide' | 'pageshow'
export type ClockGateAction = 'pause' | 'resume' | 'run' | 'none'

/** 隐藏/pagehide 停钟并落盘；回来再追 tick。开局已 settle，只上钟不重追。 */
export function clockGate(event: ClockGateEvent, hidden: boolean): ClockGateAction {
  if (event === 'pagehide') return 'pause'
  if (event === 'start') return hidden ? 'none' : 'run'
  if (event === 'pageshow' || event === 'visibilitychange') return hidden ? 'pause' : 'resume'
  return 'none'
}
