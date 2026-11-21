import { describe, expect, it } from 'vitest'
import {
  formatearPrescripcion,
  rangoDeSerie,
  separarRangos,
  tieneRangosPorSerie,
  validarRangos,
} from './rangos-series'

describe('separarRangos', () => {
  it('un solo rango', () => {
    expect(separarRangos('8-11')).toEqual(['8-11'])
  })
  it('varios rangos, con o sin espacios', () => {
    expect(separarRangos('6-8 / 8-10')).toEqual(['6-8', '8-10'])
    expect(separarRangos('6-8/8-10')).toEqual(['6-8', '8-10'])
  })
  it('ignora vacíos', () => {
    expect(separarRangos(' / 6-8 / ')).toEqual(['6-8'])
    expect(separarRangos('')).toEqual([])
  })
})

describe('rangoDeSerie', () => {
  it('un solo rango vale para todas las series', () => {
    expect(rangoDeSerie('8-11', 1)).toBe('8-11')
    expect(rangoDeSerie('8-11', 3)).toBe('8-11')
  })
  it('un rango por serie', () => {
    expect(rangoDeSerie('6-8 / 8-10', 1)).toBe('6-8')
    expect(rangoDeSerie('6-8 / 8-10', 2)).toBe('8-10')
  })
  it('si hay menos rangos que series, el último se repite', () => {
    // Press inclinado 45° con mancuernas de Rama: 3 series, 6-8 / 8-12 / 8-12
    expect(rangoDeSerie('6-8 / 8-12', 3)).toBe('8-12')
  })
  it('texto libre se respeta', () => {
    expect(rangoDeSerie('Al fallo', 2)).toBe('Al fallo')
  })
  it('vacío devuelve vacío', () => {
    expect(rangoDeSerie('', 1)).toBe('')
  })
})

describe('tieneRangosPorSerie', () => {
  it('falso con un rango o con rangos iguales', () => {
    expect(tieneRangosPorSerie('8-11')).toBe(false)
    expect(tieneRangosPorSerie('8-11 / 8-11')).toBe(false)
  })
  it('verdadero con rangos distintos', () => {
    expect(tieneRangosPorSerie('6-8 / 8-10')).toBe(true)
  })
})

describe('formatearPrescripcion', () => {
  it('rango único: series × rango', () => {
    expect(formatearPrescripcion(3, '8-11')).toBe('3 × 8-11')
  })
  it('rangos por serie: solo las series, el detalle va en cada fila', () => {
    expect(formatearPrescripcion(3, '6-8 / 8-12')).toBe('3 series')
  })
  it('sin repeticiones: solo las series', () => {
    expect(formatearPrescripcion(3, '')).toBe('3 series')
  })
})

describe('validarRangos', () => {
  it('acepta un rango o tantos como series', () => {
    expect(validarRangos(3, '8-11')).toBeNull()
    expect(validarRangos(2, '6-8 / 8-10')).toBeNull()
    expect(validarRangos(3, '6-8 / 8-12')).toBeNull()
  })
  it('rechaza vacío', () => {
    expect(validarRangos(3, '  ')).not.toBeNull()
  })
  it('rechaza más rangos que series', () => {
    expect(validarRangos(2, '6-8 / 8-10 / 10-12')).toMatch(/3 rangos.*2 series/)
  })
})
