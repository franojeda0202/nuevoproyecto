import { SupabaseClient } from '@supabase/supabase-js'
import { ResultadoOperacion, PerfilUsuario } from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Obtener perfil del usuario.
 * Retorna null si el usuario no tiene perfil guardado aún (primera vez).
 */
export async function obtenerPerfil(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<PerfilUsuario | null>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('objetivo, nivel, equipamiento, duracion_minutos, genero')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (!data) return { success: true, data: null }

    return {
      success: true,
      data: {
        objetivo: data.objetivo as PerfilUsuario['objetivo'],
        nivel: data.nivel as PerfilUsuario['nivel'],
        equipamiento: data.equipamiento as PerfilUsuario['equipamiento'],
        duracionMinutos: data.duracion_minutos as PerfilUsuario['duracionMinutos'],
        genero: (data.genero ?? null) as PerfilUsuario['genero'],
      },
    }
  } catch (err) {
    console.error('Error en obtenerPerfil:', err)
    return { success: false, error: 'Error al cargar perfil' }
  }
}

/**
 * Guardar o actualizar perfil del usuario (upsert).
 * Incluye updated_at explícito para que se actualice en cada save.
 */
export async function guardarPerfil(
  supabase: SupabaseClient,
  userId: string,
  datos: PerfilUsuario
): Promise<ResultadoOperacion<PerfilUsuario>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('perfiles')
      .upsert(
        {
          user_id: userId,
          objetivo: datos.objetivo,
          nivel: datos.nivel,
          equipamiento: datos.equipamiento,
          duracion_minutos: datos.duracionMinutos,
          genero: datos.genero,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('objetivo, nivel, equipamiento, duracion_minutos, genero')
      .single()

    if (error) throw error

    return {
      success: true,
      data: {
        objetivo: data.objetivo as PerfilUsuario['objetivo'],
        nivel: data.nivel as PerfilUsuario['nivel'],
        equipamiento: data.equipamiento as PerfilUsuario['equipamiento'],
        duracionMinutos: data.duracion_minutos as PerfilUsuario['duracionMinutos'],
        genero: (data.genero ?? null) as PerfilUsuario['genero'],
      },
    }
  } catch (err) {
    console.error('Error en guardarPerfil:', err)
    return { success: false, error: 'Error al guardar perfil' }
  }
}
