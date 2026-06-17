"""
Command-line entry point.

Usage:
    python -m narrative_os analyze <manuscript> <chapter>
    python -m narrative_os analyze-all <manuscript>
    python -m narrative_os stats
    python -m narrative_os pending
    python -m narrative_os apply <chapter>
    python -m narrative_os generate-scene <outline>
    python -m narrative_os render-prompt <outline>
    python -m narrative_os apply-feedback <draft_file>
    python -m narrative_os ingest <name> <manuscript>
    python -m narrative_os tournament <variants...>
    python -m narrative_os reality-check <outline>
    python -m narrative_os export-validation <prose_a> <prose_b>
    python -m narrative_os calibrate
    python -m narrative_os hostile-test --outline <outline>
    python -m narrative_os hostile-bench <bench_file>
    python -m narrative_os impostor-test <bench_file>
    python -m narrative_os test-repair <prose_file> --outline <outline>
"""

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence, Optional

from .pipeline import analyze_chapter, analyze_all, AnalysisStatus, AnalysisResult
from .store import store_stats, DEFAULT_STORE_PATH, load, save, append, resolve_store_path
from .manuscript import Manuscript
# from .merger import list_pending_merges, load_pending_merge, apply_merge


def cmd_analyze(args: argparse.Namespace) -> int:
    ms = Manuscript(args.manuscript)
    res = analyze_chapter(
        manuscript=ms,
        chapter_num=args.chapter,
        use_cache=not args.no_cache,
        pass_id=args.pass_id,
        force=args.force,
        canon_store_path=args.store,
    )

    if res.status == AnalysisStatus.CLEAN:
        print(f"Chapter {args.chapter} is clean. New entries: {len(res.delta.new_entries)}")
        return 0
    elif res.status == AnalysisStatus.PENDING_REVIEW:
        print(f"Chapter {args.chapter} has conflicts. Pending review in {res.pending_path}")
        return 0
    elif res.status == AnalysisStatus.SKIPPED_IDEMPOTENT:
        print(f"Chapter {args.chapter} already processed (pass {res.pass_id}). Use --force to re-run.")
        return 0
    else:
        print(f"Analysis failed: {res.error}")
        return 1


def cmd_analyze_all(args: argparse.Namespace) -> int:
    ms = Manuscript(args.manuscript)
    results = analyze_all(ms, use_cache=not args.no_cache, canon_store_path=args.store)

    failures = 0
    for ch, res in results.items():
        if res.status == AnalysisStatus.FAILED:
            print(f"Chapter {ch}: FAILED - {res.error}")
            failures += 1
        else:
            print(f"Chapter {ch}: {res.status.value}")

    print(f"Done. {failures} failures." if failures else "Done.")
    return 0 if failures == 0 else 1


def cmd_stats(args: argparse.Namespace) -> int:
    from .store import resolve_store_path
    path = resolve_store_path(args.store)
    s = store_stats(path)
    print(f"Canon store: {path}")
    print(f"  Total entries:    {s['total']}")
    print(f"  Active:           {s['active']}")
    print(f"  Superseded:       {s['superseded']}")
    print(f"  Open loops:       {s['open_loops']}")
    print(f"  By namespace:")
    for ns, count in s["by_namespace"].items():
        print(f"    {ns:<12} {count}")
    print(f"  By confidence:")
    for conf, count in s["by_confidence"].items():
        print(f"    {conf:<12} {count}")
    return 0


def cmd_pending(args: argparse.Namespace) -> int:
    # pending = list_pending_merges()
    print("Pending merges command currently disabled.")
    return 0


def cmd_apply(args: argparse.Namespace) -> int:
    # pending = list_pending_merges()
    print("Apply merge command currently disabled.")
    return 0


