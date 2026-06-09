"""
AST Mutation Safety Test Harness.

Proves that:
1. FrozenAST cannot be mutated in-place.
2. Accessors do not leak mutable references to internals.
3. Thaw/refreeze cycle preserves identity when no mutation occurs.
4. Thaw/refreeze cycle produces a NEW identity when mutation occurs.
5. Aggressive fake transformations cannot corrupt the original AST.
6. Repeated transformation chains remain stable.
"""

import json
import copy
from pathlib import Path
from narrative_os.ast_parser import FailureASTParser
from narrative_os.ast_freeze import FrozenAST, thaw, refreeze


def test_immutability_blocks_setattr():
    """Direct attribute mutation must raise."""
    parser = FailureASTParser()
    ast = parser.parse("He [walked]{#local_rewrite: ran} home.")
    frozen = FrozenAST(ast)

    try:
        frozen._hash = "tampered"
        assert False, "Should have raised AttributeError"
    except AttributeError:
        pass

    try:
        frozen.new_field = "injected"
        assert False, "Should have raised AttributeError"
    except AttributeError:
        pass

    print("[PASS] setattr blocked")


def test_immutability_blocks_delattr():
    """Direct attribute deletion must raise."""
    parser = FailureASTParser()
    ast = parser.parse("He [walked]{#local_rewrite: ran} home.")
    frozen = FrozenAST(ast)

    try:
        del frozen._hash
        assert False, "Should have raised AttributeError"
    except AttributeError:
        pass

    print("[PASS] delattr blocked")


def test_accessor_returns_deep_copy():
    """Mutating the returned structure must NOT alter the frozen internals."""
    parser = FailureASTParser()
    ast = parser.parse("He [walked]{#local_rewrite: ran} home.")
    frozen = FrozenAST(ast)

    original_hash = frozen.ast_hash

    # Get structure and mutate it aggressively
    leaked = frozen.structure
    leaked["type"] = "CORRUPTED"
    leaked["clean_text"] = "EVIL INJECTION"
    leaked["recovered_nodes"].append({"route": "INJECTED", "note": "BAD"})

    # Get nodes and mutate
    nodes = frozen.recovered_nodes
    if nodes:
        nodes[0]["route"] = "CORRUPTED_ROUTE"

    # Get dropped tokens and mutate
    tokens = frozen.dropped_tokens
    tokens.append("INJECTED_TOKEN")

    # Verify the frozen AST is completely unchanged
    assert frozen.ast_hash == original_hash, "Hash changed after accessor mutation!"
    assert frozen.ast_type != "CORRUPTED", "Type was mutated through accessor!"
    assert frozen.clean_text != "EVIL INJECTION", "Clean text was mutated through accessor!"

    print("[PASS] accessor deep copy isolation")


def test_thaw_refreeze_identity_preserved():
    """Thaw + refreeze with NO changes must produce identical hash."""
    parser = FailureASTParser()
    ast = parser.parse("He [walked]{#local_rewrite: ran} home.")
    frozen = FrozenAST(ast)

    original_hash = frozen.ast_hash

    # Thaw and refreeze without changing anything
    mutable = thaw(frozen)
    refrozen = refreeze(mutable)

    assert frozen.ast_hash == refrozen.ast_hash, (
        f"Hash changed after no-op thaw/refreeze! "
        f"Original: {frozen.ast_hash}, Refrozen: {refrozen.ast_hash}"
    )

    print("[PASS] thaw/refreeze identity preservation")


def test_thaw_refreeze_mutation_changes_hash():
    """Thaw + mutate + refreeze must produce a DIFFERENT hash."""
    parser = FailureASTParser()
    ast = parser.parse("He [walked]{#local_rewrite: ran} home.")
    frozen = FrozenAST(ast)

    original_hash = frozen.ast_hash

    # Thaw and deliberately mutate
    mutable = thaw(frozen)
    mutable["structure"]["clean_text"] = "MODIFIED TEXT"
    refrozen = refreeze(mutable)

    assert frozen.ast_hash != refrozen.ast_hash, "Hash did NOT change after mutation!"
    assert frozen.ast_hash == original_hash, "Original was corrupted by thaw/refreeze!"

    print("[PASS] thaw/refreeze mutation produces new hash")


def test_original_survives_aggressive_transformation():
    """Simulate a fake voice scorer that aggressively mutates everything."""
    parser = FailureASTParser()
    ast = parser.parse("He [walked]{#local_rewrite: ran} home.")
    frozen = FrozenAST(ast)

    original_hash = frozen.ast_hash

    # Simulate 50 aggressive transformation passes
    current = frozen
    for i in range(50):
        mutable = thaw(current)
        # Aggressive mutations
        mutable["structure"]["clean_text"] += f" PASS_{i}"
        mutable["structure"]["recovered_nodes"].append({
            "route": f"injected_{i}",
            "original_span": f"span_{i}",
            "note": f"note_{i}",
            "confidence": round(0.1 * (i % 10), 2),
        })
        mutable["structure"]["dropped_tokens"].append(f"token_{i}")
        current = refreeze(mutable)

    # The ORIGINAL must be completely untouched
    assert frozen.ast_hash == original_hash, "Original was corrupted by transformation chain!"
    assert frozen.clean_text == "He walked home.", f"Original clean_text corrupted: {frozen.clean_text}"

    # The final transformed version must be different
    assert current.ast_hash != original_hash, "50 mutations didn't change hash"

    print("[PASS] original survives 50-pass aggressive transformation chain")


def test_fuzz_corpus_freeze_stability():
    """Freeze every fuzz case and verify no hash drift across freeze/thaw/refreeze cycles."""
    corpus_path = Path(__file__).parent / "fuzz_corpus.json"
    if not corpus_path.exists():
        print("[SKIP] No fuzz corpus found.")
        return

    cases = json.loads(corpus_path.read_text(encoding="utf-8"))
    parser = FailureASTParser()

    drift_count = 0
    for i, text in enumerate(cases):
        ast = parser.parse(text)
        frozen = FrozenAST(ast)
        original_hash = frozen.ast_hash

        # Thaw and refreeze 3 times with no mutation
        current = frozen
        for _ in range(3):
            mutable = thaw(current)
            current = refreeze(mutable)

        if current.ast_hash != original_hash:
            drift_count += 1
            print(f"DRIFT on case {i}: {original_hash[:12]} -> {current.ast_hash[:12]}")

    print(f"\n--- Freeze Stability Results ---")
    print(f"Total Cases: {len(cases)}")
    print(f"Drift Count: {drift_count} (Expected: 0)")

    assert drift_count == 0, f"AST drift detected in {drift_count} cases"

    print("[PASS] fuzz corpus freeze stability (0 drift)")


if __name__ == "__main__":
    test_immutability_blocks_setattr()
    test_immutability_blocks_delattr()
    test_accessor_returns_deep_copy()
    test_thaw_refreeze_identity_preserved()
    test_thaw_refreeze_mutation_changes_hash()
    test_original_survives_aggressive_transformation()
    test_fuzz_corpus_freeze_stability()
    print("\n=== ALL MUTATION SAFETY TESTS PASSED ===")
