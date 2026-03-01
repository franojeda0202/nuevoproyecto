# Premium Teasers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar dos botones "Exportar CSV" y "Exportar PDF" en la rutina activa que abren un popup de "Función Premium — próxima versión", con tracking de clicks via analytics.

**Architecture:** Un componente `PremiumModal` compartido (reutilizable para futuros teasers). Los botones viven en el header del card de rutina activa en `app/rutinas/page.tsx`. El tracking usa `trackEvent` de `lib/analytics.ts` (fire-and-forget, ya implementado). El modal reutiliza las clases de animación ya existentes en `globals.css` (`fadeIn`, `scaleIn`).

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, `lib/analytics.ts` (cliente Supabase fire-and-forget)

---

### Task 1: Crear componente PremiumModal

**Files:**
- Create: `app/components/PremiumModal.tsx`

**Step 1: Leer globals.css para confirmar que las keyframes fadeIn/scaleIn existen**

```bash
grep -n "fadeIn\|scaleIn" /Users/franciscoojeda/Documents/proyects/nuevoproyecto/app/globals.css
```
Expected: Líneas con `@keyframes fadeIn` y `@keyframes scaleIn`. Estas animaciones fueron creadas en una sesión anterior.

**Step 2: Crear el componente**

```tsx
'use client'

import { useEffect } from 'react'

interface PremiumModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out_both]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden animate-[scaleIn_0.15s_ease-out_both]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de acento */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />

        <div className="p-8 text-center">
          {/* Ícono de candado */}
          <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Función Premium</h3>
          <p className="text-slate-500 text-sm mb-6">
            Esta función estará disponible en la próxima versión de GymLogic.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso, sin errores de TypeScript.

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/PremiumModal.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "feat: agregar componente PremiumModal"
```

---

### Task 2: Agregar botones de export en rutinas/page.tsx

**Files:**
- Modify: `app/rutinas/page.tsx`

**Step 1: Leer app/rutinas/page.tsx completo**

Prestar atención a:
- Los imports al inicio del archivo
- El bloque de estado (`useState`) dentro del componente
- El header del card de rutina activa (buscar `md:justify-between` dentro del card, alrededor de la línea 386)

**Step 2: Agregar import de PremiumModal y trackEvent**

Al inicio del archivo, agregar en los imports existentes:

```tsx
import PremiumModal from '@/app/components/PremiumModal'
import { trackEvent } from '@/lib/analytics'
```

Nota: `trackEvent` puede que ya esté importado. Verificar antes de agregarlo.

**Step 3: Agregar estado para el modal**

Dentro del componente (donde están los otros `useState`), agregar:

```tsx
const [premiumModalOpen, setPremiumModalOpen] = useState(false)
```

**Step 4: Agregar los botones de export en el header del card de rutina**

Buscar el bloque que contiene el `h2` con el nombre de la rutina (alrededor de línea 386-409). La estructura actual es:

```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <h2 className="text-3xl md:text-4xl font-display ...">
      {rutinaData.rutina.nombre || 'Mi Rutina'}
    </h2>
    <p className="text-sm text-slate-400 ...">
      Clic en ...
    </p>
  </div>
</div>
```

Cambiar a (agregar el `<div>` con los botones como segundo hijo del flex):

```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <h2 className="text-3xl md:text-4xl font-display text-slate-900 tracking-wider uppercase leading-none mb-1">
      {rutinaData.rutina.nombre || 'Mi Rutina'}
    </h2>
    <p className="text-sm text-slate-400 flex items-center gap-1.5 flex-wrap">
      Clic en
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        editar
      </span>
      o
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        eliminar
      </span>
      ejercicios
    </p>
  </div>

  {/* Botones de exportación (Premium) */}
  <div className="flex items-center gap-2 self-start md:self-center">
    <button
      onClick={() => {
        trackEvent('premium_feature_click', { feature: 'csv_export' })
        setPremiumModalOpen(true)
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:border-yellow-300 hover:text-yellow-600 hover:bg-yellow-50 transition-all duration-150"
      title="Exportar como CSV (próximamente)"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      CSV
    </button>
    <button
      onClick={() => {
        trackEvent('premium_feature_click', { feature: 'pdf_export' })
        setPremiumModalOpen(true)
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:border-yellow-300 hover:text-yellow-600 hover:bg-yellow-50 transition-all duration-150"
      title="Exportar como PDF (próximamente)"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      PDF
    </button>
  </div>
</div>
```

**Step 5: Agregar el componente PremiumModal al final del JSX**

Antes del cierre del componente (justo antes del último `</div>` o `</>`), agregar:

```tsx
<PremiumModal
  isOpen={premiumModalOpen}
  onClose={() => setPremiumModalOpen(false)}
/>
```

**Step 6: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso.

**Step 7: Self-review**

Verificar:
- Los botones CSV y PDF aparecen solo cuando hay `rutinaData` (están dentro del bloque `rutinaData ? (...)` — correctamente condicionales)
- El `PremiumModal` está importado y renderizado
- `trackEvent` se llama antes de abrir el modal (fire-and-forget, no bloquea)
- `premiumModalOpen` state existe y se usa correctamente

**Step 8: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "feat: agregar botones CSV/PDF premium con tracking y modal"
```

---

## Checklist final

- [ ] Task 1 ✅ `PremiumModal` component creado
- [ ] Task 2 ✅ Botones CSV/PDF en rutina activa con tracking y modal
- [ ] Build pasa sin errores
- [ ] `trackEvent('premium_feature_click', { feature: 'csv_export' | 'pdf_export' })` se trackea al click
- [ ] Modal se cierra con Escape y con click en overlay
