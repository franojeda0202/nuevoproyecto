# UI Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevar GymLogic de "prototipo funcional" a "producto profesional" corrigiendo inconsistencias de color, reemplazando emojis por iconos SVG, añadiendo una identidad visual clara y puliendo microinteracciones.

**Architecture:** Cambios puramente visuales. Sin dependencias nuevas. Sin cambios al backend ni a la lógica de negocio. Todos los cambios son quirúrgicos sobre componentes existentes.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, React 19

---

## Análisis del estado actual

| Problema | Archivo | Impacto |
|----------|---------|---------|
| Chat usa `bg-black` — rompe la paleta azul del resto de la app | `ChatBubble.tsx` | Alto |
| Login tabs y submit button usan `bg-slate-900` en vez de azul | `LoginForm.tsx` | Alto |
| Sin icono de marca — "GymLogic" es solo texto plano | `LoginForm.tsx`, `OnboardingForm.tsx` | Alto |
| Emojis en UI funcional: 📋🚀✏️🗑️💡 | `rutinas/page.tsx`, `EjercicioRow.tsx` | Medio |
| Chat empty state genérico, sin prompts sugeridos | `ChatBubble.tsx` | Medio |
| Modales aparecen sin animación de entrada | `rutinas/page.tsx` | Bajo |

---

### Task 1: Unificar paleta de colores — Chat negro → azul

**Contexto:** El `ChatBubble` usa `bg-black`/`bg-gray-800` para el botón FAB, el avatar del header, los mensajes del usuario y el botón de envío. El resto de la app usa `bg-blue-600`/`hover:bg-blue-700`. Esta inconsistencia hace que el chat parezca un componente de otra app.

**Files:**
- Modify: `app/components/ChatBubble.tsx`

**Step 1: Leer el archivo**

Leer `app/components/ChatBubble.tsx` y ubicar las siguientes ocurrencias de `bg-black` y `bg-gray-800`.

**Step 2: Cambiar el botón FAB (burbuja flotante)**

Línea ~158, el botón tiene:
```tsx
className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-black text-white rounded-full shadow-2xl hover:bg-gray-800 transition-all z-50 flex items-center justify-center hover:scale-110 active:scale-95"
```

Cambiar `bg-black hover:bg-gray-800` por `bg-blue-600 hover:bg-blue-700`:
```tsx
className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-900/30 hover:bg-blue-700 transition-all z-50 flex items-center justify-center hover:scale-110 active:scale-95"
```

**Step 3: Cambiar el avatar del header del chat**

Línea ~173:
```tsx
<div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
```

Cambiar a:
```tsx
<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
```

**Step 4: Cambiar los mensajes del usuario**

Línea ~214-217, los mensajes con `role === 'user'` tienen:
```tsx
? 'bg-black text-white'
```

Cambiar a:
```tsx
? 'bg-blue-600 text-white'
```

**Step 5: Cambiar el botón de envío**

Línea ~279:
```tsx
className="px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
```

Cambiar a:
```tsx
className="px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
```

**Step 6: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso sin errores TypeScript.

**Step 7: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/ChatBubble.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: unificar chat con paleta azul del app"
```

---

### Task 2: Consistencia visual en LoginForm — slate → azul

**Contexto:** En `LoginForm.tsx`, el tab activo y el botón de submit usan `bg-slate-900`/`hover:bg-slate-800`. Toda la app usa blue como color primario de acción. Resultado: la pantalla de login tiene una paleta diferente al onboarding y al dashboard.

**Files:**
- Modify: `app/components/LoginForm.tsx`

**Step 1: Leer el archivo**

Leer `app/components/LoginForm.tsx` y ubicar los botones de tab (líneas ~240 y ~256) y el submit button (línea ~322).

**Step 2: Cambiar tab activo**

Ambos tabs (Iniciar Sesión y Registrarse) comparten el mismo patrón condicional. Cuando `mode === 'login'` o `mode === 'signup'`, la clase activa es:
```tsx
'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
```

Cambiar a:
```tsx
'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-900/20'
```

(Hacer el cambio en ambos botones — buscar `bg-slate-900 text-white hover:bg-slate-800 shadow-md` con `replace_all: true`)

**Step 3: Cambiar el botón de submit**

Línea ~322:
```tsx
className="w-full py-4 h-12 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all duration-200 active:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
```

Cambiar a:
```tsx
className="w-full py-4 h-12 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/25"
```

**Step 4: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/LoginForm.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: alinear LoginForm con paleta azul (tabs y submit button)"
```

---

### Task 3: Agregar icono de marca en los headers de GymLogic

**Contexto:** Los headers de `LoginForm` y `OnboardingForm` muestran el nombre "GymLogic" como texto puro. Agregar un icono SVG de mancuerna (dumbbell) al lado del nombre lo hace inmediatamente reconocible como un producto fitness real, no un prototipo.

**Files:**
- Modify: `app/components/LoginForm.tsx:214-222`
- Modify: `app/components/OnboardingForm.tsx:123-129`

