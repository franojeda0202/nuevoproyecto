# Entrenamientos — Modelo de Datos y Flujo

Referencia para implementar métricas y analytics de entrenamiento.

## Tablas

### `sesiones`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `rutina_id` | uuid | FK → rutinas |
| `dia_id` | uuid | FK → rutina_dias |
| `iniciada_at` | timestamptz | Set on INSERT (default now()) |
| `finalizada_at` | timestamptz | NULL = sesión activa; SET = sesión finalizada |

**Constraint:** `UNIQUE INDEX sesiones_user_sesion_activa_unique ON sesiones(user_id) WHERE finalizada_at IS NULL`
→ máximo 1 sesión activa por usuario en todo momento.

### `sesion_series`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `sesion_id` | uuid | FK → sesiones |
| `rutina_ejercicio_id` | uuid | FK → rutina_ejercicios (snapshot de la rutina al momento de crear la sesión) |
| `numero_serie` | int | 1-based (1, 2, 3…) |
| `peso_kg` | numeric | NULL si el usuario no registró peso |
| `repeticiones` | int | NULL si el usuario no registró reps |
| `completada` | boolean | false por defecto; true cuando el usuario marca la serie |
| `updated_at` | timestamptz | Se actualiza en cada auto-save |

**Nota importante:** Las filas de `sesion_series` se crean todas al inicio de la sesión (snapshot). Si el usuario edita su rutina después de empezar una sesión, las series no se actualizan — reflejan la rutina original.

---

## Flujo completo de una sesión

```
1. crearSesion(userId, rutinaId, diaId)
   → INSERT sesiones  →  sesionId
   → SELECT rutina_ejercicios WHERE dia_id = diaId (ordenados por `orden`)
   → INSERT sesion_series: (ejercicio × numero_serie) con completada=false, peso=null, reps=null

2. Sesión activa en /entrenar/[sesionId]
   → Blur en input peso/reps  →  actualizarSerie (fire-and-forget, sin completada)
   → Toggle checkbox          →  actualizarSerie (con completada=true/false)

3. finalizarSesion(sesionId, userId)
   → UPDATE sesiones SET finalizada_at = NOW()
   → Sesión inmutable a partir de este punto

4. Historial en /entrenamiento
   → obtenerHistorialSesiones: lista sesiones WHERE finalizada_at IS NOT NULL
   → Conteo de series completadas por sesión en una sola query a sesion_series

5. Detalle en /entrenamiento/[sesionId]
   → obtenerDetalleSesion: sesión + ejercicios del día + series registradas
```

---

## Queries para métricas

### Volumen total por sesión (kg × reps, solo series completadas)

```sql
SELECT
  s.id            AS sesion_id,
  s.finalizada_at,
  rd.nombre_dia,
  SUM(ss.peso_kg * ss.repeticiones) AS volumen_kg
FROM sesiones s
JOIN rutina_dias rd ON rd.id = s.dia_id
JOIN sesion_series ss ON ss.sesion_id = s.id
WHERE s.user_id = $userId
  AND s.finalizada_at IS NOT NULL
  AND ss.completada = true
  AND ss.peso_kg IS NOT NULL
  AND ss.repeticiones IS NOT NULL
GROUP BY s.id, s.finalizada_at, rd.nombre_dia
ORDER BY s.finalizada_at DESC;
```

### Progresión de peso por ejercicio

```sql
SELECT
  s.finalizada_at,
  e.nombre           AS ejercicio,
  MAX(ss.peso_kg)    AS peso_max,
  SUM(ss.repeticiones) AS reps_totales,
  COUNT(*)           AS series_completadas
FROM sesion_series ss
JOIN sesiones s       ON s.id  = ss.sesion_id
JOIN rutina_ejercicios re ON re.id = ss.rutina_ejercicio_id
JOIN ejercicios e     ON e.id  = re.ejercicio_id
WHERE s.user_id  = $userId
  AND ss.completada = true
GROUP BY s.finalizada_at, e.id, e.nombre
ORDER BY e.nombre, s.finalizada_at;
```

