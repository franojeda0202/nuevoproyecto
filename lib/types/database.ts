// Tipos para las tablas de la base de datos

// Valores posibles para segmento y patrón de movimiento
export type Segmento = 'superior' | 'inferior' | 'core' | string
export type PatronMovimiento = 
  | 'push' 
  | 'pull' 
  | 'rodilla' 
  | 'cadera' 
  | 'core' 
  | 'aislamiento'
  | string

export interface Ejercicio {
  id: string
  nombre: string
  segmento: Segmento
  patron_movimiento: PatronMovimiento
  grupo_muscular: string
  tipo_ejercicio: string
  equipamiento: string
  dificultad_tecnica: number
  instrucciones_base: string | null
  created_at: string
}

export interface Rutina {
  id: string
  user_id: string
  nombre: string
  objetivo: string | null
  frecuencia: number
  created_at: string
}

export interface RutinaDia {
  id: string
  rutina_id: string
  nombre_dia: string
  orden: number
  created_at: string
}

export interface RutinaEjercicio {
  id: string
  dia_id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  orden: number
  notas_coach: string | null
  created_at: string
}

// Tipos compuestos para la UI

export interface EjercicioConNombre {
  id: string
  nombre: string
  series: number
  repeticiones: string
  orden: number
  notas_coach: string | null
}

export interface DiaConEjercicios {
  id: string
  nombre_dia: string
  orden: number
  ejercicios: EjercicioConNombre[]
}

export interface RutinaCompleta {
  rutina: {
    id: string
    nombre: string
    objetivo: string | null
    frecuencia: number
    created_at: string
  }
  dias: DiaConEjercicios[]
}

// Tipos para el formulario de onboarding

export interface OnboardingConfig {
  frecuencia: number
  enfoque: string
  genero: string
  ubicacion: string
}

export interface GenerarRutinaRequest {
  user_id: string
  config: OnboardingConfig
}

// ============================================
// Tipos para Edición de Rutina
// ============================================

// Ejercicio en la rutina con toda la info necesaria para edición
export interface EjercicioEditable {
  // Datos de rutina_ejercicios
  id: string                    // UUID de rutina_ejercicios
  dia_id: string               // UUID del día
  ejercicio_id: string         // UUID del ejercicio del catálogo
  series: number
  repeticiones: string         // "8-12", "10", etc.
  orden: number
  notas_coach: string | null
  
  // Datos del ejercicio (para mostrar y filtrar)
  ejercicio: {
    nombre: string
    segmento: Segmento
    patron_movimiento: PatronMovimiento
    grupo_muscular: string
    equipamiento: string
  }
}

// Datos para crear un nuevo ejercicio en la rutina
export interface NuevoEjercicioRutina {
  dia_id: string
  ejercicio_id: string
  series: number
  repeticiones: string
  orden: number
  notas_coach?: string | null
}

// Datos para actualizar un ejercicio existente
export interface ActualizarEjercicioRutina {
  id: string                   // UUID del registro a actualizar
  ejercicio_id?: string        // Cambiar ejercicio (opcional)
  series?: number
  repeticiones?: string
  notas_coach?: string | null
}

// Estado del modal de edición
export interface ModalEjercicioState {
  isOpen: boolean
  mode: 'edit' | 'add'
  diaId: string | null
  ejercicio: EjercicioEditable | null  // null cuando es modo 'add'
}

// Filtros para buscar ejercicios alternativos
export interface FiltroEjercicios {
  segmento?: Segmento
  patron_movimiento?: PatronMovimiento
  grupo_muscular?: string
  busqueda?: string            // Búsqueda por nombre
}

// Resultado de operaciones CRUD
export interface ResultadoOperacion<T = void> {
  success: boolean
  data?: T
  error?: string
}

// Día con ejercicios editables (para la UI de edición)
export interface DiaConEjerciciosEditables {
  id: string
  nombre_dia: string
  orden: number
  ejercicios: EjercicioEditable[]
}

// ============================================
// Tipos para Sesiones de Entrenamiento
// ============================================

export interface Sesion {
  id: string
  user_id: string
  rutina_id: string
  dia_id: string
  iniciada_at: string
  finalizada_at: string | null
  created_at: string
}

export interface SesionSerie {
  id: string
  sesion_id: string
  rutina_ejercicio_id: string
  numero_serie: number
  peso_kg: number | null
  repeticiones: number | null
  completada: boolean
  created_at: string
  updated_at: string
}

// Estado editable de una serie (inputs como string para los inputs HTML)
export interface SesionSerieEditable {
  id: string
  sesion_id: string
  rutina_ejercicio_id: string
  numero_serie: number
  peso_kg: string       // string para el input (vacío = no ingresado)
  repeticiones: string  // string para el input
  completada: boolean
}

// Ejercicio con sus series para la pantalla de sesión activa
export interface EjercicioConSeries {
  rutina_ejercicio_id: string
  nombre: string
  series_rutina: number  // cuántas series tiene programadas en la rutina
  series: SesionSerieEditable[]
  ultima_serie: { peso_kg: number | null; repeticiones: number | null } | null  // pre-fill
}

// Datos completos para la pantalla de sesión activa
export interface SesionActiva {
  id: string
  dia_nombre: string
  finalizada_at: string | null
  ejercicios: EjercicioConSeries[]
}

// ============================================
// Tipos para Historial de Entrenamientos
// ============================================

export interface SesionResumen {
  id: string
  dia_nombre: string
  finalizada_at: string    // ISO string
  series_completadas: number
}

export interface SerieDetalle {
  numero_serie: number
  peso_kg: number | null
  repeticiones: number | null
  completada: boolean
}

export interface EjercicioDetalle {
  nombre: string
  series: SerieDetalle[]
}

export interface SesionDetalle {
  id: string
  dia_nombre: string
  finalizada_at: string
  ejercicios: EjercicioDetalle[]
}
