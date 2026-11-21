import { describe, expect, it } from 'vitest'
import { estadoEjercicio, formatearUltimaVez, indiceEjercicioActual, seriesHechas } from './sesion-activa'

const ej = (...completadas: boolean[]) => ({ series: completadas.map((completada) => ({ completada })) })

describe('estadoEjercicio', () => {
  it('completo, empezado y pendiente', () => {
    expect(estadoEjercicio(ej(true, true))).toBe('completo')
    expect(estadoEjercicio(ej(true, false))).toBe('empezado')
    expect(estadoEjercicio(ej(false, false))).toBe('pendiente')
  })
  it('sin series no cuenta como completo', () => {
    expect(estadoEjercicio(ej())).toBe('pendiente')
  })
})

describe('indiceEjercicioActual', () => {
  it('el primero sin completar', () => {
    expect(indiceEjercicioActual([ej(true, true), ej(true, false), ej(false)])).toBe(1)
  })
  it('si saltaste uno, vuelve al que quedó atrás', () => {
    expect(indiceEjercicioActual([ej(false, false), ej(true, true)])).toBe(0)
  })
  it('todo hecho: -1', () => {
    expect(indiceEjercicioActual([ej(true), ej(true, true)])).toBe(-1)
  })
})

describe('seriesHechas', () => {
  it('cuenta las completadas', () => {
    expect(seriesHechas(ej(true, false, true))).toBe('2 de 3')
  })
})

describe('formatearUltimaVez', () => {
  it('peso y reps, con coma decimal', () => {
    expect(formatearUltimaVez({ peso_kg: 72.5, repeticiones: 8 })).toBe('72,5 kg × 8')
  })
  it('solo uno de los dos', () => {
    expect(formatearUltimaVez({ peso_kg: 70, repeticiones: null })).toBe('70 kg')
    expect(formatearUltimaVez({ peso_kg: null, repeticiones: 12 })).toBe('12 reps')
  })
  it('sin dato', () => {
    expect(formatearUltimaVez(null)).toBeNull()
    expect(formatearUltimaVez({ peso_kg: null, repeticiones: null })).toBeNull()
  })
})
