use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tracing::info;
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};

use crate::errors::AppError;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VectorRecord {
    pub id: String,
    pub source_file: String,
    pub content_chunk: String,
    pub embedding: Vec<f32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RagSearchResult {
    pub id: String,
    pub source_file: String,
    pub content_chunk: String,
    pub score: f32,
}

pub struct LocalRagEngine {
    model: Arc<Mutex<Option<Arc<TextEmbedding>>>>,
    workspace_dir: PathBuf,
}

impl LocalRagEngine {
    pub fn new(workspace_dir: impl AsRef<Path>) -> Self {
        Self {
            model: Arc::new(Mutex::new(None)),
            workspace_dir: workspace_dir.as_ref().to_path_buf(),
        }
    }

    /// Ensure the fastembed model is initialized thread-safely
    pub fn get_or_init_model(&self) -> Result<Arc<TextEmbedding>, AppError> {
        let mut guard = self.model.lock();
        if let Some(ref model) = *guard {
            return Ok(model.clone());
        }

        info!("LocalRagEngine: Initializing AllMiniLML6V2 local embedding model...");
        let options = InitOptions::new(EmbeddingModel::AllMiniLML6V2);
        let model = TextEmbedding::try_new(options).map_err(|e| AppError::Config(
            format!("Failed to initialize fastembed model: {}", e)
        ))?;

        let arc_model = Arc::new(model);
        *guard = Some(arc_model.clone());
        info!("LocalRagEngine: Embedding model successfully initialized and cached.");
        Ok(arc_model)
    }

    /// Returns path to the company knowledge directory
    pub fn get_knowledge_dir(&self) -> PathBuf {
        self.workspace_dir.join("company_knowledge")
    }

    /// Returns path to the hidden vector index cache file
    pub fn get_cache_path(&self) -> PathBuf {
        self.workspace_dir.join(".rag_cache.json")
    }

    /// Re-index all documents inside workspace/company_knowledge/
    pub fn reindex(&self) -> Result<usize, AppError> {
        let knowledge_dir = self.get_knowledge_dir();
        if !knowledge_dir.exists() {
            let _ = fs::create_dir_all(&knowledge_dir);
            return Ok(0);
        }

        let model = self.get_or_init_model()?;

        let mut all_chunks: Vec<(String, String)> = Vec::new(); // (source_file, text_chunk)

        let entries = fs::read_dir(&knowledge_dir).map_err(|e| AppError::ToolExecution {
            tool: "rag".to_string(),
            message: format!("Failed to read knowledge directory: {}", e),
        })?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if file_name.starts_with('.') {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    let chunks = chunk_text(&content, 500, 50);
                    for chunk in chunks {
                        all_chunks.push((file_name.clone(), chunk));
                    }
                }
            }
        }

        if all_chunks.is_empty() {
            info!("LocalRagEngine: No text chunks found in {}", knowledge_dir.display());
            let empty_records: Vec<VectorRecord> = Vec::new();
            let cache_json = serde_json::to_string_pretty(&empty_records)?;
            let _ = fs::write(self.get_cache_path(), cache_json);
            return Ok(0);
        }

        info!("LocalRagEngine: Generating embeddings for {} chunks...", all_chunks.len());
        let texts_to_embed: Vec<String> = all_chunks.iter().map(|(_, c)| c.clone()).collect();
        let embeddings = model.embed(texts_to_embed, None).map_err(|e| AppError::ToolExecution {
            tool: "rag".to_string(),
            message: format!("Embedding generation failed: {}", e),
        })?;

        let mut records = Vec::with_capacity(all_chunks.len());
        for (i, (source_file, chunk)) in all_chunks.into_iter().enumerate() {
            let vec = embeddings.get(i).cloned().unwrap_or_default();
            records.push(VectorRecord {
                id: format!("doc-{}-chunk-{}", source_file, i),
                source_file,
                content_chunk: chunk,
                embedding: vec,
            });
        }

        let cache_json = serde_json::to_string_pretty(&records)?;
        fs::write(self.get_cache_path(), cache_json).map_err(|e| AppError::ToolExecution {
            tool: "rag".to_string(),
            message: format!("Failed to save vector cache file: {}", e),
        })?;

        info!("LocalRagEngine: Re-indexed {} vector records to {}", records.len(), self.get_cache_path().display());
        Ok(records.len())
    }

    /// Query the vector cache using cosine similarity
    pub fn search(&self, query: &str, top_k: usize) -> Result<Vec<RagSearchResult>, AppError> {
        let cache_path = self.get_cache_path();
        if !cache_path.exists() {
            let _ = self.reindex();
        }

        if !cache_path.exists() {
            return Ok(Vec::new());
        }

        let cache_data = fs::read_to_string(&cache_path).map_err(|e| AppError::ToolExecution {
            tool: "rag".to_string(),
            message: format!("Failed to read vector cache: {}", e),
        })?;

        let records: Vec<VectorRecord> = serde_json::from_str(&cache_data).unwrap_or_default();
        if records.is_empty() {
            return Ok(Vec::new());
        }

        let model = self.get_or_init_model()?;
        let query_embeddings = model.embed(vec![query.to_string()], None).map_err(|e| AppError::ToolExecution {
            tool: "rag".to_string(),
            message: format!("Failed to embed search query: {}", e),
        })?;

        let query_vec = query_embeddings.first().ok_or_else(|| AppError::ToolExecution {
            tool: "rag".to_string(),
            message: "Empty query vector response".into(),
        })?;

        let mut scored_results: Vec<RagSearchResult> = records
            .into_iter()
            .map(|rec| {
                let score = cosine_similarity(query_vec, &rec.embedding);
                RagSearchResult {
                    id: rec.id,
                    source_file: rec.source_file,
                    content_chunk: rec.content_chunk,
                    score,
                }
            })
            .collect();

        // Sort descending by similarity score
        scored_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored_results.truncate(top_k);

        Ok(scored_results)
    }
}

/// Chunk text into windows of `chunk_size` characters with `overlap` character overlap
fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    if chars.is_empty() {
        return chunks;
    }

    let step = if chunk_size > overlap {
        chunk_size - overlap
    } else {
        chunk_size
    };

    let mut start = 0;
    while start < chars.len() {
        let end = (start + chunk_size).min(chars.len());
        let chunk: String = chars[start..end].iter().collect();
        let trimmed = chunk.trim().to_string();
        if !trimmed.is_empty() {
            chunks.push(trimmed);
        }
        start += step;
    }

    chunks
}

/// Cosine similarity calculation between two float vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|y| y * y).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot_product / (norm_a * norm_b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_text() {
        let sample = "Hello world! This is a test paragraph designed to verify that text chunking works properly with overlap.";
        let chunks = chunk_text(sample, 30, 5);
        assert!(!chunks.is_empty());
    }

    #[test]
    fn test_cosine_similarity() {
        let v1 = vec![1.0, 0.0, 0.0];
        let v2 = vec![1.0, 0.0, 0.0];
        let v3 = vec![0.0, 1.0, 0.0];

        assert!((cosine_similarity(&v1, &v2) - 1.0).abs() < 1e-5);
        assert!((cosine_similarity(&v1, &v3) - 0.0).abs() < 1e-5);
    }
}