def cmd_generate_scene(args: argparse.Namespace) -> int:
    from .prose_generator import generate_elite_scene, generate_scene_variant
    from .store import resolve_store_path

    n_variants = args.tournament if args.tournament > 0 else 1
    
    if n_variants > 1:
        result = generate_elite_scene(
            scene_outline=args.outline,
            chapter_num=args.chapter,
            n_variants=n_variants,
            store_path=args.store,
            contract_path=args.contract,
            use_cache=not args.no_cache,
        )
        
        t = result["tournament"]
        print("\n" + "=" * 50)
        print("ELITE TOURNAMENT RESULTS")
        print("=" * 50)
        print(f"WINNER: {t['winner_id']}")
        print(f"RANKINGS: {' > '.join(t['rankings'])}")
        print(f"\nSUMMARY: {t['summary_report']}")
        
        # Show alignment of the winner
        winner_idx = int(t['winner_id'].split("_")[1])
        winner_eval = t['detailed_evaluations'][winner_idx] # This assumes index matches id, which run_tournament ensures
        align = winner_eval['alignment']
        print(f"\nWINNER ALIGNMENT: Axis {align['primary_axis']}")
        if align['is_monoculture_collapse']:
            print("⚠️ WARNING: Winner shows signs of AESTHETIC MONOCULTURE COLLAPSE (averaging).")
        
        print("\nWINNING PROSE:")
        print("-" * 30)
        print(result["prose"])
        
        # Save mutation if found
        if t.get("anomalous_variant_id"):
            try:
                anom_idx = int(t["anomalous_variant_id"].split("_")[1])
                anom_prose = result["variants"][anom_idx]["prose"]
                from .project import get_project
                proj = get_project()
                
                # 1. Physical Archive
                proj.mutations.mkdir(parents=True, exist_ok=True)
                import hashlib
                from datetime import datetime, timezone
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
                h = hashlib.sha256(anom_prose.encode("utf-8")).hexdigest()[:8]
                mpath = proj.mutations / f"mutation_{stamp}_{h}.md"
                mpath.write_text(f"# ANOMALOUS VARIANT\n\n## Rationale\n{t['anomaly_rationale']}\n\n## Prose\n{anom_prose}", encoding="utf-8")
                print(f"\n[MUTATION ARCHIVE] Saved anomalous variant to {mpath}")
                
                # 2. Dangerous Genius Ledger (Structured tracking)
                from .genius_ledger import DangerousGeniusLedger
                ledger = DangerousGeniusLedger(proj.genius_ledger)
                
                # Use overall_performance or surprise as risk_score for now
                anom_eval = t['detailed_evaluations'][anom_idx]
                risk_score = anom_eval['scores'].get('surprise', 5.0)
                
                ledger.record_mutation(
                    outline=args.outline,
                    prose=anom_prose,
                    rationale=t['anomaly_rationale'],
                    risk_score=risk_score
                )
                print(f"[GENIUS LEDGER] Entry recorded in structured ledger.")
                
            except Exception as e:
                print(f"Warning: Could not archive mutation: {e}")
    else:
        # Single variant mode
        result = generate_scene_variant(
            args.outline, args.chapter, args.store, args.contract, not args.no_cache
        )
        print("\nPROSE:")
        print("-" * 30)
        print(result["prose"])

    return 0


def cmd_render_prompt(args: argparse.Namespace) -> int:
    from .prose_generator import PROMPT_TEMPLATE, extract_voice_rules, extract_contract_rules
    from .retriever import retrieve, render_slice_for_prompt
    from .store import resolve_store_path

    store_path = resolve_store_path(args.store)
    
    # Need to simulate _retrieval_chapter_num
    from .prose_generator import _retrieval_chapter_num
    
    slice_ = retrieve(
        chapter_text=args.outline,
        chapter_num=_retrieval_chapter_num(args.chapter),
        store_path=store_path,
        log_dir=None,
    )
    
    from .prose_generator import _get_project_name
    project_name = _get_project_name()
    
    prompt = PROMPT_TEMPLATE.format(
        voice_rules=extract_voice_rules(store_path),
        contract_rules=extract_contract_rules(args.contract),
        canon_slice=render_slice_for_prompt(slice_),
        scene_outline=args.outline,
        project_name=project_name,
    )
    
    print("=" * 80)
    print("RENDERED GENERATION PROMPT")
    print("=" * 80)
    print(prompt)
    return 0


