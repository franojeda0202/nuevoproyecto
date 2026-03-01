# Gym Theme — Black / Yellow / Charcoal Palette + Bebas Neue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar la paleta de GymLogic de "SaaS corporativo azul" a "plataforma fitness seria" usando negro/charcoal como color de poder, amarillo (#EAB308) como acento de energía, y Bebas Neue como fuente de títulos.

**Architecture:** Cambios puramente visuales en 7 tasks independientes. Sin dependencias nuevas salvo agregar Bebas Neue vía `next/font/google` (ya disponible en Next.js — cero instalación extra). El amarillo (#EAB308 = `yellow-500` de Tailwind) sobre fondo claro tiene contraste AA suficiente con texto negro. Los botones amarillos siempre usan `text-black` (no `text-white`). El chat usa `neutral-900` (negro) como color de poder — consistente y legible.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, `next/font/google` (Bebas Neue)

---

## Mapa de colores: azul → nueva paleta

| Token anterior | Token nuevo | Uso |
|---|---|---|
| `bg-blue-600` (botones primarios) | `bg-yellow-500 text-black` | CTAs: Generar rutina, Guardar, Nueva Rutina, Submit |
| `hover:bg-blue-700` (botones primarios) | `hover:bg-yellow-400` | Hover en CTAs |
| `active:bg-blue-800` | `active:bg-yellow-600` | Active en CTAs |
| `bg-blue-600` (chat FAB/avatar/mensajes/send) | `bg-neutral-900` | Chat: más legible en burbujas largas |
| `hover:bg-blue-700` (chat hover) | `hover:bg-neutral-800` | Chat hover |
| `text-blue-600` | `text-yellow-500` | Accents, links |
| `text-blue-700` / `text-blue-800` | `text-yellow-600` / `text-yellow-700` | Accents dark |
| `text-blue-400` / `text-blue-500` | `text-yellow-500` | Icons, spinners |
| `bg-blue-50` / `bg-blue-100` | `bg-yellow-50` / `bg-yellow-100` | Fondos suaves |
| `border-blue-*` | `border-yellow-*` | Borders accent |
| `hover:bg-blue-50` | `hover:bg-yellow-50` | Hover fondos |
| `hover:text-blue-*` / `hover:border-blue-*` | `hover:text-yellow-*` / `hover:border-yellow-*` | Hover accents |
| `focus:ring-blue-500 focus:border-blue-500` | `focus:ring-yellow-400 focus:border-yellow-400` | Focus en inputs |
| `shadow-blue-900/25` | `shadow-neutral-900/10` | Sombras botones |
| `from-blue-600 to-blue-400/500` | `from-yellow-500 to-amber-400` | Gradientes decorativos |
| `border-t-blue-500` (spinner) | `border-t-yellow-400` | Loading spinner |

---

### Task 1: Bebas Neue — font setup + aplicar a headings

**Contexto:** Bebas Neue es la fuente condensed-bold más usada en fitness branding (Nike, Adidas, Gymshark). Solo tiene weight 400. Se instala vía `next/font/google` en el layout — cero dependencias extra. Se aplica como CSS variable `--font-bebas-neue` y se expone como clase Tailwind `font-display`.

Se aplica a:
- `h1` en `LoginForm.tsx` y `OnboardingForm.tsx` (el "GymLogic" del header)
- `h1` en `rutinas/page.tsx` ("Mi Rutina Activa")
- `h2` en `rutinas/page.tsx` (nombre de la rutina)

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/components/LoginForm.tsx`
- Modify: `app/components/OnboardingForm.tsx`
- Modify: `app/rutinas/page.tsx`

**Step 1: Leer los 5 archivos**

Leer todos antes de editar para entender el contexto de cada cambio.

**Step 2: Agregar Bebas Neue en layout.tsx**

Contenido actual relevante:
```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Cambiar a:
```tsx
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});
```

Y en el body className, agregar `bebasNeue.variable`:
```tsx
className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
```

**Step 3: Agregar font-display al @theme en globals.css**

El bloque `@theme inline` actual tiene:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-accent: var(--accent);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

Cambiar a:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-accent: var(--accent);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-bebas-neue);
}
```

**Step 4: Aplicar font-display al h1 en LoginForm.tsx**

Buscar:
```tsx
<h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
  GymLogic
