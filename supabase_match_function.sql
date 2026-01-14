-- Función para búsqueda semántica en Supabase
-- Ejecuta este SQL en tu base de datos de Supabase para habilitar búsqueda por similitud

CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fitness_knowledge.id,
    fitness_knowledge.content,
    fitness_knowledge.metadata,
    1 - (fitness_knowledge.embedding <=> query_embedding) as similarity
  FROM fitness_knowledge
  WHERE 1 - (fitness_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY fitness_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Nota: 
-- - text-embedding-3-small genera vectores de 1536 dimensiones
-- - Si cambias a text-embedding-3-large, ajusta a vector(3072)
-- - match_threshold: 0.7 = 70% de similitud mínima (ajusta según necesites)
-- - match_count: número de resultados a retornar