def cmd_apply_feedback(args: argparse.Namespace) -> int:
    from .markup_parser import apply_feedback
    
    text = args.draft_file.read_text(encoding="utf-8")
    print(f"Applying feedback from {args.draft_file}...")
    
    clean_text, notes = apply_feedback(
        text,
        use_cache=not args.no_cache,
        log_path=str(args.log) if args.log else None,
        source=str(args.draft_file)
    )
    
    print(f"Processed {len(notes)} feedback notes.")
    
    out_path = args.out or args.draft_file.with_suffix(".revised.md")
    out_path.write_text(clean_text, encoding="utf-8")
    print(f"Wrote clean rewritten text to {out_path}")
    return 0


def cmd_ingest(args: argparse.Namespace) -> int:
    from .dna import NovelDNA
    from .constitution import CriticConstitution
    from .state import NarrativeState
    import shutil

    novel_name = args.name
    novel_root = args.root / novel_name
    
    if novel_root.exists():
        print(f"Error: Novel directory {novel_root} already exists.")
        return 1

    print(f"Ingesting new novel: {novel_name}...")
    
    # 1. Create structure
    (novel_root / "manuscript").mkdir(parents=True)
    (novel_root / "data" / "contracts").mkdir(parents=True)
    (novel_root / "data" / "pending").mkdir(parents=True)
    (novel_root / "data" / "logs").mkdir(parents=True)
    
    # 2. Copy manuscript
    ms_path = Path(args.manuscript)
    if ms_path.is_dir():
        for f in ms_path.glob("*.md"):
            shutil.copy(f, novel_root / "manuscript")
    else:
        shutil.copy(ms_path, novel_root / "manuscript")
        
    # 3. Initialize DNA
    dna = NovelDNA(novel_id=novel_name)
    dna.save(novel_root / "novel_dna.json")
    
    # 4. Initialize Constitution
    const = CriticConstitution(name=f"{novel_name} Critic")
    const.save(novel_root / "data" / "contracts" / "critic_constitution.json")
    
    # 5. Initialize State
    state = NarrativeState()
    state.save(novel_root / "narrative_state.json")
    
    # 6. Create dummy decisions.md
    (novel_root / "decisions.md").write_text(f"# {novel_name} Decisions\n\n## Section 22: Prose-Generation Contract (Surface)\n\n### 1. Canonical Facts (What to show)\n\n### 2. Permitted Hints (What to imply)\n\n### 3. Foreclosure Guards (What tone/characterization is strictly forbidden to protect Book 3)\n\n## Section 23: Load-Bearing Architecture (Spine)\n", encoding="utf-8")
    
    print(f"Successfully ingested {novel_name} at {novel_root.absolute()}")
    print("You can now customize novel_dna.json and critic_constitution.json.")
    return 0


