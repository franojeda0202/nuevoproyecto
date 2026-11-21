import { describe, expect, it } from 'vitest'
import { formatearDuracion, resumirSesion } from './resumen-sesion'

const serie = (peso_kg: string, repeticiones: string, completada: boolean) => ({ peso_kg, repeticiones, completada })

describe('resumirSesion', () => {
  it('cuenta series y kilos solo de las completadas', () => {
    const r = resumirSesion([
      { nombre: 'Press inclinado', series: [serie('70', '8', true), serie('70', '9', true)] },
      { nombre: 'Pec deck', series: [serie('40', '12', true), serie('40', '', false)] },
    ])
    expect(r.seriesCompletadas).toBe(3)
    expect(r.seriesTotales).toBe(4)
    expect(r.kgMovidos).toBe(70 * 8 + 70 * 9 + 40 * 12)
  })

  it('lista los ejercicios con series sin completar', () => {
    const r = resumirSesion([
      { nombre: 'Completo', series: [serie('10', '10', true)] },
      { nombre: 'Tríceps trasnuca', series: [serie('', '', false), serie('', '', false)] },
    ])
    expect(r.incompletos).toEqual([{ nombre: 'Tríceps trasnuca', hechas: 0, total: 2 }])
  })

  it('una serie completada sin peso o sin reps no suma kilos', () => {
    const r = resumirSesion([{ nombre: 'X', series: [serie('', '10', true), serie('50', '', true)] }])
    expect(r.seriesCompletadas).toBe(2)
    expect(r.kgMovidos).toBe(0)
  })

  it('acepta coma decimal', () => {
    const r = resumirSesion([{ nombre: 'X', series: [serie('72,5', '2', true)] }])
    expect(r.kgMovidos).toBe(145)
  })

  it('sesión vacía', () => {
    expect(resumirSesion([])).toEqual({ seriesCompletadas: 0, seriesTotales: 0, kgMovidos: 0, incompletos: [], sinMarcar: [] })
  })
})

describe('sinMarcar', () => {
  it('series con peso y reps cargados pero sin marcar', () => {
    const r = resumirSesion([
      {
        nombre: 'Press',
        series: [
          { id: 'a', peso_kg: '70', repeticiones: '8', completada: true },
          { id: 'b', peso_kg: '70', repeticiones: '8', completada: false },
          { id: 'c', peso_kg: '70', repeticiones: '', completada: false },
          { id: 'd', peso_kg: '', repeticiones: '', completada: false },
        ],
      },
    ])
    expect(r.sinMarcar).toEqual(['b'])
  })
})

describe('formatearDuracion', () => {
  it('minutos', () => {
    expect(formatearDuracion(58 * 60)).toBe('58 min')
    expect(formatearDuracion(10)).toBe('1 min')
  })
  it('horas', () => {
    expect(formatearDuracion(65 * 60)).toBe('1 h 05 min')
  })
})
