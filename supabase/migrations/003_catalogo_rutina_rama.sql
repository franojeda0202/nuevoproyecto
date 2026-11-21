-- =============================================================
-- 003: ejercicios que faltaban para cargar la rutina de Rama
-- Fuente: docs/feedback/2026-11-21-rama-rutina-actual.md
--
-- Correr a mano en el SQL Editor de Supabase. Es idempotente: si un
-- nombre ya existe, no lo vuelve a insertar.
--
-- Mismo vocabulario que el seed:
--   segmento: 'tren superior' | 'tren inferior' | 'core' (nuevo)
--   patron_movimiento: 'empuje' | 'tracción' | 'piernas' | 'core' (nuevo)
--   equipamiento: 'barra' | 'mancuernas' | 'maquina' (Smith y poleas cuentan como máquina,
--   igual que en las reglas de equipamiento del prompt de generación)
--
-- Nombres que en el video aparecían cortados: se usa solo la parte visible.
-- Si Rama confirma el nombre completo, renombrar con un UPDATE en otra migración.
--   'extensión de tríceps con barra'                    (… - espalda a…)
--   'extensión de tríceps trasnuca unilateral en polea' (… con t…)
--   'extensión de tríceps unilateral'                   (… - espalda a…; equipamiento a confirmar)
--
-- Ejercicios de la rutina que YA estaban en el catálogo (no se insertan):
--   Jalón neutro                         -> 'jalón al pecho en polea agarre neutro'
--   Peso muerto rumano con barra         -> 'peso muerto rumano'
--   Extensión de cuádriceps              -> 'camilla de cuadriceps'
--   Pec deck                             -> 'pecho mariposa'
--   Press inclinado 45° con mancuernas   -> 'pecho inclinado c/mancuerna'
--   Elevaciones laterales con mancuerna… -> 'vuelos laterales'
--   Bíceps martillo con mancuernas…      -> 'bicep martillo'
-- =============================================================

INSERT INTO ejercicios (nombre, segmento, patron_movimiento, grupo_muscular, tipo_ejercicio, equipamiento, dificultad_tecnica)
SELECT v.nombre, v.segmento, v.patron_movimiento, v.grupo_muscular, v.tipo_ejercicio, v.equipamiento, v.dificultad_tecnica
FROM (VALUES
  -- Tracción
  ('remo T agarre amplio',                               'tren superior', 'tracción', 'espalda',         'compuesto', 'maquina',    2),
  ('remo unilateral en polea',                           'tren superior', 'tracción', 'espalda',         'aislado',   'maquina',    2),
  ('remo en polea agarre amplio prono',                  'tren superior', 'tracción', 'espalda',         'compuesto', 'maquina',    2),
  ('remo gironda',                                       'tren superior', 'tracción', 'espalda',         'compuesto', 'maquina',    2),
  ('pec deck reverso',                                   'tren superior', 'tracción', 'hombros',         'aislado',   'maquina',    3),
  ('curl de bicep supino en banco scott al revés',       'tren superior', 'tracción', 'bicep',           'aislado',   'mancuernas', 3),
  ('curl de bicep predicador en máquina',                'tren superior', 'tracción', 'bicep',           'aislado',   'maquina',    3),
  -- Empuje
  ('pecho plano en máquina',                             'tren superior', 'empuje',   'pecho',           'compuesto', 'maquina',    2),
  ('pecho plano en smith',                               'tren superior', 'empuje',   'pecho',           'compuesto', 'maquina',    2),
  ('press inclinado 45° en smith',                       'tren superior', 'empuje',   'pecho',           'compuesto', 'maquina',    2),
  ('press cerrado en smith',                             'tren superior', 'empuje',   'tricep;pecho',    'compuesto', 'maquina',    2),
  ('vuelos laterales en máquina',                        'tren superior', 'empuje',   'hombros',         'aislado',   'maquina',    3),
  ('extensión de tríceps con barra',                     'tren superior', 'empuje',   'tricep',          'aislado',   'barra',      3),
  ('extensión de tríceps trasnuca unilateral en polea',  'tren superior', 'empuje',   'tricep',          'aislado',   'maquina',    3),
  ('extensión de tríceps unilateral',                    'tren superior', 'empuje',   'tricep',          'aislado',   'maquina',    3),
  -- Piernas
  ('sentadilla hack',                                    'tren inferior', 'piernas',  'glúteos;cuadriceps', 'compuesto', 'maquina', 2),
  ('curl femoral sentado',                               'tren inferior', 'piernas',  'isquiotibiales',  'aislado',   'maquina',    3),
  ('aductor en máquina',                                 'tren inferior', 'piernas',  'aductores',       'aislado',   'maquina',    3),
  ('gemelos en prensa',                                  'tren inferior', 'piernas',  'gemelos',         'aislado',   'maquina',    3),
  -- Core
  ('crunch abdominal en polea',                          'core',          'core',     'abdomen',         'aislado',   'maquina',    3)
) AS v(nombre, segmento, patron_movimiento, grupo_muscular, tipo_ejercicio, equipamiento, dificultad_tecnica)
WHERE NOT EXISTS (
  SELECT 1 FROM ejercicios e WHERE lower(e.nombre) = lower(v.nombre)
);
