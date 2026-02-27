# Minor Issues Pre-Producción — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver los 8 issues menores para dejar el código limpio, sin warnings de ESLint y listo para producción.

**Architecture:** Fixes quirúrgicos sin dependencias nuevas. Los cambios son independientes entre sí y pueden ejecutarse en cualquier orden.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, `next/link`

---

## Issues a resolver

| # | Issue | Archivo principal |
|---|-------|------------------|
| M2 | Archivos dev en root se despliegan a Vercel | Crear `.vercelignore` |
| M1 | `@supabase/auth-helpers-nextjs` dependencia sin usar | `package.json` |
| M6 | `<a href="/">` en error pages (ESLint error) | `app/error.tsx`, `app/rutinas/error.tsx` |
| M4 | `onKeyPress` deprecated en ChatBubble (ESLint warning) | `app/components/ChatBubble.tsx` |
| M5 | Prop `diaId` en EjercicioModal nunca usada internamente | `app/components/rutina/EjercicioModal.tsx` |
| M3 | Tipos `any` en LoginForm (ESLint error) | `app/components/LoginForm.tsx` |
| M7 | Sin límite de longitud en mensajes del chat | `app/components/ChatBubble.tsx` |
| M8 | `confirm()` del browser para limpiar chat | `app/components/ChatBubble.tsx` |

---

### Task 1: M2 — Crear .vercelignore

**Contexto:** Los archivos `process_knowledge.py`, `requirements.txt`, `supabase_match_function.sql`, `PROCESS_KNOWLEDGE_README.md` y la carpeta `conocimiento_agente/` son herramientas de desarrollo que no deben deployarse a Vercel. No existe `.vercelignore`.

**Files:**
- Create: `.vercelignore`

**Step 1:** Verificar que existen los archivos:
```bash
ls /Users/franciscoojeda/Documents/proyects/nuevoproyecto/*.py /Users/franciscoojeda/Documents/proyects/nuevoproyecto/*.sql /Users/franciscoojeda/Documents/proyects/nuevoproyecto/PROCESS_KNOWLEDGE_README.md 2>/dev/null
```

**Step 2:** Crear `.vercelignore` en la raíz del proyecto con este contenido exacto:
```
# Herramientas de desarrollo — no deployar
process_knowledge.py
requirements.txt
supabase_match_function.sql
PROCESS_KNOWLEDGE_README.md
conocimiento_agente/
docs/
```

**Step 3:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add .vercelignore
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "chore: agregar .vercelignore para excluir archivos dev del deployment"
```

---

### Task 2: M1 — Eliminar dependencia @supabase/auth-helpers-nextjs

**Contexto:** `package.json` lista `@supabase/auth-helpers-nextjs@^0.15.0` pero esta dependencia nunca se importa en el código. El proyecto usa `@supabase/ssr` en su lugar.

**Files:**
- Modify: `package.json`

**Step 1:** Verificar que no se importa en ningún archivo:
```bash
grep -r "auth-helpers-nextjs" /Users/franciscoojeda/Documents/proyects/nuevoproyecto --include="*.ts" --include="*.tsx" --include="*.js" | grep -v node_modules
```
Si hay resultados (fuera de node_modules), NO eliminar y reportar.

**Step 2:** Si no hay resultados, desinstalar:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm uninstall @supabase/auth-helpers-nextjs
```

**Step 3:** Verificar build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 4:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add package.json package-lock.json
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "chore: eliminar dependencia @supabase/auth-helpers-nextjs no utilizada"
```

---

### Task 3: M6 — Reemplazar `<a>` con `<Link>` en error pages

**Contexto:** `app/error.tsx` y `app/rutinas/error.tsx` usan `<a href="/">` para navegar al inicio. Next.js ESLint reporta esto como error (`@next/next/no-html-link-for-pages`). Debe usarse `<Link>` de `next/link` para navegación client-side sin recarga completa.

**Files:**
- Modify: `app/error.tsx`
- Modify: `app/rutinas/error.tsx`

**Step 1:** En `app/error.tsx`:

Agregar el import de Link después de los imports existentes:
```typescript
import Link from 'next/link'
```

Cambiar:
```tsx
<a
  href="/"
  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all text-center"
>
  Ir al inicio
</a>
```

Por:
```tsx
<Link
  href="/"
  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all text-center"
>
  Ir al inicio