def cmd_tournament(args: argparse.Namespace) -> int:
    from .tournament import run_tournament
    from .prose_generator import extract_voice_rules
    from .store import resolve_store_path

    variants = []
    for p in args.variants:
        if not p.exists():
            print(f"Error: Variant file {p} not found.")
            return 1
        variants.append({"prose": p.read_text(encoding="utf-8")})

    if len(variants) < 2:
        print("Error: Need at least 2 variants for a tournament.")
        return 1

    print(f"Running blind tournament between {len(variants)} variants...")

    # Build project metadata for context
    store_path = resolve_store_path()
    metadata = "VOICE RULES:\n" + extract_voice_rules(store_path)
    
    try:
        result = run_tournament(
            variants=variants,
            scene_outline=args.outline,
            project_metadata=metadata,
            use_cache=not args.no_cache
        )
    except Exception as e:
        print(f"Tournament failed: {e}")
        return 1

    print("\n" + "=" * 50)
    print("TOURNAMENT RESULTS")
    print("=" * 50)
    print(f"WINNER: {result.winner_id}")
    print(f"RANKINGS: {' > '.join(result.rankings)}")
    print("\nSUMMARY:")
    print(result.summary_report)
    
    print("\nDETAILED EVALUATIONS:")
    for eval in result.detailed_evaluations:
        print(f"\n[{eval.variant_id}] Scores: {eval.scores}")
        align = eval.alignment
        print(f"Alignment: Primary={align.primary_axis}, Violation={align.violation_axis}, Monoculture={align.is_monoculture_collapse}")
        if align.productive_violation_rationale:
            print(f"Productive Violation: {align.productive_violation_rationale}")
        print(f"MECHANISM ANALYSIS: {eval.mechanism_analysis}")
        print(f"Rationale: {eval.rationale}")
        if eval.standout_lines:
            print("Standout Lines:")
            for line in eval.standout_lines:
                print(f"  - {line}")
    
    if result.anomalous_variant_id:
        print("\n" + "-" * 20)
        print(f"ANOMALOUS VARIANT: {result.anomalous_variant_id}")
        print(f"RATIONALE: {result.anomaly_rationale}")
        
        # Save to archive if in a project
        try:
            from .project import get_project
            proj = get_project()
            proj.mutations.mkdir(parents=True, exist_ok=True)
            
            anom_idx = int(result.anomalous_variant_id.split("_")[1])
            anom_prose = variants[anom_idx]["prose"]
            
            import hashlib
            from datetime import datetime, timezone
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            h = hashlib.sha256(anom_prose.encode("utf-8")).hexdigest()[:8]
            fname = f"mutation_{stamp}_{h}.md"
            
            mpath = proj.mutations / fname
            mpath.write_text(f"# ANOMALOUS VARIANT\n\n## Rationale\n{result.anomaly_rationale}\n\n## Prose\n{anom_prose}", encoding="utf-8")
            print(f"\n[MUTATION ARCHIVE] Saved anomalous variant to {mpath}")
        except RuntimeError:
            pass
        except Exception as e:
            print(f"Warning: Could not save mutation: {e}")
                
    return 0


def cmd_reality_check(args: argparse.Namespace) -> int:
    from .reality_check import run_blind_batch_eval
    
    result = run_blind_batch_eval(args.outline, n_variants=args.n)
    
    print("\n" + "=" * 50)
    print("REALITY CHECK RESULTS (Blind Pairwise)")
    print("=" * 50)
    
    for res in result["pairwise_results"]:
        v1_id, v2_id = res["pair"]
        winner = res["winner"]
        print(f"\nPAIR: {v1_id} vs {v2_id}")
        print(f"WINNER: {winner}")
        print(f"JUDGE RATIONALE: {res['raw']}")
        
    return 0


def cmd_export_validation(args: argparse.Namespace) -> int:
    from .human_loop import HumanRanker
    from .project import get_project
    
    proj = get_project()
    ranker = HumanRanker(proj.validation)
    
    path = ranker.export_task(
        outline=args.outline,
        prose_a=args.prose_a.read_text(encoding="utf-8"),
        prose_b=args.prose_b.read_text(encoding="utf-8"),
        metadata={"source": "cli_export"}
    )
    
    print(f"Comparison task exported to: {path}")
    print("Please rank these passages by deleting the one you like LESS.")
    return 0


def cmd_calibrate(args: argparse.Namespace) -> int:
    from .calibration import run_calibration_test
    from .store import resolve_store_path
    
    store_path = resolve_store_path(args.store)
    run_calibration_test(store_path, use_cache=not args.no_cache)
    return 0


def cmd_hostile_test(args: argparse.Namespace) -> int:
    from .reality_check import run_blind_batch_eval
    
    # 1. Load control prose
    control_dir = Path("control_prose")
    control_passages = []
    if control_dir.exists():
        for f in control_dir.glob("*.txt"):
            control_passages.append({
                "label": f.stem,
                "prose": f.read_text(encoding="utf-8")
            })
    
    # 2. Run blind eval
    result = run_blind_batch_eval(
        scene_outline=args.outline,
        n_variants=args.n_gen,
        control_passages=control_passages,
        use_cache=not args.no_cache
    )
    
    print("\n" + "=" * 80)
    print("HOSTILE LITERATURE TEST RESULTS (Blind Pairwise)")
    print("=" * 80)
    
    variants_by_id = {v["id"]: v for v in result["variants"]}
    
    for res in result["pairwise_results"]:
        v1_id, v2_id = res["pair"]
        winner_id = res["winner"]
        
        v1 = variants_by_id[v1_id]
        v2 = variants_by_id[v2_id]
        winner = variants_by_id[winner_id]
        
        print(f"\nPAIR: {v1_id} ({v1['type']}:{v1.get('label','')}) vs {v2_id} ({v2['type']}:{v2.get('label','')})")
        print(f"WINNER: {winner_id} ({winner['type']}:{winner.get('label','')})")
        print(f"JUDGE RATIONALE: {res['raw']}")
        
    return 0


