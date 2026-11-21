# Dirección de producto

Escrito el 2026-11-21, al retomar el proyecto. Sirve para no re-discutir lo
mismo en cada sesión. Leerlo antes de proponer features nuevas.

## Dónde estamos

La app genera rutinas con IA y registra cada sesión de entrenamiento: peso y
repeticiones por serie, historial, récords personales y calendario.

El primer usuario real es Rama. Quiere su rutina adentro de la app y llevar
el seguimiento de sus pesos ahí, en vez de en un Excel. La validación es su
uso real, no el roadmap.

## La regla que ordena todo lo demás

**No construir nada por especulación.** Cada feature que se agrega y no se
usa empeora la app: más ruido, más mantenimiento, más lugares donde perderse.
Esperar a que Rama sienta la fricción y la cuente. El feedback se registra en
`docs/feedback/`.

## El orden acordado

1. Que la app ande bien en el teléfono, en el gimnasio: inputs a 16px, áreas
   táctiles de 44px, instalable como app.
2. Cargar la rutina de Rama desde su Excel, a mano o con un script. No hace
   falta el flujo de carga manual para empezar.
3. Que la use una o dos semanas.
4. Charla de feedback con la plantilla de `docs/feedback/plantilla.md`.
5. Decidir lo siguiente con eso.

## Decidido el 2026-11-21, después de ver la rutina de Rama

- **Sí:** agregar al catálogo los ejercicios que faltan (migración `003`).
- **Sí, simple:** rango de repeticiones distinto por serie, en el mismo campo de texto ("6-8 / 8-10").
- **No por ahora:** cargar las notas por ejercicio del coach.
- **Sí, después de ver la de TBI:** "Ver progreso" por ejercicio. Primero hay que ver qué muestra la app del coach, para hacerlo mejor y no una copia.

## Cómo trabaja el coach de Rama (2026-11-21)

- La rutina cambia cada 4 o 5 meses. La pantalla de rutina es de consulta, no de edición diaria: se ve en modo lectura y editar queda detrás de un botón.
- Cada 1 o 2 semanas, según el progreso, el coach sube el volumen, casi siempre agregando series. Idea a futuro: registrar esas subidas sin rearmar la rutina (por ejemplo, "semana 3: +1 serie en los compuestos") y mostrarlas en Hoy.

## En espera hasta tener feedback

Están en `docs/roadmap.md`, pero no se construyen hasta que el uso real diga
que hacen falta:

- Flujo de carga manual de rutina en la app.
- Modo oscuro y colores como tokens.
- Auth en el proxy y migración a Server Components.
- Monetización, social y notificaciones.
