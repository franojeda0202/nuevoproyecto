import { describe, expect, it } from 'vitest'
import { cuandoFue, entrenamientosEstaSemana, inicioDeSemana, semanaActual, siguienteDia } from './hoy'

const dias = [
  { id: 'push', orden: 2, nombre_dia: 'Push' },
  { id: 'pull', orden: 1, nombre_dia: 'Pull' },
  { id: 'piernas', orden: 3, nombre_dia: 'Piernas' },
  { id: 'torso', orden: 4, nombre_dia: 'Torso' },
]

// Sábado 21 de noviembre de 2026, 10:00 hora local
const sabado = new Date(2026, 10, 21, 10, 0)
const local = (d: number, h = 19) => new Date(2026, 10, d, h, 0).toISOString()

describe('siguienteDia', () => {
  it('sin sesiones previas: el primero por orden', () => {
    expect(siguienteDia(dias, null)?.id).toBe('pull')
  })
  it('el siguiente al último entrenado', () => {
    expect(siguienteDia(dias, 'pull')?.id).toBe('push')
    expect(siguienteDia(dias, 'piernas')?.id).toBe('torso')
  })
  it('después del último vuelve al primero', () => {
    expect(siguienteDia(dias, 'torso')?.id).toBe('pull')
  })
  it('si el último día ya no está en la rutina, el primero', () => {
    expect(siguienteDia(dias, 'borrado')?.id).toBe('pull')
  })
  it('rutina vacía', () => {
    expect(siguienteDia([], null)).toBeNull()
  })
})

describe('inicioDeSemana', () => {
  it('sábado → lunes anterior', () => {
    expect(inicioDeSemana(sabado)).toEqual(new Date(2026, 10, 16))
  })
  it('domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(inicioDeSemana(new Date(2026, 10, 22, 23))).toEqual(new Date(2026, 10, 16))
  })
  it('lunes es su propio inicio', () => {
    expect(inicioDeSemana(new Date(2026, 10, 16, 8))).toEqual(new Date(2026, 10, 16))
  })
})

describe('semanaActual', () => {
  const sesiones = [
    { dia_id: 'pull', finalizada_at: local(16) }, // lunes
    { dia_id: 'push', finalizada_at: local(17) }, // martes
    { dia_id: 'torso', finalizada_at: local(13) }, // viernes de la semana pasada
  ]
  it('marca los días con sesión y hoy', () => {
    const semana = semanaActual(sesiones, sabado)
    expect(semana.map((d) => d.entrenado)).toEqual([true, true, false, false, false, false, false])
    expect(semana.findIndex((d) => d.esHoy)).toBe(5)
  })
  it('cuenta días distintos, no sesiones', () => {
    const dosElMismoDia = [...sesiones, { dia_id: 'piernas', finalizada_at: local(16, 21) }]
    expect(entrenamientosEstaSemana(dosElMismoDia, sabado)).toBe(2)
  })
})

describe('cuandoFue', () => {
  it('hoy, ayer y días de la semana', () => {
    expect(cuandoFue(local(21, 8), sabado)).toBe('hoy')
    expect(cuandoFue(local(20), sabado)).toBe('ayer')
    expect(cuandoFue(local(17), sabado)).toBe('el martes')
  })
  it('más de una semana: fecha corta', () => {
    expect(cuandoFue(local(10), sabado)).toBe('el 10 nov')
  })
})