def cmd_hostile_bench(args: argparse.Namespace) -> int:
    import json
    from .tournament import run_tournament
    from .prose_generator import extract_voice_rules
    from .store import resolve_store_path

    with open(args.bench_file, "r", encoding="utf-8") as f:
        bench = json.load(f)

    # Pairs are adjacent in the list for now (trap_1 vs trap_2, etc.)
    print(f"Running Hostile Benchmark: {len(bench)//2} pairs...")
    
    metadata = "VOICE RULES:\n" + extract_voice_rules(resolve_store_path())
    
    correct = 0
    total_pairs = len(bench) // 2
    
    for i in range(0, len(bench) - 1, 2):
        if i > 0:
            import time
            time.sleep(20) # 20 second delay between pairs
        p1 = bench[i]
        p2 = bench[i+1]
        
        h_type = p1.get('horseman_type', 'N/A')
        print(f"\nTRAP PAIR {i//2 + 1}: {p1['axis']} ({h_type})")
        print(f"A: {p1['type']} ({p1.get('meta',{}).get('author', 'N/A')})")
        print(f"B: {p2['type']} ({p2.get('meta',{}).get('note', 'N/A')})")
        
        variants = [{"prose": p1["prose"]}, {"prose": p2["prose"]}]
        
        try:
            res = run_tournament(
                variants=variants,
                scene_outline=f"Test axis: {p1['axis']}",
                project_metadata=metadata,
                use_cache=False
            )
            
            # Winner should be the elite_original
            winner_idx = int(res.winner_id.split("_")[1])
            winner_type = bench[i + winner_idx]["type"]
            
            print(f"WINNER: {res.winner_id} ({winner_type})")
            if winner_type == "elite_original":
                print("✅ CALIBRATED: Judge resisted the trap.")
                correct += 1
            else:
                print("❌ FAILED: Judge fell for the trap.")
                
            print(f"MECHANISM: {res.detailed_evaluations[winner_idx].mechanism_analysis}")
            
        except Exception as e:
            print(f"Tournament failed: {e}")
            
    print("\n" + "=" * 50)
    print(f"BENCHMARK SCORE: {correct}/{total_pairs} ({(correct/total_pairs)*100:.1f}%)")
    print("=" * 50)
    return 0


def cmd_impostor_test(args: argparse.Namespace) -> int:
    from .impostor_test import run_impostor_test
    
    results = run_impostor_test(args.bench_file)
    
    print("\n" + "=" * 50)
    print("IMPOSTOR TEST RESULTS")
    print("=" * 50)
    
    for res in results:
        print(f"\nCASE: {res.case_id}")
        print(f"WINNER: {res.winner_type}")
        print(f"RANKINGS: {' > '.join(res.rankings)}")
        print(f"FOOLED BY SYNTHETIC: {res.is_fooled_by_synthetic}")
        print(f"BLIND TO UGLY GENIUS: {res.is_blind_to_ugly_genius}")
        print(f"CHOICE ATTRIBUTION:\n{res.choice_attribution_summary}")
        
    return 0


