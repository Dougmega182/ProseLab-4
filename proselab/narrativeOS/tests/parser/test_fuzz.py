import json
from pathlib import Path
from narrative_os.ast_parser import FailureASTParser

def test_adversarial_fuzzing_determinism():
    corpus_path = Path(__file__).parent / "fuzz_corpus.json"
    if not corpus_path.exists():
        print("No fuzz corpus found. Run parser_fuzz_generator.py first.")
        return
        
    cases = json.loads(corpus_path.read_text(encoding="utf-8"))
    parser = FailureASTParser()
    
    total = len(cases)
    
    # Store hashes from the first run to compare against subsequent runs
    baseline_hashes = []
    
    print("--- Running Fuzz Pass 1 (Baseline) ---")
    crashes = 0
    catastrophic = 0
    for i, text in enumerate(cases):
        try:
            ast = parser.parse(text)
            assert "ast_hash" in ast, f"Missing ast_hash on case {i}"
            assert "structure" in ast, f"Missing structure on case {i}"
            
            baseline_hashes.append(ast["ast_hash"])
            if ast["structure"]["type"] == "CATASTROPHIC_FAILURE":
                catastrophic += 1
        except Exception as e:
            crashes += 1
            
    assert crashes == 0, "Parser crashed during baseline run"
    assert catastrophic == 0, "Catastrophic failure during baseline run"
    assert len(baseline_hashes) == total, "Baseline run failed to generate hashes for all inputs"
    
    print(f"Generated {total} deterministic hashes.")
    
    # Run 9 more passes to prove exact determinism
    runs = 10
    variance_count = 0
    
    for r in range(2, runs + 1):
        for i, text in enumerate(cases):
            ast = parser.parse(text)
            if ast["ast_hash"] != baseline_hashes[i]:
                variance_count += 1
                print(f"VARIANCE DETECTED on Run {r}, Case {i}")
                print(f"Baseline Hash: {baseline_hashes[i]}")
                print(f"Current Hash:  {ast['ast_hash']}")
                
    print(f"\n--- Determinism Results ---")
    print(f"Total Runs: {runs}")
    print(f"Total Parses: {runs * total}")
    print(f"Variance Count: {variance_count} (Expected: 0)")
    
    assert variance_count == 0, f"AST non-determinism detected. {variance_count} variance events."

if __name__ == "__main__":
    test_adversarial_fuzzing_determinism()
