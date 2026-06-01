"""
Galaxy Workflow Provider - Asynchronous polling interface.
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv("E:/Ai/ProseLabV2/proselab/.env")

from .base import (
    LLMCall,
    LLMProvider,
    LLMResult,
    ProviderAPIError,
    ProviderNotConfigured,
)

DEFAULT_GALAXY_BASE_URL = "https://api.magica.com/api/v1/runs"


class GalaxyProvider(LLMProvider):
    name = "galaxy"

    def __init__(self):
        self.api_key = os.environ.get("VITE_GALAXY_AI_API_KEY")
        self.workflow_id = os.environ.get("VITE_GALAXY_WORKFLOW_ID", "cmonfiheh0000kz04dpoe8cjz")
        self.node_id = os.environ.get("VITE_GALAXY_NODE_ID", "node_1777671164161_request")
        self.base_url = DEFAULT_GALAXY_BASE_URL

    def supports_prompt_caching(self) -> bool:
        return False

    def call(self, request: LLMCall) -> LLMResult:
        if not self.api_key or not self.workflow_id or not self.node_id:
            raise ProviderNotConfigured(
                "GalaxyProvider needs VITE_GALAXY_AI_API_KEY, VITE_GALAXY_WORKFLOW_ID, and VITE_GALAXY_NODE_ID."
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Combine system, cached_blocks, and user_message into one payload
        parts = [request.system]
        parts.extend(request.cached_blocks)
        parts.append(request.user_message)
        prompt = "\n\n".join(parts)

        # Add schema if provided
        if request.schema is not None:
            schema_str = json.dumps(request.schema, indent=2)
            prompt += f"\n\nReturn ONLY a JSON object matching this schema. No prose, no markdown fences:\n```json\n{schema_str}\n```"

        payload = {
            "workflowId": self.workflow_id,
            "values": {
                self.node_id: {
                    "text_field": prompt
                }
            }
        }

        # Start run with retry handling for connection / timeout exceptions
        max_start_retries = 3
        start_data = None
        for attempt in range(1, max_start_retries + 1):
            try:
                start_resp = requests.post(self.base_url, headers=headers, json=payload, timeout=90)
                start_resp.raise_for_status()
                start_data = start_resp.json()
                break
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                if attempt == max_start_retries:
                    raise ProviderAPIError(f"Galaxy start run failed after {max_start_retries} attempts: {e}") from e
                time.sleep(2.0 * attempt)
            except Exception as e:
                raise ProviderAPIError(f"Galaxy start run failed: {e}") from e

        run_id = start_data.get("runId")
        if not run_id:
            raise ProviderAPIError(f"No runId returned from Galaxy: {start_data}")

        # Polling
        deadline = time.time() + 300 # 5 min timeout
        final_data = None
        while time.time() < deadline:
            poll_url = f"{self.base_url}/{run_id}?inDetails=true"
            try:
                poll_resp = requests.get(poll_url, headers=headers, timeout=60)
                poll_resp.raise_for_status()
                final_data = poll_resp.json()
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                time.sleep(5.0)
                continue
            except Exception as e:
                raise ProviderAPIError(f"Galaxy polling failed: {e}") from e

            status = final_data.get("status")
            if status == "COMPLETED":
                break
            elif status in ("FAILED", "CANCELED"):
                raise ProviderAPIError(f"Galaxy run ended in {status}: {final_data}")

            time.sleep(2.0)
        else:
            raise ProviderAPIError("Galaxy run timed out after 300s")

        # Extract output
        outputs = []
        node_runs = final_data.get("nodeRuns", [])
        response_nodes = [n for n in node_runs if n.get("nodeType") == "response"]
        nodes_to_parse = response_nodes if response_nodes else node_runs

        for node in nodes_to_parse:
            if node.get("nodeType") == "request":
                continue
            out = node.get("output")
            if not out:
                continue
            if isinstance(out, dict):
                found = False
                for k in ["output", "text", "content", "response", "result"]:
                    if k in out and isinstance(out[k], str) and out[k].strip():
                        outputs.append(out[k])
                        found = True
                        break
                if not found:
                    for v in out.values():
                        if isinstance(v, str) and v.strip():
                            outputs.append(v)
                            break
            elif isinstance(out, str):
                outputs.append(out)

        text = "\n".join(outputs).strip()
        
        parsed = _try_parse_json(text) if request.schema is not None else None

        return LLMResult(
            text=text,
            parsed=parsed,
            model_id=request.model_id,
            usage={},
            cache_hit=False,
            raw_response=final_data,
        )

def _try_parse_json(text: str) -> Optional[Any]:
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
