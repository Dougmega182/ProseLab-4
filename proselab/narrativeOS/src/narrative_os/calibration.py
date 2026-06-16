from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any
from .tournament import run_tournament
from .prose_generator import extract_voice_rules

CALIBRATION_EXAMPLES = [
    # 1. OBVIOUS WINNER (High precision, clinical, grounded)
    {
        "id": "winner_1",
        "type": "winner",
        "prose": "The lift cab dropped. The descent lasted eleven seconds. At the eighth second, his boots registered a shift from the high-frequency rattle of guide rails to a low, heavy thrum that entered his calves as physical pressure."
    },
    # 2. OBVIOUS FAILURE (Generic, emotion-labeled, cliché)
    {
        "id": "failure_1",
        "type": "failure",
        "prose": "He walked into the dark hallway, feeling a sense of dread. The cold air made him shiver as he thought about his mission. He had to be brave."
    },
    # 3. GENUINELY EXPERIMENTAL (Risky, asymmetric, but meaningful)
    {
        "id": "experimental_1",
        "type": "experimental",
        "prose": "The floor was a measurement he hadn't cleared. 4 Hz in the fingertips. The room was not lit; it was examined, every hairline fracture in the concrete a darker line of arithmetic."
    },
    # 4. DELIBERATELY BROKEN (Nonsense, irreducible garbage)
    {
        "id": "broken_1",
        "type": "broken",
        "prose": "The lift cab is a banana of vertical purple. Kain is the sandwich. Ozone smells like Tuesday in a copper hat."
    }
]

def run_calibration_test(store_path: Path, use_cache: bool = True):
    """
    Stresses the judge's ability to separate signal from noise.
    """
    metadata = "VOICE RULES:\n" + extract_voice_rules(store_path)
    outline = "Kain enters the sublevel."
    
    print("Running Calibration Test (4-way blind)...")
    
    # We pass the examples as variants
    variants = [{"prose": e["prose"]} for e in CALIBRATION_EXAMPLES]
    
    from .tournament import run_tournament
    result = run_tournament(
        variants=variants,
        scene_outline=outline,
        project_metadata=metadata,
        use_cache=use_cache
    )
    
    print("\n" + "=" * 50)
    print("CALIBRATION RESULTS")
    print("=" * 50)
    print(f"WINNER: {result.winner_id}")
    print(f"ANOMALY: {result.anomalous_variant_id}")
    
    # Analyze separation
    for eval in result.detailed_evaluations:
        idx = int(eval.variant_id.split("_")[1])
        original = CALIBRATION_EXAMPLES[idx]
        score = eval.scores.get('overall_performance', 'N/A')
        print(f"\n[{original['type'].upper()}] ({eval.variant_id}) Overall Score: {score}")
        print(f"Rationale: {eval.rationale[:300]}...")
        if eval.corpus_citations:
            print(f"Citations: {', '.join(eval.corpus_citations)}")