</Link>
```

**Step 2:** En `app/rutinas/error.tsx`:

Mismo proceso: agregar `import Link from 'next/link'` y cambiar `<a href="/">` por `<Link href="/">` / `</Link>`.

El texto es "Volver al inicio" en este archivo.

**Step 3:** Build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 4:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/error.tsx app/rutinas/error.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: reemplazar <a> con <Link> en error boundaries"
```

---

### Task 4: M4 — Reemplazar onKeyPress deprecated con onKeyDown

**Contexto:** En `ChatBubble.tsx`, el input usa `onKeyPress` que está deprecado en React 17+ y eliminado en especificaciones modernas de browsers. Debe reemplazarse por `onKeyDown`.

**Files:**
- Modify: `app/components/ChatBubble.tsx`

**Step 1:** Leer `app/components/ChatBubble.tsx` y ubicar `handleKeyPress` y `onKeyPress`.

**Step 2:** Renombrar la función `handleKeyPress` a `handleKeyDown`:
```typescript
// ANTES:
const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {

// DESPUÉS:
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
```

**Step 3:** Cambiar el atributo del input de `onKeyPress` a `onKeyDown`:
```tsx
// ANTES:
onKeyPress={handleKeyPress}

// DESPUÉS:
onKeyDown={handleKeyDown}
```

**Step 4:** Build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 5:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/ChatBubble.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: reemplazar onKeyPress deprecated por onKeyDown en ChatBubble"
```

---

### Task 5: M5 — Eliminar prop diaId no usada en EjercicioModal

**Contexto:** `EjercicioModal` recibe `diaId: string` en su interface y lo destructura, pero nunca lo usa internamente. El padre (`rutinas/page.tsx`) lo usa para su propia lógica pero no necesita pasárselo al modal.

**Files:**
- Modify: `app/components/rutina/EjercicioModal.tsx`
- Modify: `app/rutinas/page.tsx`

**Step 1:** Leer `app/components/rutina/EjercicioModal.tsx` completo para verificar que `diaId` nunca se menciona en el cuerpo del componente (solo en la interface y destructuring).

**Step 2:** En `EjercicioModal.tsx`, eliminar `diaId` de la interface:
```typescript
// ANTES:
interface EjercicioModalProps {
  isOpen: boolean
  mode: 'edit' | 'add'
  ejercicio: EjercicioEditable | null
  diaId: string         // ← eliminar esta línea
  diaNombre: string
  ...
}

