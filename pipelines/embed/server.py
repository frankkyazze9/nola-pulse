"""
Dark Horse embedding server — BGE-small-en-v1.5 (384 dim).

POST /embed  { "texts": ["..."] }  →  { "embeddings": [[...], ...] }
GET  /health                       →  { "status": "ok", "model": "...", "dim": 384 }

Runs on Cloud Run with scale-to-zero. ~800 MB image, ~400 MB RAM at runtime.
"""

import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-small-en-v1.5"
model: SentenceTransformer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = SentenceTransformer(MODEL_NAME)
    yield


app = FastAPI(lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    vectors = model.encode(req.texts, normalize_embeddings=True)
    return EmbedResponse(embeddings=vectors.tolist())


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dim": 384}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
