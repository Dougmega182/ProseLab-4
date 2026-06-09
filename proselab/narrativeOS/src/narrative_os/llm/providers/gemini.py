import os
import json
import requests
from .base import (
    LLMCall,
    LLMProvider,
    LLMResult,
    ProviderAPIError,
    ProviderNotConfigured,
)


class GeminiProvider(LLMProvider):
    name = "google"

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_KEY") or os.environ.get("VITE_GEMINI_KEY")

    def supports_prompt_caching(self) -> bool:
        return False

    def call(self, request: LLMCall) -> LLMResult:
        if not self.api_key:
            raise ProviderNotConfigured(
                "GeminiProvider needs GEMINI_KEY or VITE_GEMINI_KEY in environment."
            )

        model = request.model_id
        # Map logical names if necessary
        if model == "gemini-3-pro":
            model = "gemini-3.5-flash"
        elif model == "gemini-3-flash":
            model = "gemini-3.5-flash"


        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}

        # Combine cached blocks and user message into parts
        prompt_parts = []
        for block in request.cached_blocks:
            prompt_parts.append({"text": block})
        prompt_parts.append({"text": request.user_message})

        contents = [{
            "role": "user",
            "parts": prompt_parts
        }]

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature,
                "maxOutputTokens": request.max_output_tokens,
            }
        }

        if request.system:
            payload["systemInstruction"] = {
                "parts": [{"text": request.system}]
            }

        if request.schema is not None:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        import time
        max_retries = 3
        resp = None
        data = None
        for attempt in range(1, max_retries + 1):
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=90)
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as e:
                if attempt == max_retries:
                    raise ProviderAPIError(f"Gemini API call failed after {max_retries} attempts: {e}") from e
                time.sleep(2.0 * attempt)


        try:
            candidates = data.get("candidates", [])
            if not candidates:
                raise ProviderAPIError(f"No candidates returned from Gemini: {data}")
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts).strip()
        except Exception as e:
            raise ProviderAPIError(f"Failed to parse Gemini response: {e}. Response: {data}") from e

        parsed = None
        if request.schema is not None:
            # Use same JSON parsing helper
            parsed = self._try_parse_json(text)

        return LLMResult(
            text=text,
            parsed=parsed,
            model_id=request.model_id,
            usage={},
            cache_hit=False,
            raw_response=data,
        )

    def _try_parse_json(self, text: str) -> any:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        start = cleaned.find("{")
        if start == -1:
            return None
        depth = 0
        for i in range(start, len(cleaned)):
            c = cleaned[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(cleaned[start : i + 1])
                    except json.JSONDecodeError:
                        return None
        return None

