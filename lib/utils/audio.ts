/**
 * Reproduce 3 beeps cortos usando Web Audio API.
 * El AudioContext debe haber sido creado y desbloqueado previamente
 * en un gesto del usuario (click/tap). Si audioCtx es null o está
 * en estado incorrecto, falla silenciosamente.
 */
export function reproducirBeep(audioCtx: AudioContext | null): void {
  if (!audioCtx) return

  // 3 beeps a 880Hz (La5), 150ms cada uno, separados 250ms
  const tiempos = [0, 0.25, 0.5]

  tiempos.forEach(delay => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.type = 'sine'
    osc.frequency.value = 880

    // Fade out para evitar click de audio al cortar
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.15)

    osc.start(audioCtx.currentTime + delay)
    osc.stop(audioCtx.currentTime + delay + 0.15)
  })
}
