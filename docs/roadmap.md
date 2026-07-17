# Roadmap — Lanzamiento julio 2026

Backlog priorizado para lanzar versión monetizable.

---

## Orden de ejecución

1. Onboarding redesign + carga manual de rutina (texto libre)
2. Catálogo expandido + ejercicios custom (prerequisito del punto 1)
3. Mejora de métricas (progreso por ejercicio, evolución de volumen)
4. PWA + Rebranding (en paralelo)
5. Definir tier free vs pro + paywall
6. Integración de pagos (Stripe / MercadoPago)
7. Features premium: peso corporal, Harris-Benedict, social sharing
8. Notificaciones push

---

## Antes de lanzar (must-have)

### Producto core
- [ ] **Onboarding redesign** — pantalla de elección al entrar sin rutina: "Generá con IA" vs "Creá manualmente"
- [ ] **Creación manual de rutina** — flujo: seleccionar cantidad de días → configurar cada día → agregar ejercicios
- [ ] **Carga de rutina por texto libre** — usuario pega o tipea su rutina en lenguaje natural, IA la parsea y muestra preview para confirmar/editar. Wizard manual como fallback para editar o crear desde cero.
- [ ] **Catálogo de ejercicios expandido** — agregar ejercicios comunes que faltan (~200 ejercicios)
- [ ] **Ejercicios custom por usuario** — si el ejercicio no existe en el catálogo, el usuario puede crearlo (privado, vinculado a su cuenta)
- [ ] **Equipamiento en generación IA** — el campo está desactivado ("próximamente"), hay que activarlo y conectarlo al prompt

### Métricas y progreso
- [ ] **Progreso por ejercicio** — gráfico de evolución de peso/reps a lo largo del tiempo por ejercicio
- [ ] **Métricas de volumen** — evolución del volumen total por semana/mes (series × reps × peso), comparativa entre períodos
- [ ] **Seguimiento de peso corporal** — registro diario de peso, media semanal automática, gráfico de evolución
- [ ] **Sección de alimentación** — calculadora Harris-Benedict: TDEE, calorías de mantenimiento, déficit/superávit según objetivo

### Social
- [ ] **Compartir entrenamientos** — tarjeta visual para compartir sesión terminada (WhatsApp, Instagram, etc.)
- [ ] **Compartir rutinas** — link o imagen de tu rutina para enviar a otros
- [ ] **Compartir PRs** — tarjeta automática cuando batís un récord personal

### Notificaciones (con PWA)
- [ ] **Recordatorios de entrenamiento** — push notification en el día que toca entrenar según rutina
- [ ] **Alerta de racha** — notificación si va a romperse la racha semanal

### Monetización
- [ ] **Definir tier free vs pro** — qué features quedan libres y cuáles son premium
- [ ] **Integración de pagos** — Stripe o MercadoPago, subscription mensual
- [ ] **Gestión de suscripción** — página de cuenta, estado, cancelar

### PWA
- [ ] **manifest.json + íconos** — nombre, colores, ícono de app
- [ ] **Service worker básico** — cache del shell, offline fallback
- [ ] **Install prompt** — banner "Agregar a pantalla de inicio"

### Identidad
- [ ] **Rebranding** — nuevo nombre + identidad visual (logo, paleta)
- [ ] **Dominio propio**

---

## Post-lanzamiento (backlog)

- [ ] Sugerencias de progresión automática — "la última vez hiciste 80kg × 8, probá 82.5kg hoy"
- [ ] App nativa (iOS / Android) — después de validar con PWA
- [ ] Limitaciones físicas / lesiones en el perfil de usuario
- [ ] Modo múltiples rutinas activas
- [ ] Catálogo de ejercicios con imágenes/videos/instrucciones

---

## Decisiones pendientes

- Nombre del producto
- Precio de suscripción
- Qué incluye el tier free (para definir antes de implementar monetización)
