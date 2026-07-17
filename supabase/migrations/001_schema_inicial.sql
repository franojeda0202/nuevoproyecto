-- =============================================================
-- Migración 001: Schema inicial de GymLogic
-- Incluye: ejercicios, rutinas, sesiones, analytics
-- =============================================================

-- -------------------------------------------------------
-- ejercicios (catálogo global, sin owner)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS ejercicios (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre              TEXT        NOT NULL,
  segmento            TEXT        NOT NULL,
  patron_movimiento   TEXT        NOT NULL,
  grupo_muscular      TEXT        NOT NULL,
  tipo_ejercicio      TEXT        NOT NULL DEFAULT '',
  equipamiento        TEXT        NOT NULL DEFAULT '',
  dificultad_tecnica  INTEGER     DEFAULT 1,
  instrucciones_base  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- rutinas
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rutinas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  objetivo    TEXT,
  frecuencia  INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rutinas_user_id_idx ON rutinas(user_id);

-- -------------------------------------------------------
-- rutina_dias
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rutina_dias (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  rutina_id   UUID        NOT NULL REFERENCES rutinas(id) ON DELETE CASCADE,
  nombre_dia  TEXT        NOT NULL,
  orden       INTEGER     NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rutina_dias_rutina_id_idx ON rutina_dias(rutina_id);

-- -------------------------------------------------------
-- rutina_ejercicios
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rutina_ejercicios (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_id        UUID        NOT NULL REFERENCES rutina_dias(id) ON DELETE CASCADE,
  ejercicio_id  UUID        NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
  series        INTEGER     NOT NULL,
  repeticiones  TEXT        NOT NULL,
  orden         INTEGER     NOT NULL,
  notas_coach   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rutina_ejercicios_dia_id_idx ON rutina_ejercicios(dia_id);

-- -------------------------------------------------------
-- sesiones
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rutina_id     UUID        REFERENCES rutinas(id) ON DELETE SET NULL,
  dia_id        UUID        REFERENCES rutina_dias(id) ON DELETE SET NULL,
  iniciada_at   TIMESTAMPTZ DEFAULT now(),
  finalizada_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Solo una sesión activa por usuario
CREATE UNIQUE INDEX IF NOT EXISTS sesiones_user_activa_unique
  ON sesiones(user_id)
  WHERE finalizada_at IS NULL;

CREATE INDEX IF NOT EXISTS sesiones_user_id_idx ON sesiones(user_id);

-- -------------------------------------------------------
-- sesion_series
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesion_series (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id             UUID        NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  rutina_ejercicio_id   UUID        REFERENCES rutina_ejercicios(id) ON DELETE SET NULL,
  numero_serie          INTEGER     NOT NULL,
  peso_kg               NUMERIC,
  repeticiones          INTEGER,
  completada            BOOLEAN     DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sesion_series_sesion_id_idx ON sesion_series(sesion_id);

-- -------------------------------------------------------
-- user_events (analytics)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name  TEXT        NOT NULL,
  properties  JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_events_user_id_idx ON user_events(user_id);

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================

-- ejercicios: lectura pública (catálogo global)
ALTER TABLE ejercicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ejercicios_select" ON ejercicios FOR SELECT USING (true);

-- rutinas
ALTER TABLE rutinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rutinas_select"  ON rutinas FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "rutinas_insert"  ON rutinas FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rutinas_update"  ON rutinas FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "rutinas_delete"  ON rutinas FOR DELETE  USING (auth.uid() = user_id);

-- rutina_dias (acceso via rutina del usuario)
ALTER TABLE rutina_dias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rutina_dias_select" ON rutina_dias FOR SELECT
  USING (rutina_id IN (SELECT id FROM rutinas WHERE user_id = auth.uid()));
CREATE POLICY "rutina_dias_insert" ON rutina_dias FOR INSERT
  WITH CHECK (rutina_id IN (SELECT id FROM rutinas WHERE user_id = auth.uid()));
CREATE POLICY "rutina_dias_update" ON rutina_dias FOR UPDATE
  USING (rutina_id IN (SELECT id FROM rutinas WHERE user_id = auth.uid()));
CREATE POLICY "rutina_dias_delete" ON rutina_dias FOR DELETE
  USING (rutina_id IN (SELECT id FROM rutinas WHERE user_id = auth.uid()));

-- rutina_ejercicios (acceso via rutina_dias del usuario)
ALTER TABLE rutina_ejercicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rutina_ejercicios_select" ON rutina_ejercicios FOR SELECT
  USING (dia_id IN (
    SELECT rd.id FROM rutina_dias rd
    JOIN rutinas r ON r.id = rd.rutina_id
    WHERE r.user_id = auth.uid()
  ));
CREATE POLICY "rutina_ejercicios_insert" ON rutina_ejercicios FOR INSERT
  WITH CHECK (dia_id IN (
    SELECT rd.id FROM rutina_dias rd
    JOIN rutinas r ON r.id = rd.rutina_id
    WHERE r.user_id = auth.uid()
  ));
CREATE POLICY "rutina_ejercicios_update" ON rutina_ejercicios FOR UPDATE
  USING (dia_id IN (
    SELECT rd.id FROM rutina_dias rd
    JOIN rutinas r ON r.id = rd.rutina_id
    WHERE r.user_id = auth.uid()
  ));
CREATE POLICY "rutina_ejercicios_delete" ON rutina_ejercicios FOR DELETE
  USING (dia_id IN (
    SELECT rd.id FROM rutina_dias rd
    JOIN rutinas r ON r.id = rd.rutina_id
    WHERE r.user_id = auth.uid()
  ));

-- sesiones
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sesiones_select" ON sesiones FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "sesiones_insert" ON sesiones FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sesiones_update" ON sesiones FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "sesiones_delete" ON sesiones FOR DELETE  USING (auth.uid() = user_id);

-- sesion_series (acceso via sesión del usuario)
ALTER TABLE sesion_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sesion_series_select" ON sesion_series FOR SELECT
  USING (sesion_id IN (SELECT id FROM sesiones WHERE user_id = auth.uid()));
CREATE POLICY "sesion_series_insert" ON sesion_series FOR INSERT
  WITH CHECK (sesion_id IN (SELECT id FROM sesiones WHERE user_id = auth.uid()));
CREATE POLICY "sesion_series_update" ON sesion_series FOR UPDATE
  USING (sesion_id IN (SELECT id FROM sesiones WHERE user_id = auth.uid()));
CREATE POLICY "sesion_series_delete" ON sesion_series FOR DELETE
  USING (sesion_id IN (SELECT id FROM sesiones WHERE user_id = auth.uid()));

-- user_events: solo insert propio
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_events_insert" ON user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_events_select" ON user_events FOR SELECT
  USING (auth.uid() = user_id);
