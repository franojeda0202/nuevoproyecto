# Procesador de Conocimiento de Fitness

Script para procesar archivos Markdown de conocimiento y cargarlos en Supabase con embeddings vectoriales para búsqueda semántica.

## Características

- ✅ **Chunking inteligente**: Divide texto en chunks de ~1000 caracteres con overlap de 200
- ✅ **Preserva secciones**: Intenta respetar headers (##, ###) cuando es posible
- ✅ **Metadata rica**: Extrae fuente, tema, autor del frontmatter YAML
- ✅ **Detección de cambios**: Solo procesa archivos nuevos o modificados (comparando hashes)
- ✅ **Idempotente**: Puede ejecutarse múltiples veces sin duplicar datos

## Instalación

1. Instalar dependencias:
```bash
# En macOS/Linux, usa python3
python3 -m pip install -r requirements.txt

# O si tienes pip instalado directamente:
pip install -r requirements.txt
```

2. Configurar variables de entorno:

Crea o edita tu archivo `.env` con:

```env
# OpenAI
OPENAI_API_KEY=sk-tu-api-key-aqui

# Supabase (opción 1: service role key - recomendado para scripts)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Opción 2: Usar las mismas variables que Next.js
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Nota**: Si usas `ANON_KEY`, asegúrate de tener permisos de escritura en la tabla `fitness_knowledge`. Para scripts, es mejor usar `SERVICE_ROLE_KEY` (más permisos).

## Uso

```bash
# En macOS/Linux, usa python3
python3 process_knowledge.py

# O si tienes python configurado:
python process_knowledge.py
```

El script:
1. Busca todos los archivos `.md` en `conocimiento_agente/`
2. Compara hashes para detectar archivos nuevos/modificados
3. Extrae metadata del frontmatter YAML
4. Divide en chunks respetando secciones
5. Genera embeddings con OpenAI
6. Inserta en Supabase

## Estructura de la Tabla

La tabla `fitness_knowledge` debe tener estas columnas:

- `id` (int8, PK): Auto-generado
- `content` (text): Texto del chunk
- `embedding` (vector): Vector embedding (pgvector)
- `metadata` (jsonb): JSON con:
  ```json
  {
    "filename": "01_volumen_entrenamiento_strongerbyscience.md",
    "file_hash": "abc123...",
    "chunk_index": 0,
    "total_chunks": 5,
    "section": "Priorización",
    "fuente": "https://...",
    "tema": "Volumen de Entrenamiento",
    "autor": "Nathan Jones"
  }
  ```

## Detección de Cambios

El script guarda el hash SHA256 del contenido de cada archivo en `metadata.file_hash`. 

- Si el archivo no existe en Supabase → Se procesa
- Si el archivo existe pero el hash cambió → Se eliminan chunks antiguos y se re-procesa
- Si el archivo existe con el mismo hash → Se salta (ya está actualizado)

## Búsqueda Semántica en n8n

En tu workflow de n8n, puedes hacer búsqueda semántica así:

```javascript
// 1. Generar embedding de la pregunta del usuario
const userQuery = "¿Cuántas series por semana para hipertrofia?";
const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: userQuery
  })
});
const embeddingData = await openaiResponse.json();
const embedding = embeddingData.data[0].embedding;

// 2. Buscar chunks similares en Supabase
const { data } = await supabase
  .rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5
  });

// 3. Usar los chunks más relevantes como contexto para el agente
```

**Nota**: Necesitas crear una función en Supabase para la búsqueda por similitud. SQL ejemplo:

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
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
```

## Personalización

Puedes ajustar estos parámetros en el script:

```python
CHUNK_SIZE = 1000  # Tamaño de chunk en caracteres
CHUNK_OVERLAP = 200  # Overlap entre chunks
```

Para cambiar el modelo de embeddings:
```python
embedding = get_embedding(chunk['content'], model="text-embedding-3-large")
```

## Troubleshooting

**Error: "OPENAI_API_KEY no encontrada"**
- Verifica que tu `.env` tenga la variable configurada

**Error: "Credenciales de Supabase no encontradas"**
- Verifica `SUPABASE_URL` y `SUPABASE_KEY` (o `NEXT_PUBLIC_*`)

**Error: "permission denied"**
- Usa `SERVICE_ROLE_KEY` en lugar de `ANON_KEY` para scripts

**Chunks duplicados**
- El script elimina chunks antiguos antes de re-procesar. Si ves duplicados, verifica que el hash se está guardando correctamente.