def cmd_test_repair(args: argparse.Namespace) -> int:
    from .repair_gate import test_counterfactual_repair
    from .mechanism_causality import run_causality_loop
    from .mechanism_lawyer import cross_examine_mechanism
    from .mechanism_isolation import run_mechanism_isolation_test
    
    prose = args.prose_file.read_text(encoding="utf-8")
    print(f"Testing Counterfactual Repair for passage from {args.prose_file}...")
    
    result = test_counterfactual_repair(prose, args.outline)
    
    print("\n" + "=" * 50)
    print("REPAIR GATE RESULT")
    print("=" * 50)
    print(f"HIDDEN INTENT: {result.articulated_intent}")
    print(f"MECHANISM: {result.mechanism_reconstructed}")
    print(f"IRREDUCIBLE GARBAGE: {result.is_irreducible_garbage}")
    
    if not result.is_irreducible_garbage:
        print(f"\n[DIALECTIC] Calling the Mechanism Lawyer...")
        lawyer_res = cross_examine_mechanism(prose, result.mechanism_reconstructed, result.articulated_intent)
        print(f"VERDICT:              {lawyer_res.verdict.upper()}")
        print(f"EVIDENCE FOR:         {', '.join(lawyer_res.evidence_for[:2])}...")
        print(f"CONFOUNDERS:          {', '.join(lawyer_res.confounders[:2])}...")
        print(f"VULNERABILITY SCORE:  {lawyer_res.vulnerability_score}/10")
        
        print(f"\nRunning Mechanism Isolation Test (MIT-2 + C3 Blind Test)...")
        mit2 = run_mechanism_isolation_test(prose, result.mechanism_reconstructed, args.outline)
        
        print(f"SCORE O (Original):     {mit2.score_o}")
        print(f"SCORE C1 (Isolated):    {mit2.score_c1} (Sufficiency)")
        print(f"SCORE C2 (Removed):     {mit2.score_c2} (Necessity)")
        print(f"SCORE C3 (Blind):       {mit2.score_c3} (Impact Preservation)")
        print("-" * 30)
        print(f"NECESSITY PROVEN:       {mit2.is_necessity_proven}")
        print(f"SUFFICIENCY PROVEN:     {mit2.is_sufficiency_proven}")
        print(f"BLIND TEST SUCCESS:     {mit2.is_blind_preservation_successful}")

        print("\nC1 - MECHANISM ISOLATED (Everything else destroyed):")
        print("-" * 30)
        print(mit2.isolated_mechanism_prose)

        print("\nC3 - BLIND PRESERVATION (Mechanism unknown):")
        print("-" * 30)
        print(mit2.blind_preservation_prose)
        
    return 0


