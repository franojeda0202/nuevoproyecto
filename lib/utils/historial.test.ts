import { describe, expect, it } from 'vitest'
import { agruparPorMes, duracionMinutos, partesDeFecha } from './historial'

const ahora = new Date(2026, 10, 21, 12) // sábado 21 de noviembre de 2026
const s = (y: number, m: number, d: number) => ({ finalizada_at: new Date(y, m, d, 19).toISOString() })

describe('agruparPorMes', () => {
  it('agrupa en orden y titula el mes actual, otros meses del año y otros años', () => {
    const grupos = agruparPorMes([s(2026, 10, 21), s(2026, 10, 2), s(2026, 9, 9), s(2025, 2, 17)], ahora)
    expect(grupos.map((g) => [g.titulo, g.items.length])).toEqual([
      ['Este mes', 2],
      ['Octubre', 1],
      ['Marzo de 2025', 1],
    ])
  })
  it('sin sesiones', () => {
    expect(agruparPorMes([], ahora)).toEqual([])
  })
})

describe('partesDeFecha', () => {
  it('número y día corto', () => {
    expect(partesDeFecha(new Date(2026, 10, 21, 19).toISOString())).toEqual({ numero: '21', dia: 'Sáb' })
  })
})

describe('duracionMinutos', () => {
  it('redondea a minutos', () => {
    expect(duracionMinutos('2026-11-21T10:00:00Z', '2026-11-21T10:48:20Z')).toBe(48)
  })
  it('menos de un minuto cuenta como 1', () => {
    expect(duracionMinutos('2026-11-21T10:00:00Z', '2026-11-21T10:00:10Z')).toBe(1)
  })
  it('sin inicio o con fin antes del inicio: null', () => {
    expect(duracionMinutos(null, '2026-11-21T10:00:00Z')).toBeNull()
    expect(duracionMinutos('2026-11-21T11:00:00Z', '2026-11-21T10:00:00Z')).toBeNull()
  })
})