</h1>
```

Cambiar a:
```tsx
<h1 className="text-6xl md:text-7xl font-display text-slate-900 tracking-widest uppercase leading-none">
  GymLogic
</h1>
```

Nota: Con Bebas Neue, `font-black` no es necesario (solo existe weight 400 pero ya es visualmente muy bold). `text-6xl md:text-7xl` compensa que la fuente condensada se ve bien más grande. `tracking-widest` y `uppercase` dan el look fitness clásico.

**Step 5: Aplicar font-display al h1 en OnboardingForm.tsx**

Misma búsqueda y mismo cambio que Step 4 (el bloque es idéntico).

**Step 6: Aplicar font-display en rutinas/page.tsx**

Hay 2 headings:

**H1** (header de la página):
```tsx
<h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-1">
  Mi Rutina Activa
</h1>
```
Cambiar a:
```tsx
<h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
  Mi Rutina Activa
</h1>
```

**H2** (nombre de la rutina):
```tsx
<h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 tracking-tight">
  {rutinaData.rutina.nombre || 'Mi Rutina'}
</h2>
```
Cambiar a:
```tsx
<h2 className="text-3xl md:text-4xl font-display text-slate-900 tracking-wider uppercase leading-none mb-1">
  {rutinaData.rutina.nombre || 'Mi Rutina'}
</h2>
```

**Step 7: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```
Expected: Build exitoso. Si hay error de TypeScript con `Bebas_Neue`, verificar que el nombre exacto en `next/font/google` sea `Bebas_Neue` (con guion bajo).

**Step 8: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/layout.tsx app/globals.css app/components/LoginForm.tsx app/components/OnboardingForm.tsx app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: agregar Bebas Neue y aplicar a headings principales"
```

---

### Task 2: CSS variables — actualizar tokens de color en globals.css

**Contexto:** Los tokens `--accent` y `--accent-light` en `:root` actualmente apuntan a azul. Actualizarlos a amarillo centraliza el cambio de paleta.

**Files:**
- Modify: `app/globals.css`

**Step 1: Leer globals.css**

Ver las variables actuales en `:root`.

**Step 2: Actualizar los tokens**

El bloque actual:
```css
:root {
  --background: #f1f5f9;
  --foreground: #0f172a;
  --accent: #2563eb;
  --accent-light: #3b82f6;
  --card-border: #e2e8f0;
}
```

Cambiar a:
```css
:root {
  --background: #f1f5f9;
  --foreground: #0f172a;
  --accent: #eab308;
  --accent-light: #fbbf24;
  --accent-dark: #171717;
  --card-border: #e2e8f0;
}
```

Donde:
- `#eab308` = Tailwind `yellow-500`
- `#fbbf24` = Tailwind `amber-400`
- `#171717` = Tailwind `neutral-900` (para elementos de poder: chat FAB, botones secundarios dark)

