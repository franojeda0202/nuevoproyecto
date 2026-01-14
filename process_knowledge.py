#!/usr/bin/env python3
"""
Script para procesar archivos Markdown de conocimiento de fitness
y cargarlos en Supabase con embeddings vectoriales.

Solo procesa archivos nuevos o modificados comparando hashes.
"""

import os
import re
import hashlib
import yaml
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client
import json

# Cargar variables de entorno
load_dotenv()

# Configuración
KNOWLEDGE_DIR = Path("conocimiento_agente")
CHUNK_SIZE = 1000  # caracteres
CHUNK_OVERLAP = 200  # caracteres

# Inicializar clientes
openai_api_key = os.getenv("OPENAI_API_KEY")
supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not openai_api_key:
    raise ValueError("OPENAI_API_KEY no encontrada en variables de entorno")
if not supabase_url or not supabase_key:
    raise ValueError("Credenciales de Supabase no encontradas. Necesitas SUPABASE_URL y SUPABASE_KEY")

openai_client = OpenAI(api_key=openai_api_key)
supabase: Client = create_client(supabase_url, supabase_key)


def parse_frontmatter(content: str) -> Tuple[Optional[Dict], str]:
    """
    Parsea el frontmatter YAML del inicio del archivo.
    Retorna (metadata, contenido_sin_frontmatter)
    """
    # Buscar frontmatter entre ---
    frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
    match = re.match(frontmatter_pattern, content, re.DOTALL)
    
    if match:
        frontmatter_text = match.group(1)
        body = match.group(2)
        try:
            metadata = yaml.safe_load(frontmatter_text)
            return metadata or {}, body
        except yaml.YAMLError:
            return {}, body
    
    return {}, content