**Step 1: Leer ambos headers**

Leer `app/components/LoginForm.tsx` líneas 214-222 y `app/components/OnboardingForm.tsx` líneas 123-129.

En `LoginForm.tsx`, el header actual es:
```tsx
<div className="text-center mb-10">
  <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
    GymLogic
  </h1>
  <div className="h-1 w-16 bg-blue-600 mx-auto mt-3 rounded-full" />
  <p className="text-slate-600 text-lg font-medium mt-3 text-slate-600">
    Tu coach digital personal
  </p>
</div>
```

En `OnboardingForm.tsx`, el header actual es:
```tsx
<div className="text-center mb-10">
  <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
    GymLogic
  </h1>
  <div className="h-1 w-16 bg-blue-600 mx-auto mt-3 rounded-full" />
  <p className="text-slate-600 text-lg font-medium mt-3">
    Tu coach digital personal
  </p>
</div>
```

**Step 2: Reemplazar header en LoginForm.tsx**

Cambiar el bloque anterior por:
```tsx
<div className="text-center mb-10">
  <div className="flex items-center justify-center gap-3 mb-1">
    <svg className="w-10 h-10 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
    </svg>
    <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
      GymLogic
    </h1>
  </div>
  <p className="text-slate-500 text-base font-medium mt-3">
    Tu coach digital personal
  </p>
</div>
```

**Step 3: Reemplazar header en OnboardingForm.tsx**

Usar el mismo bloque que en LoginForm. El header de OnboardingForm tiene un espacio en `mt-3` antes del `<p>` — usar el mismo resultado que en Step 2.

**Step 4: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/LoginForm.tsx app/components/OnboardingForm.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: agregar icono de mancuerna al header de GymLogic"
```

---

### Task 4: Reemplazar emojis por iconos SVG en la UI funcional

**Contexto:** Hay emojis en 3 lugares funcionales: el empty state de rutinas (📋), el CTA button (🚀), el hint de acciones (✏️🗑️) y las notas del ejercicio en móvil (💡). Los emojis se renderizan diferente en cada sistema operativo y se ven inconsistentes con el estilo visual del resto de la app.

**Files:**
- Modify: `app/rutinas/page.tsx:363-375` (empty state icon + CTA)
- Modify: `app/rutinas/page.tsx:387` (action hint)
- Modify: `app/components/rutina/EjercicioRow.tsx:115` (notas notes hint)

**Step 1: Leer los archivos afectados**

Leer `app/rutinas/page.tsx` líneas 360-395 y `app/components/rutina/EjercicioRow.tsx` líneas 110-120.

**Step 2: Reemplazar ícono 📋 en empty state**

El bloque actual (~línea 363):
```tsx
<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center text-4xl">
  📋
</div>
```

Cambiar a:
```tsx
<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
  <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
</div>
```

**Step 3: Reemplazar emoji 🚀 en el CTA button**

El botón actual (~línea 372):
```tsx
<button
  onClick={handleGenerateNew}
  className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25"
>
  Generar mi primera rutina 🚀
</button>
```

Cambiar a:
```tsx
<button
  onClick={handleGenerateNew}
  className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25 flex items-center gap-2"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
  Generar mi primera rutina
</button>
```

**Step 4: Reemplazar el hint de acciones con emojis**

El texto actual (~línea 387):
```tsx
<p className="text-sm text-slate-500">
  Haz clic en ✏️ para editar o 🗑️ para eliminar ejercicios
</p>
```

Cambiar a:
```tsx
<p className="text-sm text-slate-400 flex items-center gap-1.5 flex-wrap">
  Clic en
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
    editar
  </span>
  o
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
    eliminar
  </span>
  ejercicios
</p>
```

**Step 5: Quitar emoji 💡 en notas de EjercicioRowMobile**

En `app/components/rutina/EjercicioRow.tsx`, el bloque actual (~línea 113):
```tsx
<p className="mt-2 text-sm text-gray-600 bg-slate-50 rounded-lg px-3 py-2">
  💡 {ejercicio.notas_coach}
</p>
```

Cambiar a:
```tsx
<p className="mt-2 text-sm text-gray-600 bg-slate-50 rounded-lg px-3 py-2 flex items-start gap-1.5">
  <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  {ejercicio.notas_coach}
</p>
```

**Step 6: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx app/components/rutina/EjercicioRow.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: reemplazar emojis por iconos SVG en rutinas y ejercicios"
```

---

### Task 5: Mejorar chat empty state con prompts sugeridos

**Contexto:** Cuando el chat está vacío, el usuario ve un ícono gris genérico y texto "Pregúntame sobre entrenamiento o nutrición". No hay indicación de qué preguntar. Agregar 3 chips de preguntas sugeridas reduce la fricción de empezar la conversación y hace el producto más útil desde el primer momento.

**Files:**
- Modify: `app/components/ChatBubble.tsx`

**Step 1: Leer el empty state actual**

Leer `app/components/ChatBubble.tsx` líneas 194-206 para ver el empty state completo.

