-- =============================================================
-- Migración 002: Tabla de perfiles de usuario
-- Guarda preferencias persistentes del formulario de onboarding
-- =============================================================

CREATE TABLE IF NOT EXISTS perfiles (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo         TEXT        NOT NULL,
  nivel            TEXT        NOT NULL,
  equipamiento     TEXT        NOT NULL,
  duracion_minutos INTEGER     NOT NULL,
  genero           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE  USING (auth.uid() = user_id);
