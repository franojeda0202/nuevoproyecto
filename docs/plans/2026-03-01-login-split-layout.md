# Login Split Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar la pantalla de login de un formulario centrado en página gris a un split layout 50/50: panel izquierdo con imagen de gym + tagline motivacional, panel derecho con el formulario. Mobile muestra solo el formulario.

**Architecture:** Dos tareas independientes. Task 1 descarga la imagen al directorio `/public/images/`. Task 2 refactoriza `LoginForm.tsx` — reemplaza el contenedor `min-h-screen app-page-bg flex items-center justify-center` por un layout `min-h-screen flex` con dos paneles. El panel izquierdo usa `background-image` CSS inline sobre la imagen descargada con overlay `bg-neutral-900/65`. La lógica del form (auth, validación, estado) no cambia. Fix de paso: agregar `flex items-center justify-center` al submit button que tiene `h-12` fijo pero el texto no centra verticalmente.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, imagen estática en `/public/images/gym-bg.jpg`

---

### Task 1: Descargar imagen de gym a /public/images/

**Files:**
- Create directory: `public/images/`
- Create: `public/images/gym-bg.jpg`

**Step 1: Crear el directorio**

```bash
mkdir -p /Users/franciscoojeda/Documents/proyects/nuevoproyecto/public/images
```

**Step 2: Descargar imagen de gym desde Unsplash**

```bash
curl -L "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80" \
  -o /Users/franciscoojeda/Documents/proyects/nuevoproyecto/public/images/gym-bg.jpg
```

Esta imagen es un gym interior con pesas/barras — contraste oscuro, funciona bien con overlay. Si el curl falla o la imagen no carga, usar esta alternativa:

```bash
curl -L "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1920&q=80" \
  -o /Users/franciscoojeda/Documents/proyects/nuevoproyecto/public/images/gym-bg.jpg
```

**Step 3: Verificar que el archivo existe y tiene tamaño razonable (> 50KB)**

```bash
ls -lh /Users/franciscoojeda/Documents/proyects/nuevoproyecto/public/images/gym-bg.jpg
```

Expected: archivo de al menos 100KB.

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add public/images/gym-bg.jpg
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
assets: agregar imagen de gym para login split layout

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Refactorizar LoginForm al split layout + fix botón

**Files:**
- Modify: `app/components/LoginForm.tsx`

**Step 1: Leer el archivo completo**

Prestar especial atención al JSX del `return` (línea 211 en adelante).

**Step 2: Reemplazar el JSX completo del return**

El JSX actual empieza en la línea 211 con:
```tsx
return (
  <div className="min-h-screen app-page-bg flex items-center justify-center p-4 md:p-6">
    <div className="w-full max-w-md flex flex-col items-center">
      ...logo header...
      ...form card...
      ...footer...
    </div>
  </div>
)
```

Reemplazar TODO el JSX del return (desde el `return (` hasta el `}` de cierre) con:

```tsx
  return (
    <div className="min-h-screen flex">

      {/* Panel izquierdo — imagen de gym (solo desktop) */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        {/* Imagen de fondo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/gym-bg.jpg')" }}
        />
        {/* Overlay oscuro para legibilidad */}
        <div className="absolute inset-0 bg-neutral-900/65" />
        {/* Contenido sobre el overlay */}
        <div className="relative z-10 flex flex-col justify-end px-12 py-16">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <svg className="w-9 h-9 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
            </svg>
            <span className="text-4xl font-display text-white tracking-widest uppercase leading-none">
              GymLogic
            </span>
          </div>
          {/* Tagline */}
          <p className="text-5xl font-display text-white tracking-wider uppercase leading-tight">
            Tu rutina lista<br />en segundos.<br />Sin excusas.
          </p>
          {/* Línea decorativa */}
          <div className="mt-6 h-1 w-16 bg-yellow-500 rounded-full" />
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md">

          {/* Logo — solo mobile (el desktop lo tiene en el panel izquierdo) */}
          <div className="flex flex-col items-center mb-10 md:hidden">
            <div className="flex items-center justify-center gap-3 mb-1">
              <svg className="w-10 h-10 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
              </svg>
              <h1 className="text-6xl font-display text-slate-900 tracking-widest uppercase leading-none">
                GymLogic
              </h1>
            </div>
            <p className="text-slate-500 text-base font-medium mt-3">
              Tu coach digital personal
            </p>
          </div>

          {/* Título del form — solo desktop */}
          <div className="hidden md:block mb-8">
            <h1 className="text-4xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
              Bienvenido
            </h1>
            <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
          </div>

          {/* Formulario */}
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Tabs Login/Registro */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setMessage(null)
                  setPasswordError(null)
                }}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-md'
                    : 'bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setMessage(null)
                  setPasswordError(null)
                }}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  mode === 'signup'
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-md'
                    : 'bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 h-12 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all outline-none"
                placeholder="tu@email.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Contraseña
                {mode === 'signup' && (
                  <span className="text-gray-500 font-normal ml-2">
                    (mín. 6 caracteres, 1 mayúscula, 1 número)
                  </span>
                )}
              </label>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className={`w-full px-4 py-3.5 h-12 border rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all outline-none ${
                  passwordError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'
                }`}
                placeholder="••••••••"
                required
                minLength={6}
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-600 font-medium">{passwordError}</p>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            {message && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
                {message}
              </div>
            )}

            {/* Submit — fix: flex items-center justify-center para centrar texto verticalmente */}
            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !!passwordError)}
              className="w-full h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10 flex items-center justify-center"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-8">
            Rutinas personalizadas con IA • Powered by GymLogic
          </p>
        </div>
      </div>

    </div>
  )
}
```

Nota: el form ya no tiene el card wrapper (`bg-white rounded-2xl border shadow`) ni la barra de acento amarilla superior — el panel derecho blanco es el "card". El form queda limpio con solo sus campos.

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: build exitoso sin errores TypeScript.

**Step 4: Self-review**

- Desktop: `hidden md:flex md:w-1/2` panel izquierdo, `w-full md:w-1/2` panel derecho
- Mobile: solo el panel derecho visible (panel izquierdo tiene `hidden md:flex`)
- Logo + h1 en panel derecho tiene clase `md:hidden` (solo mobile)
- "Bienvenido" + acento amarillo tiene `hidden md:block` (solo desktop)
- Submit button tiene `flex items-center justify-center` (fix centering)
- Toda la lógica del form (handleSubmit, handlePasswordChange, estado) está intacta
- No se importa nada nuevo (no hay dependencias nuevas)
- Build pasa

**Step 5: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/LoginForm.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
ui: login split layout — imagen gym + tagline + fix centrado botón

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist final

- [ ] Task 1 ✅ `public/images/gym-bg.jpg` descargada y commiteada
- [ ] Task 2 ✅ Split layout implementado — panel izquierdo oscuro con imagen, panel derecho blanco con form
- [ ] Desktop: imagen + tagline visibles a la izquierda, form a la derecha
- [ ] Mobile: solo el form, logo visible arriba
- [ ] Submit button texto centrado verticalmente (`flex items-center justify-center`)
- [ ] Lógica de auth intacta (handleSubmit, validaciones, mensajes de error)
- [ ] Build pasa sin errores