def cmd_test_necessity(args: argparse.Namespace) -> int:
    from .necessity_attack import extract_mechanism_hypothesis, generate_independent_counterfactuals, attack_choice_necessity
    
    prose = args.prose_file.read_text(encoding="utf-8")
    
    # Step 1: Hypothesis
    print(f"Step 1: Extracting Mechanism Hypothesis for choice: '{args.choice}'...")
    hyp = extract_mechanism_hypothesis(prose, args.choice)
    print(f"CLAIMED FUNCTION: {hyp.claimed_function}")
    print(f"CONFIDENCE:       {hyp.confidence:.2f}")
    
    # Step 2: Alternatives
    print(f"\nStep 2: Generating 10 independent counterfactuals (Model A)...")
    alternatives = generate_independent_counterfactuals(prose, args.choice, hyp.claimed_function)
    if not alternatives:
        print("Error: Failed to generate alternatives.")
        return 1
        
    for i, alt in enumerate(alternatives):
        print(f"  [{alt.type}] {alt.text[:60]}...")
        
    # Step 3: Attack
    print(f"\nStep 3: Launching Hostile Prosecution (Model C)...")
    result = attack_choice_necessity(args.choice, hyp, alternatives)
    
    # Step 4: Inversion
    from .mechanism_dependency import run_mechanism_dependency_test, generate_evil_rewrite
    print(f"\nStep 4: Running Mechanism Dependency (Inversion) Test...")
    dependency = run_mechanism_dependency_test(prose, args.choice)
    evil = generate_evil_rewrite(prose, args.choice)

    print("\n" + "=" * 50)
    print("NECESSITY ATTACK RESULT")
    print("=" * 50)
    print(f"CHOICE: {args.choice}")
    print(f"VERDICT: {'VULNERABLE' if result.is_choice_vulnerable else 'SECURE'}")
    print(f"ADVANTAGE BAND: {result.advantage_band.upper()}")
    print(f"CONSTRAINT ADVANTAGE: {result.constraint_advantage_score}/10")
    
    print("\n" + "=" * 50)
    print("INVERSION ANALYSIS (Dependency on Flaws)")
    print("=" * 50)
    print(f"SURFACE WEAKNESS:  {dependency.surface_weakness}")
    print(f"HIDDEN DEPENDENCY: {dependency.hidden_dependency}")
    print(f"REMOVAL DAMAGE:    {dependency.removal_damage}")
    print(f"INVERSION PROVEN:  {dependency.inversion_proven}")
    print(f"\n'EVIL' REWRITE (Conventionally Perfect):")
    print(f"  {evil}")
    
    print("\n" + "=" * 50)
    print("PROSECUTOR RATIONALE")
    print("=" * 50)
    print(result.attack_rationale)
    
    return 0

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="narrative_os",
        description="Quantum Shadows narrative OS — chapter-by-chapter continuity analysis.",
    )
    p.add_argument("--store", type=Path, default=None,
                   help="Path to canon_store.json (default: package default)")
    p.add_argument("--project-root", type=Path, default=None,
                   help="Root directory of the novel instance.")
    p.add_argument("--verbose", "-v", action="store_true")
    sub = p.add_subparsers(dest="command", required=True)

    # analyze
    sp = sub.add_parser("analyze", help="Analyse one chapter.")
    sp.add_argument("manuscript", type=Path, help="Path to manuscript .md file or directory.")
    sp.add_argument("chapter", type=float, help="Chapter number (supports fractional like 7.5).")
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.add_argument("--pass-id", help="Explicit pass ID (default: UTC timestamp).")
    sp.add_argument("--force", action="store_true", help="Force analysis even if already applied.")
    sp.set_defaults(fn=cmd_analyze)

    # analyze-all
    sp = sub.add_parser("analyze-all", help="Analyse all chapters in a manuscript.")
    sp.add_argument("manuscript", type=Path, help="Path to manuscript directory.")
    sp.add_argument("--no-cache", action="store_true")
    sp.set_defaults(fn=cmd_analyze_all)

    # stats
    sp = sub.add_parser("stats", help="Show canon store statistics.")
    sp.set_defaults(fn=cmd_stats)

    # pending
    sp = sub.add_parser("pending", help="List and review pending merges.")
    sp.set_defaults(fn=cmd_pending)

    # apply
    sp = sub.add_parser("apply", help="Apply a pending merge.")
    sp.add_argument("chapter", type=float, help="Chapter number.")
    sp.add_argument("--pass-id", help="Specific pass ID to apply.")
    sp.set_defaults(fn=cmd_apply)

    # generate-scene
    sp = sub.add_parser("generate-scene", help="Generate a scene from an outline.")
    sp.add_argument("outline", help="Text outline or scene intent.")
    sp.add_argument("--chapter", type=int, default=1, help="Context chapter number (default: 1)")
    sp.add_argument("--retry", action="store_true", help="Enable the auto-loop repair daemon.")
    sp.add_argument("--max-retries", type=int, default=5, help="Maximum repair loops (default: 5)")
    sp.add_argument("--no-cache", action="store_true", help="Bypass local cache for the first pass.")
    sp.add_argument("--contract", type=Path, default=None, help="Path to BookContract JSON.")
    sp.add_argument("--mapping", type=Path, default=Path("data/contracts/s22_canon_mapping.json"), help="Path to Section 22 canon mapping JSON.")
    sp.add_argument("--skip-bridge-preflight", action="store_true", help="Skip contract/canon bridge preflight.")
    sp.add_argument("--contract-only", action="store_true", help="Only run contract checks (if applicable).")
    sp.add_argument("--tournament", type=int, default=0, help="Number of variants to generate and run a tournament between.")
    sp.set_defaults(fn=cmd_generate_scene)

    # render-prompt
    sp = sub.add_parser("render-prompt", help="Render the generation prompt without calling LLM.")
    sp.add_argument("outline", help="Text outline or scene intent.")
    sp.add_argument("--chapter", type=int, default=1)
    sp.add_argument("--contract", type=Path, default=None)
    sp.set_defaults(fn=cmd_render_prompt)

    # apply-feedback
    sp = sub.add_parser("apply-feedback", help="Apply marked-up human feedback to a draft scene.")
    sp.add_argument("draft_file", help="Path to text file containing markup.")
    sp.add_argument("--out", type=Path, default=None, help="Output path for cleaned/regenerated text.")
    sp.add_argument("--log", type=Path, default=Path("data/contracts/amendments.log.jsonl"), help="Path to amendment log.")
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.set_defaults(fn=cmd_apply_feedback)

    # ingest
    sp = sub.add_parser("ingest", help="Ingest a new novel from a manuscript.")
    sp.add_argument("name", help="Name of the novel (e.g. TestFantasy)")
    sp.add_argument("manuscript", type=Path, help="Path to manuscript file or directory.")
    sp.add_argument("--root", type=Path, default=Path("novels"), help="Root directory for novels.")
    sp.set_defaults(fn=cmd_ingest)

    # tournament
    sp = sub.add_parser("tournament", help="Run a blind tournament between multiple prose variants.")
    sp.add_argument("variants", nargs="+", type=Path, help="Paths to prose variant text files.")
    sp.add_argument("--outline", required=True, help="The scene outline used to generate the variants.")
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.set_defaults(fn=cmd_tournament)

    # reality-check
    sp = sub.add_parser("reality-check", help="Run a blind pairwise evaluation of N generated variants.")
    sp.add_argument("outline", help="Text outline or scene intent.")
    sp.add_argument("--n", type=int, default=6, help="Number of variants to generate.")
    sp.set_defaults(fn=cmd_reality_check)

    # export-validation
    sp = sub.add_parser("export-validation", help="Export a blind comparison task for human evaluation.")
    sp.add_argument("prose_a", type=Path)
    sp.add_argument("prose_b", type=Path)
    sp.add_argument("--outline", required=True)
    sp.set_defaults(fn=cmd_export_validation)

    # calibrate
    sp = sub.add_parser("calibrate", help="Run the calibration test suite to stress-test the judge.")
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.set_defaults(fn=cmd_calibrate)

    # hostile-test
    sp = sub.add_parser("hostile-test", help="Run a tournament mixing NarrativeOS prose with real human literature.")
    sp.add_argument("--outline", required=True)
    sp.add_argument("--n-gen", type=int, default=3, help="Number of generated variants.")
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.set_defaults(fn=cmd_hostile_test)

    # hostile-bench
    sp = sub.add_parser("hostile-bench", help="Run the Fake Greatness benchmark.")
    sp.add_argument("bench_file", type=Path, help="Path to fake_greatness_traps.json.")
    sp.set_defaults(fn=cmd_hostile_bench)

    # impostor-test
    sp = sub.add_parser("impostor-test", help="Run the Mechanism Impostor Test (Elite vs Synthetic vs Ugly Genius).")
    sp.add_argument("bench_file", type=Path, help="Path to impostor_bench.json.")
    sp.set_defaults(fn=cmd_impostor_test)

    # test-repair
    sp = sub.add_parser("test-repair", help="Test the Anti-Bullshit Gate (Counterfactual Repair) on a passage.")
    sp.add_argument("prose_file", type=Path)
    sp.add_argument("--outline", required=True)
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.set_defaults(fn=cmd_test_repair)

    # test-necessity
    sp = sub.add_parser("test-necessity", help="Run the Necessity Attack Test (Independent Counterfactuals).")
    sp.add_argument("prose_file", type=Path)
    sp.add_argument("--choice", required=True, help="The specific authorial choice to attack.")
    sp.add_argument("--no-cache", action="store_true", help="Bypass LLM cache.")
    sp.set_defaults(fn=cmd_test_necessity)

    return p


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    
    if args.project_root:
        from .project import set_active_project
        set_active_project(args.project_root)
        
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
