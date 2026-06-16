"""OpenAI provider."""

from __future__ import annotations
import os
import requests
from .base import (
    LLMCall,
    LLMProvider,
    LLMResult,
    ProviderAPIError,
    ProviderNotConfigured,
)


class OpenAIProvider(LLMProvider):
    name = "openai"

    def supports_prompt_caching(self) -> bool:
        return True

    def call(self, request: LLMCall) -> LLMResult:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ProviderNotConfigured("OPENAI_API_KEY not set.")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": request.model_id,
            "messages": [
                {"role": "system", "content": request.system},
                {"role": "user", "content": request.user_message},
            ],
            "max_tokens": request.max_output_tokens,
            "temperature": request.temperature,
        }
        
        if request.schema:
            payload["response_format"] = {"type": "json_object"}
            # Ensure the user message mentions JSON if using response_format
            if "json" not in request.user_message.lower():
                payload["messages"][-1]["content"] += "\nReturn your response as a JSON object."

        try:
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            
            text = data["choices"][0]["message"]["content"]
            
            # Simple usage extraction
            usage = {
                "prompt_tokens": data["usage"]["prompt_tokens"],
                "completion_tokens": data["usage"]["completion_tokens"],
                "total_tokens": data["usage"]["total_tokens"],
            }
            
            parsed = None
            if request.schema:
                import json
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    pass

            return LLMResult(
                text=text,
                parsed=parsed,
                usage=usage,
                model_id=request.model_id,
            )

        except Exception as e:
            raise ProviderAPIError(f"OpenAI API call failed: {e}") from e