El bloque actual es:
```tsx
{messages.length === 0 ? (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium">Hola, soy GymLogic AI</p>
      <p className="text-sm text-gray-400 mt-1">Pregúntame sobre entrenamiento o nutrición</p>
    </div>
  </div>
) : (
```

**Step 2: Reemplazar con nuevo empty state + prompts sugeridos**

Los prompts sugeridos deben auto-completar el input al hacer clic. Para eso necesitamos el `setInputValue` ya disponible en el componente.

Reemplazar el bloque `messages.length === 0` con:
```tsx
{messages.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-full px-2">
    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
      </svg>
    </div>
    <p className="text-slate-700 font-semibold text-base">Hola, soy GymLogic AI</p>
    <p className="text-sm text-slate-400 mt-1 mb-5 text-center">Tu entrenador personal disponible 24/7</p>
    <div className="w-full space-y-2">
      {[
        '¿Qué ejercicios son mejores para la espalda?',
        '¿Cuánto descanso debo dejar entre series?',
        '¿Cómo mejorar mi técnica de sentadilla?',
      ].map((sugerencia) => (
        <button
          key={sugerencia}
          onClick={() => setInputValue(sugerencia)}
          className="w-full text-left px-3 py-2.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150"
        >
          {sugerencia}
        </button>
      ))}
    </div>
  </div>
) : (
```

**Step 3: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/ChatBubble.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: mejorar chat empty state con prompts sugeridos"
```

---

### Task 6: Animaciones de entrada en modales

**Contexto:** Los 3 modales de `rutinas/page.tsx` (showConfirmModal, deleteConfirm) y el `EjercicioModal` aparecen y desaparecen instantáneamente. Agregar una animación corta de fade-in + ligero scale-up hace que el producto se sienta más refinado sin añadir latencia perceptible.

**Architecture:** Definir 2 keyframes en `globals.css` (`fadeIn` para el backdrop, `scaleIn` para el card) y referenciarlos con `animate-[...]` de Tailwind.

**Files:**
- Modify: `app/globals.css` (agregar keyframes)
- Modify: `app/rutinas/page.tsx:473-500` (showConfirmModal)
- Modify: `app/rutinas/page.tsx:504-550` (deleteConfirm)
- Modify: `app/components/rutina/EjercicioModal.tsx` (el modal de edición)

**Step 1: Agregar keyframes en globals.css**

Leer `app/globals.css` para ver el contenido actual, luego agregar al final:
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
```

**Step 2: Agregar animación al modal "Nueva Rutina"**

En `app/rutinas/page.tsx`, el backdrop del showConfirmModal (~línea 474) tiene:
```tsx
<div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-md w-full p-6 border border-slate-200">
```

Cambiar a:
```tsx
<div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out]">
  <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-md w-full p-6 border border-slate-200 animate-[scaleIn_0.15s_ease-out]">
```

**Step 3: Agregar animación al modal "Eliminar ejercicio"**

En `app/rutinas/page.tsx`, el backdrop del deleteConfirm (~línea 505) tiene:
```tsx
<div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-sm w-full p-6 border border-slate-200">
```

Cambiar a:
```tsx
<div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out]">
  <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-sm w-full p-6 border border-slate-200 animate-[scaleIn_0.15s_ease-out]">
```

**Step 4: Agregar animación al EjercicioModal**

Leer `app/components/rutina/EjercicioModal.tsx` para encontrar el elemento overlay/backdrop del modal (generalmente un `fixed inset-0`).

Aplicar la misma lógica: `animate-[fadeIn_0.15s_ease-out]` al backdrop y `animate-[scaleIn_0.15s_ease-out]` al card interior.

**Step 5: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/globals.css app/rutinas/page.tsx app/components/rutina/EjercicioModal.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: agregar animaciones fade+scale a los modales"
```

---

## Checklist final

- [ ] Task 1 ✅ Chat usa azul — paleta unificada en toda la app
- [ ] Task 2 ✅ LoginForm usa azul — tabs y submit alineados con el resto
- [ ] Task 3 ✅ Icono de mancuerna en headers — identidad visual clara
- [ ] Task 4 ✅ Emojis reemplazados por SVG — UI profesional y consistente entre OS
- [ ] Task 5 ✅ Chat empty state con prompts sugeridos — UX mejorada
- [ ] Task 6 ✅ Modales con animaciones — producto se siente refinado
- [ ] `npm run build` pasa sin errores

## Cambios que NO se incluyeron (y por qué)

| Idea | Razón para no incluir |
|------|----------------------|
| Cambiar la fuente a Inter | Ya usa Geist que es excelente. Cambio sin impacto real. |
| Agregar dark mode | Fuera de scope, requiere refactor de todos los componentes. |
| Rediseñar los selects nativos con custom dropdown | Complejidad alta, los nativos son más accesibles y funcionan bien. |
| Mostrar "Hola, {nombre}" en header | Solo tenemos email, mostrarlo sería igual de informal. |
| Animaciones en page transitions | Requeriría view transitions API o Framer Motion — nueva dep. |