def calculate_file_hash(content: str) -> str:
    """Calcula hash SHA256 del contenido del archivo."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def extract_section_title(text: str, start_pos: int) -> Optional[str]:
    """
    Extrae el título de la sección actual buscando el header más cercano antes de start_pos.
    """
    # Buscar el último ## o ### antes de start_pos
    header_pattern = r'^(#{2,3})\s+(.+)$'
    lines = text[:start_pos].split('\n')
    
    for line in reversed(lines):
        match = re.match(header_pattern, line.strip())
        if match:
            return match.group(2).strip()
    
    return None


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[Dict[str, any]]:
    """
    Divide el texto en chunks con overlap, intentando respetar secciones cuando es posible.
    Retorna lista de chunks con su contenido y posición.
    """
    chunks = []
    
    # Limpiar texto (remover múltiples espacios en blanco)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Si el texto es más corto que chunk_size, retornar un solo chunk
    if len(text) <= chunk_size:
        section = extract_section_title(text, len(text))
        return [{
            'content': text.strip(),
            'section': section,
            'start': 0,
            'end': len(text)
        }]
    
    start = 0
    while start < len(text):
        end = start + chunk_size
        
        # Si llegamos al final, usar el resto del texto
        if end >= len(text):
            section = extract_section_title(text, start)
            chunks.append({
                'content': text[start:].strip(),
                'section': section,
                'start': start,
                'end': len(text)
            })
            break
        
        # Intentar cortar en un punto lógico (fin de párrafo, fin de línea)
        # Buscar el último salto de línea antes de end
        last_newline = text.rfind('\n', start, end)
        
        # Si encontramos un salto de línea razonable (dentro de los últimos 200 chars), usarlo
        if last_newline > end - 200:
            end = last_newline + 1
        
        section = extract_section_title(text, start)
        chunk_content = text[start:end].strip()
        
        if chunk_content:  # Solo agregar si hay contenido
            chunks.append({
                'content': chunk_content,
                'section': section,
                'start': start,
                'end': end
            })
        
        # Mover start considerando overlap
        start = end - overlap
        if start <= chunks[-1]['start'] if chunks else 0:
            start = end  # Evitar bucles infinitos
    
    return chunks


def get_embedding(text: str, model: str = "text-embedding-3-small") -> List[float]:
    """Genera embedding usando OpenAI API."""
    try:
        response = openai_client.embeddings.create(
            model=model,
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"❌ Error generando embedding: {e}")
        raise


def get_processed_files() -> Dict[str, str]:
    """
    Obtiene lista de archivos ya procesados y sus hashes desde Supabase.
    Retorna dict {filename: hash}
    """
    try:
        # Obtener todos los registros únicos por filename con su hash
        response = supabase.table('fitness_knowledge').select('metadata').execute()
        
        processed = {}
        for row in response.data:
            metadata = row.get('metadata', {})
            filename = metadata.get('filename')
            file_hash = metadata.get('file_hash')
            
            if filename and file_hash:
                # Si encontramos un hash más reciente (último procesado), mantenerlo
                if filename not in processed:
                    processed[filename] = file_hash
                # Nota: asumimos que todos los chunks del mismo archivo tienen el mismo hash
        
        return processed
    except Exception as e:
        print(f"⚠️  Error consultando archivos procesados: {e}")
        return {}


def delete_file_chunks(filename: str):
    """
    Elimina todos los chunks de un archivo antes de re-procesarlo.
    """
    try:
        supabase.table('fitness_knowledge').delete().eq('metadata->>filename', filename).execute()
        print(f"   🗑️  Eliminados chunks anteriores de {filename}")
    except Exception as e:
        print(f"   ⚠️  Error eliminando chunks anteriores: {e}")


def process_file(file_path: Path) -> Tuple[int, int]:
    """
    Procesa un archivo Markdown: lo lee, chunking, genera embeddings y sube a Supabase.
    Retorna (chunks_procesados, chunks_insertados)
    """
    filename = file_path.name
    
    print(f"\n📄 Procesando: {filename}")
    
    # Leer archivo
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"   ❌ Error leyendo archivo: {e}")
        return 0, 0
    
    # Calcular hash
    file_hash = calculate_file_hash(content)
    
    # Verificar si ya está procesado con este hash
    processed_files = get_processed_files()
    if filename in processed_files and processed_files[filename] == file_hash:
        print(f"   ✅ Ya procesado (sin cambios), saltando...")
        return 0, 0
    
    # Parsear frontmatter
    metadata_dict, body_content = parse_frontmatter(content)
    
    # Si el archivo cambió, eliminar chunks antiguos
    if filename in processed_files and processed_files[filename] != file_hash:
        delete_file_chunks(filename)
    
    # Hacer chunking
    chunks = chunk_text(body_content, CHUNK_SIZE, CHUNK_OVERLAP)
    print(f"   📦 Generados {len(chunks)} chunks")
    
    if not chunks:
        print(f"   ⚠️  No se generaron chunks, saltando...")
        return 0, 0
    
    # Procesar cada chunk
    inserted = 0
    for idx, chunk in enumerate(chunks):
        try:
            # Generar embedding
            print(f"   🔄 Generando embedding para chunk {idx + 1}/{len(chunks)}...", end='\r')
            embedding = get_embedding(chunk['content'])
            
            # Preparar metadata
            metadata = {
                'filename': filename,
                'file_hash': file_hash,
                'chunk_index': idx,
                'total_chunks': len(chunks),
                'section': chunk.get('section'),
                **metadata_dict  # Incluir metadata del frontmatter (fuente, tema, autor)
            }
            
            # Insertar en Supabase
            supabase.table('fitness_knowledge').insert({
                'content': chunk['content'],
                'embedding': embedding,
                'metadata': metadata
            }).execute()
            
            inserted += 1
            
        except Exception as e:
            print(f"\n   ❌ Error procesando chunk {idx + 1}: {e}")
            continue
    
    print(f"   ✅ Insertados {inserted}/{len(chunks)} chunks exitosamente")
    return len(chunks), inserted


def main():
    """Función principal."""
    print("🚀 Iniciando procesamiento de archivos de conocimiento...")
    print(f"📁 Directorio: {KNOWLEDGE_DIR.absolute()}")
    
    # Verificar que existe el directorio
    if not KNOWLEDGE_DIR.exists():
        print(f"❌ El directorio {KNOWLEDGE_DIR} no existe")
        return
    
    # Encontrar todos los archivos .md
    md_files = list(KNOWLEDGE_DIR.glob("*.md"))
    
    if not md_files:
        print("⚠️  No se encontraron archivos .md")
        return
    
    print(f"📚 Encontrados {len(md_files)} archivos Markdown\n")
    
    # Procesar cada archivo
    total_chunks = 0
    total_inserted = 0
    files_processed = 0
    
    for file_path in sorted(md_files):
        chunks, inserted = process_file(file_path)
        total_chunks += chunks
        total_inserted += inserted
        if inserted > 0:
            files_processed += 1
    
    print(f"\n{'='*60}")
    print(f"📊 Resumen:")
    print(f"   Archivos procesados: {files_processed}/{len(md_files)}")
    print(f"   Chunks generados: {total_chunks}")
    print(f"   Chunks insertados: {total_inserted}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()