// DESPUÉS:
interface EjercicioModalProps {
  isOpen: boolean
  mode: 'edit' | 'add'
  ejercicio: EjercicioEditable | null
  diaNombre: string
  ...
}
```

**Step 3:** En `EjercicioModal.tsx`, eliminar `diaId` del destructuring del componente:
```typescript
// ANTES:
export default function EjercicioModal({
  isOpen,
  mode,
  ejercicio,
  diaId,        // ← eliminar
  diaNombre,
  ...

// DESPUÉS:
export default function EjercicioModal({
  isOpen,
  mode,
  ejercicio,
  diaNombre,
  ...
```

**Step 4:** En `app/rutinas/page.tsx`, eliminar el prop `diaId` al renderizar `<EjercicioModal>`:
```tsx
// ANTES:
<EjercicioModal
  isOpen={modalState.isOpen}
  mode={modalState.mode}
  ejercicio={modalState.ejercicio}
  diaId={modalState.diaId || ''}    // ← eliminar esta línea
  diaNombre={getDiaNombre()}
  ...

// DESPUÉS:
<EjercicioModal
  isOpen={modalState.isOpen}
  mode={modalState.mode}
  ejercicio={modalState.ejercicio}
  diaNombre={getDiaNombre()}
  ...
```

**Step 5:** Build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 6:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/rutina/EjercicioModal.tsx app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: eliminar prop diaId no utilizada en EjercicioModal"
```

---

### Task 6: M3 — Reemplazar tipos `any` con `unknown` en LoginForm

**Contexto:** `app/components/LoginForm.tsx` usa `any` en dos lugares que ESLint reporta como error:
1. La función `translateError(error: any)` — parámetro tipado como `any`
2. En uno o más bloques `catch (err: any)`

**Files:**
- Modify: `app/components/LoginForm.tsx`

**Step 1:** Leer el archivo completo y ubicar todas las ocurrencias de `: any`.

**Step 2:** Cambiar `translateError(error: any)` a `translateError(error: unknown)`. Si dentro de la función se accede a propiedades de `error`, agregar el guard:
```typescript
const message = error instanceof Error ? error.message : String(error)
```

**Step 3:** Cambiar cada `catch (err: any)` a `catch (err: unknown)`. Dentro del bloque catch, si se usa `err.message`, reemplazar con:
```typescript
const message = err instanceof Error ? err.message : 'Error desconocido'
```

**Step 4:** Build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 5:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/LoginForm.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: reemplazar tipos any con unknown en LoginForm"
```

---

### Task 7: M7 — Límite de longitud de mensajes en chat

**Contexto:** `ChatBubble.tsx` envía el contenido de los mensajes sin validar su longitud. Un usuario puede escribir un mensaje extremadamente largo que infle el token count de OpenAI más allá del `max_tokens: 300` configurado.

**Files:**
- Modify: `app/components/ChatBubble.tsx`

**Step 1:** Leer `ChatBubble.tsx` y ubicar las constantes al inicio y la función `handleSend`.

**Step 2:** Agregar una constante después de `MAX_MESSAGES`:
```typescript
const MAX_CONTENT_LENGTH = 500 // caracteres máximos por mensaje
```

**Step 3:** En `handleSend`, agregar validación de longitud justo después del check de `!inputValue.trim()`:
```typescript
const handleSend = async () => {
  if (!inputValue.trim() || isLoading) return

  // Validar longitud máxima
  if (inputValue.trim().length > MAX_CONTENT_LENGTH) {
    toast.error(`El mensaje no puede superar los ${MAX_CONTENT_LENGTH} caracteres`)
    return
  }

  // ... resto del handler igual
```

**Step 4:** Agregar `maxLength` al input para feedback visual inmediato:
```tsx
<input
  ...
  maxLength={MAX_CONTENT_LENGTH}
  ...
/>
```

**Step 5:** Build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 6:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/ChatBubble.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: agregar límite de 500 caracteres por mensaje en chat"
```

---

### Task 8: M8 — Reemplazar confirm() con confirmación inline en ChatBubble

**Contexto:** `handleClearHistory` usa `confirm()` del browser, que está bloqueado en iframes, inconsistente entre browsers y es mala UX en apps modernas. La solución es un estado local que muestra botones de Cancelar/Confirmar en lugar del diálogo nativo.

**Files:**
- Modify: `app/components/ChatBubble.tsx`

**Step 1:** Leer `ChatBubble.tsx` y ubicar el estado existente y la función `handleClearHistory`.

**Step 2:** Agregar un estado para la confirmación después de los estados existentes:
```typescript
const [showClearConfirm, setShowClearConfirm] = useState(false)
```

**Step 3:** Reemplazar `handleClearHistory`:
```typescript
// ANTES:
const handleClearHistory = () => {
  if (confirm('¿Estás seguro que deseas limpiar el historial de chat?')) {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
    toast.success('Historial limpiado')
  }
}

// DESPUÉS:
const handleClearHistory = () => {
  setMessages([])
  localStorage.removeItem(STORAGE_KEY)
  setShowClearConfirm(false)
  toast.success('Historial limpiado')
}
```

**Step 4:** Reemplazar el botón "Limpiar historial" en el JSX:

```tsx
// ANTES:
{messages.length > 0 && (
  <button
    onClick={handleClearHistory}
    className="mt-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center gap-2"
  >
    <svg .../>
    Limpiar historial
  </button>
)}

// DESPUÉS:
{messages.length > 0 && (
  showClearConfirm ? (
    <div className="mt-2 flex gap-2">
      <button
        onClick={() => setShowClearConfirm(false)}
        className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
      >
        Cancelar
      </button>
      <button
        onClick={handleClearHistory}
        className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all"
      >
        Confirmar
      </button>
    </div>
  ) : (
    <button
      onClick={() => setShowClearConfirm(true)}
      className="mt-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Limpiar historial
    </button>
  )
)}
```

**Step 5:** Build:
```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 6:** Commit:
```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/ChatBubble.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: reemplazar confirm() del browser con confirmación inline en ChatBubble"
```

---

## Checklist final

- [ ] Task 1 ✅ `.vercelignore` creado con archivos dev
- [ ] Task 2 ✅ `@supabase/auth-helpers-nextjs` desinstalado
- [ ] Task 3 ✅ `<Link>` en ambos error boundaries
- [ ] Task 4 ✅ `onKeyDown` reemplaza `onKeyPress`
- [ ] Task 5 ✅ Prop `diaId` eliminada de EjercicioModal
- [ ] Task 6 ✅ `unknown` reemplaza `any` en LoginForm
- [ ] Task 7 ✅ Límite de 500 chars por mensaje en chat
- [ ] Task 8 ✅ Confirmación inline reemplaza `confirm()` en chat
- [ ] `npm run build` pasa sin errores
