import { describe, expect, it } from 'vitest'
import { formatearTiempo, segundosDesde } from './tiempo'

describe('formatearTiempo', () => {
  it('minutos y segundos', () => {
    expect(formatearTiempo(309)).toBe('05:09')
  })
  it('con horas', () => {
    expect(formatearTiempo(3723)).toBe('1:02:03')
  })
  it('negativo cuenta como cero', () => {
    expect(formatearTiempo(-5)).toBe('00:00')
  })
})

describe('segundosDesde', () => {
  it('diferencia en segundos', () => {
    const inicio = '2026-11-21T10:00:00.000Z'
    expect(segundosDesde(inicio, Date.parse('2026-11-21T10:32:14.900Z'))).toBe(1934)
  })
  it('nunca negativo si el reloj del teléfono atrasa', () => {
    expect(segundosDesde('2026-11-21T10:00:10.000Z', Date.parse('2026-11-21T10:00:00.000Z'))).toBe(0)
  })
})
