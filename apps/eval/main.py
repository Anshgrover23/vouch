from fastapi import FastAPI
from pydantic import BaseModel
import os

app = FastAPI(title="Proofsheet eval sidecar")


class EvalRequest(BaseModel):
    documentId: str
    source: str


@app.get("/health")
def health():
    return {"ok": True, "gpu": bool(os.environ.get("CUDA_VISIBLE_DEVICES"))}


@app.post("/eval")
def evaluate(body: EvalRequest):
    """Optional HuggingFace second-opinion. Skips cleanly without a GPU."""
    if not os.environ.get("HF_TOKEN") and not os.environ.get("CUDA_VISIBLE_DEVICES"):
        return {
            "status": "skipped",
            "reason": "no GPU / HuggingFace token — Interfaze OCR is the source of truth",
            "documentId": body.documentId,
        }
    return {"status": "skipped", "reason": "transformers pass not configured", "documentId": body.documentId}
