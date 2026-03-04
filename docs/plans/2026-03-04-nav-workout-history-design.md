# Navegación Global + Historial de Entrenamiento — Design

**Date:** 2026-03-04

## Goal

Agregar navegación global mediante un drawer lateral (hamburger) y una nueva sección de historial de entrenamientos con vista de detalle por sesión.

## Scope

**In:** AppLayout con drawer, páginas `/entrenamiento` e `/entrenamiento/[sesionId]`, "Cerrar Sesión" al drawer.

**Out:** métricas, gráficos de progreso, filtros de historial (futuro).

## Navegación — AppLayout + Drawer

### Componente AppLayout

Nuevo componente `app/components/AppLayout.tsx` que envuelve todas las páginas autenticadas: `/rutinas`, `/entrenar`, `/entrenamiento`.

Responsabilidades:
- Botón ☰ fijo arriba a la izquierda (sobre el contenido)
- Drawer lateral con estado `isOpen` (useState)
- Backdrop oscuro cuando el drawer está abierto (click cierra)
- Renderiza `children` debajo

### Drawer

- Fondo: `bg-neutral-900`
- Texto: `text-yellow-500` para links activos, `text-white` para resto
- Desliza desde la izquierda (`translate-x`) con transición `transition-transform`
- Link activo marcado visualmente (link de la ruta actual en amarillo)
- "Cerrar Sesión" al fondo (se migra desde los headers individuales)

Contenido:
```
GYMLOGIC
────────
Mi Rutina        → /rutinas
Entrenamiento    → /entrenamiento

[user email]
Cerrar Sesión
```

### Cambios en páginas existentes

- `/rutinas/page.tsx`: eliminar botón "Cerrar Sesión" del header
- `/entrenar/page.tsx`: eliminar botón "← Volver a Mi Rutina" (el drawer lo reemplaza)
- `/entrenar/[sesionId]/page.tsx`: el botón "Cambiar día" se mantiene (es navegación contextual)
- Todas las páginas autenticadas se envuelven en `<AppLayout>`

## Entrenamiento — Historial

### Página `/entrenamiento` — Lista

Query: `sesiones` WHERE `finalizada_at IS NOT NULL`, ORDER BY `finalizada_at DESC`, scoped al usuario via RLS.

Cada card muestra:
- Nombre del día (`rutina_dias.nombre_dia`)
- Fecha formateada (`finalizada_at`)
- Cantidad de series completadas (`sesion_series WHERE completada = true`)

Al hacer tap → navega a `/entrenamiento/[sesionId]`.

Estado vacío: mensaje + CTA "Ir a Entrenar" → `/entrenar`.

### Página `/entrenamiento/[sesionId]` — Detalle

Vista read-only de la sesión. Para cada ejercicio del día, muestra sus series con:
- Número de serie
- Peso (kg) — o `—` si no se registró
- Repeticiones — o `—` si no se registró
- Ícono ✓ amarillo si `completada = true`, gris si false

Sin inputs ni botones de edición.

## Arquitectura

**Nuevos archivos:**
- `app/components/AppLayout.tsx` — layout con drawer, recibe `children` y `user` (email + logout)
- `app/entrenamiento/page.tsx` — lista de sesiones finalizadas
- `app/entrenamiento/[sesionId]/page.tsx` — detalle read-only de sesión

**Nuevas funciones en `lib/services/sesion-service.ts`:**
- `obtenerHistorialSesiones(supabase, userId)` — lista de sesiones finalizadas con conteo de series
- `obtenerDetalleSesion(supabase, sesionId)` — ejercicios + series de una sesión finalizada

**Modificaciones:**
- `app/rutinas/page.tsx` — envolver en `AppLayout`, quitar botón Cerrar Sesión
- `app/entrenar/page.tsx` — envolver en `AppLayout`, quitar botón Volver
- `app/entrenar/[sesionId]/page.tsx` — envolver en `AppLayout`

## Decisiones de diseño

- **AppLayout no va en `layout.tsx`** — se usa solo en páginas autenticadas para no contaminar el login
- **Drawer con `translate-x`** — animación CSS pura, sin librerías extra
- **Read-only para el detalle** — no se puede editar una sesión pasada (YAGNI)
- **`obtenerHistorialSesiones` incluye el conteo de series completadas en una sola query** — evita N+1
