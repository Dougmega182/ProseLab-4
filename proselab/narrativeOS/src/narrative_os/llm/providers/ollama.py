"""Ollama provider."""

from __future__ import annotations
import requests
import json
from .base import (
    LLMCall,
    LLMProvider,
    LLMResult,
    ProviderAPIError,
)


class OllamaProvider(LLMProvider):
    name = "ollama"

    def supports_prompt_caching(self) -> bool:
        return False

    def call(self, request: LLMCall) -> LLMResult:
        payload = {
            "model": request.model_id,
            "prompt": f"{request.system}\n\n{request.user_message}",
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_output_tokens,
            }
        }
        
        if request.schema:
            payload["format"] = "json"

        try:
            resp = requests.post(
                "http://localhost:11434/api/generate",
                json=payload,
                timeout=300,
            )
            resp.raise_for_status()
            data = resp.json()
            
            text = data["response"]
            
            parsed = None
            if request.schema:
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    pass

            return LLMResult(
                text=text,
                parsed=parsed,
                model_id=request.model_id,
                usage={},
            )

        except Exception as e:
            raise ProviderAPIError(f"Ollama API call failed: {e}") from e