**Step 3: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/globals.css
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: actualizar tokens de color a paleta gym (amarillo/negro)"
```

---

### Task 3: LoginForm.tsx — reemplazar blue por nueva paleta

**Contexto:** LoginForm tiene 4 tipos de elementos con azul: el SVG del icono de mancuerna, las tabs activas, los inputs con focus ring azul, y el submit button.

**Files:**
- Modify: `app/components/LoginForm.tsx`

**Step 1: Leer LoginForm.tsx completo**

**Step 2: Icono SVG de mancuerna — azul → amarillo**

```tsx
// Antes
<svg className="w-10 h-10 text-blue-600" ...>
// Después
<svg className="w-10 h-10 text-yellow-500" ...>
```

**Step 3: Tabs activas — azul → amarillo con texto negro**

Buscar (ocurre 2 veces con `replace_all: true`):
```tsx
'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-900/20'
```
Cambiar a:
```tsx
'bg-yellow-500 text-black hover:bg-yellow-400 shadow-md'
```

**Step 4: Submit button — azul → amarillo con texto negro**

Buscar:
```tsx
className="w-full py-4 h-12 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/25"
```
Cambiar a:
```tsx
className="w-full py-4 h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10"
```

**Step 5: Focus ring del input password — azul → amarillo**

Buscar en el input de password:
```tsx
focus:ring-[#0066FF]
```
o
```tsx
focus:ring-blue-500 focus:border-blue-500
```
Cambiar a:
```tsx
focus:ring-yellow-400 focus:border-yellow-400
```

(Si el input de password usa `focus:ring-[#0066FF]` en vez de Tailwind estándar, cambiar a `focus:ring-yellow-400 focus:border-yellow-400`)

**Step 6: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/LoginForm.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: LoginForm — paleta gym (amarillo+negro)"
```

---

### Task 4: OnboardingForm.tsx — reemplazar blue por nueva paleta

**Contexto:** OnboardingForm tiene: SVG de mancuerna, barra de acento superior del form, focus rings en selects, radio button de ubicación (estado seleccionado), badge del resumen de días, y el CTA button.

**Files:**
- Modify: `app/components/OnboardingForm.tsx`

**Step 1: Leer OnboardingForm.tsx completo**

**Step 2: SVG mancuerna — azul → amarillo**

```tsx
// Antes
<svg className="w-10 h-10 text-blue-600" ...>
// Después
<svg className="w-10 h-10 text-yellow-500" ...>
```

**Step 3: Barra de acento superior del form**

```tsx
// Antes
<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-blue-500" />
// Después
<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />
```

**Step 4: Focus rings en selects — azul → amarillo (3 ocurrencias + textarea)**

Buscar (usar `replace_all: true`):
```
focus:ring-blue-500 focus:border-blue-500
```
Cambiar a:
```
focus:ring-yellow-400 focus:border-yellow-400
```
Esto afecta los 3 selects (días, género, foco muscular) en un solo paso.

**Step 5: Radio button "Gimnasio" — estado seleccionado**

Buscar:
```tsx
? 'border-blue-600 bg-blue-50 text-slate-900'
```
Cambiar a:
```tsx
? 'border-yellow-500 bg-yellow-50 text-slate-900'
```

Y el indicador dot:
```tsx
// Antes
<div className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full" />
// Después
<div className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full" />
```

**Step 6: Badge "días/semana" en resumen de configuración**

```tsx
// Antes
<span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700">
// Después
<span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
```

**Step 7: CTA button — azul → amarillo con texto negro**

Buscar:
```tsx
className="w-full py-4 h-12 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25 flex items-center justify-center gap-2"
```
Cambiar a:
```tsx
className="w-full py-4 h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10 flex items-center justify-center gap-2"
```

**Step 8: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/OnboardingForm.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: OnboardingForm — paleta gym (amarillo+negro)"
```

---

### Task 5: ChatBubble.tsx — reemplazar blue por paleta gym

**Contexto:** El chat tiene dos tipos de elementos azules:
1. **Funcionales de chat** (FAB, avatar, mensajes usuario, send button): pasar a `neutral-900` — negro profesional, más legible en texto largo que amarillo
2. **Chips de sugerencia y elemento decorativo** (empty state icon, chip hover): pasar a amarillo

**Files:**
- Modify: `app/components/ChatBubble.tsx`

**Step 1: Leer ChatBubble.tsx completo**

**Step 2: FAB button — azul → neutral-900 (negro)**

Buscar:
```tsx
className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-900/30 hover:bg-blue-700 transition-all z-50 flex items-center justify-center hover:scale-110 active:scale-95"
```
Cambiar a:
```tsx
className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-neutral-900 text-white rounded-full shadow-2xl shadow-neutral-900/30 hover:bg-neutral-800 transition-all z-50 flex items-center justify-center hover:scale-110 active:scale-95"
```

**Step 3: Header avatar — azul → neutral-900**

```tsx
// Antes
<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
// Después
<div className="w-8 h-8 bg-neutral-900 rounded-full flex items-center justify-center">
```

**Step 4: Empty state icon container — azul → amarillo**

```tsx
// Antes
<div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
  <svg className="w-7 h-7 text-blue-500" ...>
// Después
<div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
  <svg className="w-7 h-7 text-yellow-500" ...>
```

**Step 5: Chips de sugerencia hover — azul → amarillo**

Buscar:
```tsx
className="w-full text-left px-3 py-2.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150"
```
Cambiar a:
```tsx
className="w-full text-left px-3 py-2.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700 transition-all duration-150"
```

**Step 6: Mensajes del usuario — azul → neutral-900**

Buscar:
```tsx
? 'bg-blue-600 text-white'
```
Cambiar a:
```tsx
? 'bg-neutral-900 text-white'
```

**Step 7: Focus ring del input — azul → amarillo**

Buscar en el input:
```tsx
focus:ring-2 focus:ring-blue-500 focus:border-blue-500
```
Cambiar a:
```tsx
focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400
```

**Step 8: Send button — azul → neutral-900 (negro)**

Buscar:
```tsx
className="px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
```
Cambiar a:
```tsx
className="px-4 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
```

**Step 9: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/ChatBubble.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: ChatBubble — negro para elementos de chat, amarillo para accents"
```

---

### Task 6: rutinas/page.tsx — reemplazar blue por paleta gym

**Contexto:** La página de rutinas tiene: barra de acento del header, botones de acción (Nueva Rutina, CTAs del empty state, Confirmar en modales), barras decorativas verticales, el dot del nombre del día, y el botón de "Agregar ejercicio".

**Files:**
- Modify: `app/rutinas/page.tsx`

**Step 1: Leer rutinas/page.tsx completo**

**Step 2: Header — accent bar bajo el título**

```tsx
// Antes
<div className="h-0.5 w-12 bg-blue-600 rounded-full mb-2" />
// Después
<div className="h-0.5 w-12 bg-yellow-500 rounded-full mb-2" />
```

**Step 3: "Nueva Rutina" button — azul → amarillo negro**

```tsx
// Antes
className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25"
// Después
className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
```

**Step 4: Empty state — barra lateral, icono y CTA**

Barra lateral izquierda del card:
```tsx
// Antes
<div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-600 to-blue-400" />
// Después
<div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-yellow-500 to-amber-400" />
```

Icono container:
```tsx
// Antes
<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
  <svg className="w-10 h-10 text-blue-400" ...>
// Después
<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-yellow-50 flex items-center justify-center">
  <svg className="w-10 h-10 text-yellow-500" ...>
```

CTA button del empty state:
```tsx
// Antes
className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25 flex items-center gap-2"
// Después
className="px-8 py-4 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10 flex items-center gap-2"
```

**Step 5: Routine card — barra lateral y day accent**

Barra lateral del card de rutina (igual al empty state):
```tsx
// Antes
<div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-600 to-blue-400" />
// Después
<div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-yellow-500 to-amber-400" />
```

Dot accent junto al nombre del día:
```tsx
// Antes
<span className="w-1.5 h-6 bg-blue-600 rounded-full" />
// Después
<span className="w-1.5 h-6 bg-yellow-500 rounded-full" />
```

**Step 6: "Agregar ejercicio" dashed button hover**

```tsx
// Antes
className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50/80 border border-dashed border-slate-200 hover:border-blue-300 rounded-xl transition-all duration-200"
// Después
className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-500 hover:text-yellow-600 hover:bg-yellow-50/80 border border-dashed border-slate-200 hover:border-yellow-300 rounded-xl transition-all duration-200"
```

**Step 7: Modal "Nueva Rutina" — confirm button**

```tsx
// Antes
className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25"
// Después
className="flex-1 px-4 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
```

**Step 8: Verificar build y commit**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: rutinas/page — paleta gym (amarillo+negro)"
```

---

### Task 7: EjercicioModal + EjercicioRow + Skeleton — reemplazar blue

**Contexto:** Los últimos 3 archivos con azul restante. EjercicioModal tiene la mayor cantidad de cambios (barra de acento, badges, focus rings en 4 inputs, spinner, lista de ejercicios, save button). EjercicioRow tiene hover states del botón de editar. Skeleton tiene el paso activo de GenerandoRutinaSkeleton.

**Files:**
- Modify: `app/components/rutina/EjercicioModal.tsx`
- Modify: `app/components/rutina/EjercicioRow.tsx`
- Modify: `app/components/Skeleton.tsx`

**Step 1: Leer los 3 archivos**

**Step 2: EjercicioModal — barra de acento superior**

```tsx
// Antes
<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-blue-500" />
// Después
<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />
```

**Step 3: EjercicioModal — badge de segmento del ejercicio**

```tsx
// Antes
<span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
// Después
<span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
```

**Step 4: EjercicioModal — botón "Cambiar" ejercicio**

```tsx
// Antes
className="text-sm text-blue-600 hover:text-blue-800 font-medium"
// Después
className="text-sm text-yellow-600 hover:text-yellow-800 font-medium"
```

**Step 5: EjercicioModal — focus rings en todos los inputs (4 ocurrencias)**

Buscar (usar `replace_all: true`):
```
focus:ring-2 focus:ring-blue-500 focus:border-blue-500
```
Cambiar a:
```
focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400
```
Esto afecta: búsqueda, series, repeticiones y notas (textarea).

**Step 6: EjercicioModal — spinner de carga de ejercicios**

```tsx
// Antes
<div className="animate-spin h-6 w-6 border-2 border-slate-200 border-t-blue-500 rounded-full mx-auto mb-2" />
// Después
<div className="animate-spin h-6 w-6 border-2 border-slate-200 border-t-yellow-400 rounded-full mx-auto mb-2" />
```

**Step 7: EjercicioModal — hover y selected en lista de ejercicios**

Buscar (usar `replace_all: true`):
```tsx
ej.id === ejercicioId ? 'bg-blue-50' : ''
```
Cambiar a:
```tsx
ej.id === ejercicioId ? 'bg-yellow-50' : ''
```

Y el hover de cada item:
```tsx
// Antes
className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
// Después
className={`w-full px-4 py-3 text-left hover:bg-yellow-50 transition-colors ${
```

**Step 8: EjercicioModal — Save button**

```tsx
// Antes
className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/25"
// Después
className="flex-1 px-4 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10"
```

**Step 9: EjercicioRow — hover del botón Editar (2 ocurrencias: desktop + mobile)**

Buscar (usar `replace_all: true`):
```tsx
hover:text-blue-600 hover:bg-blue-50
```
Cambiar a:
```tsx
hover:text-yellow-600 hover:bg-yellow-50
```

**Step 10: EjercicioRow — icono info de notas (EjercicioRowMobile)**

```tsx
// Antes
<svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" ...>
// Después
<svg className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" ...>
```

**Step 11: Skeleton — paso activo en GenerandoRutinaSkeleton**

Buscar:
```tsx
isCurrent ? 'bg-blue-600 text-white' :
```
Cambiar a:
```tsx
isCurrent ? 'bg-yellow-500 text-black' :
```

**Step 12: Verificar build final — cero ocurrencias de blue**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

```bash
grep -r "blue-" /Users/franciscoojeda/Documents/proyects/nuevoproyecto/app --include="*.tsx" | grep -v ".next"
```
Expected: Sin resultados (cero ocurrencias de `blue-` en archivos TSX del app).

**Step 13: Commit final**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/rutina/EjercicioModal.tsx app/components/rutina/EjercicioRow.tsx app/components/Skeleton.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "ui: EjercicioModal, EjercicioRow, Skeleton — paleta gym completa"
```

---

## Checklist final

- [ ] Task 1 ✅ Bebas Neue instalada y aplicada a h1/h2 principales
- [ ] Task 2 ✅ CSS variables actualizadas a amarillo/negro
- [ ] Task 3 ✅ LoginForm sin azul — tabs y submit en amarillo
- [ ] Task 4 ✅ OnboardingForm sin azul — selects, radio, badge, CTA en amarillo
- [ ] Task 5 ✅ ChatBubble — FAB/avatar/mensajes/send en negro, chips/icon en amarillo
- [ ] Task 6 ✅ rutinas/page sin azul — barras, dots, botones en amarillo
- [ ] Task 7 ✅ EjercicioModal/Row/Skeleton sin azul
- [ ] `grep -r "blue-" app --include="*.tsx"` retorna vacío
- [ ] `npm run build` pasa sin errores
