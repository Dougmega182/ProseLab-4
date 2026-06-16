import sys
import json
import time
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from narrative_os.prose_generator import generate_candidates

def run_trace():
    scene = "Kain returns to the Black Pearl bar three months after Ch 1. Emily is not there. He notices something specific about the space that wasn't there before. The scene runs approximately 200 words."
    print("Generating 10 candidates...")
    start = time.time()
    
    # Generate 10 candidates
    cands = generate_candidates(scene, n=10)
    
    elapsed = time.time() - start
    print(f"Generated 10 candidates in {elapsed:.2f}s")
    
    # Format into markdown
    md_content = f"# Trace Inspection (10 Candidates)\n\n"
    md_content += f"**Scene Outline:** {scene}\n\n"
    
    for i, c in enumerate(cands):
        md_content += f"## Candidate {i+1}\n\n"
        md_content += f"### Prose\n"
        md_content += f"{c['prose']}\n\n"
        md_content += f"### Thinking\n"
        md_content += f"{c['thinking']}\n\n"
        md_content += "---\n\n"
        
    out_path = Path("D:/Users/DalePsaila/.gemini/antigravity/brain/3430173f-1ff9-4a72-b985-414edf595ca9/trace_10_candidates.md")
    out_path.write_text(md_content, encoding="utf-8")
    print(f"Wrote artifact to {out_path}")

if __name__ == "__main__":
    run_trace()