### Frecuencia de entrenamiento (sesiones por semana)

```sql
SELECT
  DATE_TRUNC('week', finalizada_at) AS semana,
  COUNT(*) AS sesiones
FROM sesiones
WHERE user_id = $userId
  AND finalizada_at IS NOT NULL
GROUP BY semana
ORDER BY semana DESC;
```

### Series completadas por sesión (el que usa `obtenerHistorialSesiones`)

```sql
SELECT sesion_id, COUNT(*) AS series_completadas
FROM sesion_series
WHERE sesion_id = ANY($sesionIds)
  AND completada = true
GROUP BY sesion_id;
```

### Resumen por grupo muscular en un período

```sql
SELECT
  e.grupo_muscular,
  COUNT(DISTINCT ss.sesion_id) AS sesiones,
  COUNT(*) AS series_completadas,
  SUM(ss.peso_kg * ss.repeticiones) AS volumen_total_kg
FROM sesion_series ss
JOIN sesiones s ON s.id = ss.sesion_id
JOIN rutina_ejercicios re ON re.id = ss.rutina_ejercicio_id
JOIN ejercicios e ON e.id = re.ejercicio_id
WHERE s.user_id = $userId
  AND s.finalizada_at >= NOW() - INTERVAL '30 days'
  AND ss.completada = true
GROUP BY e.grupo_muscular
ORDER BY volumen_total_kg DESC;
```

---

## Tipos TypeScript

Todos en `lib/types/database.ts`:

| Tipo | Uso |
|---|---|
| `Sesion` | Fila cruda de la tabla `sesiones` |
| `SesionSerie` | Fila cruda de `sesion_series` |
| `SesionSerieEditable` | Serie con `peso_kg`/`repeticiones` como `string` para inputs HTML |
| `EjercicioConSeries` | Ejercicio + sus series + pre-fill del último peso registrado |
| `SesionActiva` | Vista compuesta para la pantalla de sesión activa |
| `SesionResumen` | Para el listado del historial (id, dia_nombre, finalizada_at, series_completadas) |
| `SesionDetalle` | Para la vista read-only de una sesión finalizada |
| `SerieDetalle` | Serie con valores numéricos (read-only, para detalle) |
| `EjercicioDetalle` | Ejercicio con sus `SerieDetalle[]` |

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `lib/services/sesion-service.ts` | Todo el CRUD de sesiones |
| `lib/types/database.ts` | Todos los tipos (sección "Sesiones de Entrenamiento") |
| `app/entrenar/page.tsx` | Selección de día, detección de sesión activa en progreso |
| `app/entrenar/[sesionId]/page.tsx` | UI de sesión activa con auto-save |
| `app/components/sesion/SerieRow.tsx` | Componente de una fila de serie (input peso, reps, checkbox) |
| `app/entrenamiento/page.tsx` | Historial: lista de sesiones finalizadas con card + menú eliminar |
| `app/entrenamiento/[sesionId]/page.tsx` | Detalle read-only de una sesión |

---

## Consideraciones para métricas

- **Datos incompletos:** Un usuario puede finalizar una sesión sin marcar todas las series como completadas. Siempre filtrar por `ss.completada = true` y `ss.peso_kg IS NOT NULL` para cálculos de volumen.
- **Snapshot de rutina:** `rutina_ejercicio_id` apunta a la rutina en el momento de crear la sesión. Si el usuario cambió su rutina después, el ejercicio puede no existir más en la rutina activa. Hacer LEFT JOIN al consultar datos históricos.
- **Sesión activa:** Una sesión sin `finalizada_at` es una sesión en curso. Excluir con `WHERE finalizada_at IS NOT NULL` en cualquier query de historial/métricas.
