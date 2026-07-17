# Supabase — Migraciones

## Estructura

```
supabase/
  migrations/
    001_schema_inicial.sql   — tablas base + RLS
    002_perfiles.sql         — tabla de perfiles de usuario
```

## Cómo aplicar en un proyecto nuevo (ej: entorno dev)

1. Abrí el proyecto en [supabase.com](https://supabase.com)
2. Andá a **SQL Editor**
3. Pegá y ejecutá cada archivo en orden numérico: `001`, `002`, etc.

## Regla: cada cambio de schema = nueva migración

Cuando necesites cambiar la DB:
1. Creá un archivo nuevo: `003_nombre_descriptivo.sql`
2. Escribí el SQL del cambio (CREATE TABLE, ALTER TABLE, etc.)
3. Aplicalo en **dev primero**, verificá, luego en **prod**
4. Commiteá el archivo junto con el código que lo usa

**Nunca modifiques una migración ya aplicada.** Siempre agregá una nueva.
