import os
import requests
import time
import re
import sys

# Authorization: use environment variable or fallback to provided key
API_KEY = os.environ.get("GALAXY_AI_API_KEY", "gx_RApLuiaASzrgswRCS4tRSv")
BASE_URL = "https://api.galaxy.ai/api"

def get_opus_thinking(task: str) -> str:
    print("Initiating reasoning request...")

    # Call Galaxy AI direct model run endpoint
    response = requests.post(
        f"{BASE_URL}/v1/nodes/claude_sonnet_4_6/run",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        },
        json={
            "nodeType": "claude_sonnet_4_6",
            "input": {
                "prompt": task,
                "system_prompt": """
You are a thinking-only engine working on a specific project.

PROJECT: ProseLab 4 — AI Writing Engine

WHAT IT IS:
- AI-augmented writing engine, NOT a text editor
- Pipeline: WRITE → ANALYZE → CRITIQUE → REWRITE → APPROVE
- Goal: produce sharper, more specific, structurally stronger prose — consistently

ENGINE STATUS: COMPLETE AND HARDENED (do not suggest engine changes)
Benchmark results (100 samples):
- Preservation Rate (good prose): 100% — zero regressions
- Improvement Rate (mediocre prose): 97.5% — 39/40 moved to PASS
- Convergence Rate (broken logic): 100% — every chaotic input stabilized
- Avg efficiency: 25.3s per intervention, 1.26 attempts (down from 4.0 — 3.1x improvement)

KEY ENGINE ACHIEVEMENTS:
- Intervention Gate: saves 73% of good prose from unnecessary intervention
- Style-Logic Balancing: style score >0.8 lowers logic threshold
- Status: Safe, Calibrated Narrative Stabilizer — ready for deployment

CURRENT PROBLEM (the only thing that matters now):
- Engine is a hardened, decoupled black box
- App.jsx is a 700-line monolith using legacy callOpenAI() — not wired to the engine
- Frontend integration is the bottleneck
- Legacy debt must be deleted, not worked around

STACK:
- Frontend: React (Vite), App.jsx monolith (~700 lines)
- Engine: decoupled, hardened, benchmarked
- AI: Ollama → OpenAI → Critic loop (engine side, not yet wired to UI)
- Storage: localStorage (temporary)

THINKING RULES:
1. Start every response with <thinking>
2. Reason step by step about the SPECIFIC PROBLEM given to you
3. Use the project context above to ground your reasoning
4. Close with </thinking>
5. Write absolutely nothing after </thinking>
6. Never write code, solutions, answers, or conclusions — only reasoning
""",
                "reasoning": True,
                "max_tokens": 8192,
                "temperature": 0.7,
                "image_urls": []
            }
        }
    )

    if response.status_code != 200:
        print(f"API Error ({response.status_code}): {response.text}")
        sys.exit(1)

    try:
        data = response.json()
        run_id = data.get("runId")
    except Exception as e:
        print(f"Error parsing start run response: {e}")
        print(f"Raw response: {response.text}")
        sys.exit(1)

    if not run_id:
        print(f"Error: Missing runId in API response. Full response: {data}")
        sys.exit(1)

    print(f"Run started successfully (ID: {run_id})")
    print("Awaiting convergence...", end="", flush=True)

    while True:
        poll = requests.get(
            f"{BASE_URL}/v1/nodes/runs/{run_id}",
            headers={"Authorization": f"Bearer {API_KEY}"}
        )

        if poll.status_code != 200:
            # Silently retry on transient poll errors
            time.sleep(5)
            continue

        try:
            data = poll.json()
        except Exception as e:
            time.sleep(5)
            continue

        status = data.get("status")

        if status == "COMPLETED":
            print(" [DONE]\n")
            out = data.get("output", {})
            
            # Robust extraction of the result text
            raw = None
            if isinstance(out, dict):
                if "output" in out: # Direct model run output key
                    raw = out["output"]
                elif "result" in out:
                    raw = out["result"][0] if isinstance(out["result"], list) else out["result"]
                elif "text" in out:
                    raw = out["text"]
                elif "response" in out:
                    raw = out["response"]
                elif "message" in out:
                    raw = out["message"]
            
            if raw is None:
                print(f"[DEBUG] Unexpected output structure from Galaxy AI: {out}")
                sys.exit(1)
            
            # Extract thinking block if present, otherwise return raw
            match = re.search(r"<thinking>(.*?)</thinking>", str(raw), re.DOTALL)
            return match.group(1).strip() if match else str(raw)

        elif status == "FAILED":
            print("\n")
            err_msg = data.get('error', 'Unknown error')
            raise Exception(f"Run failed: {err_msg}")

        print(".", end="", flush=True)
        time.sleep(5)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        task = sys.argv[1]
    else:
        task = "\nExample questions for ProseLab:"
    
    try:
        thinking = get_opus_thinking(task)
        print("=== Opus Thinking ===")
        print(thinking)
    except Exception as e:
        print(f"\nExecution Error: {e}")
