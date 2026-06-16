from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from .critic import call_semantic_critic, CriticResult
from .prose_lint import lint_prose, LintResult
from .contract_lint import lint_contract, ContractLintResult
from .voice_linter import lint_voice, VoiceScoreResult

class CouncilVerdict(BaseModel):
    passed: bool
    summary: str
    action: str  # "approve", "rewrite", "reject"
    critic_reports: Dict[str, Any]

def hold_council(
    prose: str,
    chapter_num: float | int = 1,
    contract_path: Optional[Path] = None,
    use_cache: bool = True
) -> CouncilVerdict:
    """
    Orchestrates multiple critics to evaluate prose from different dimensions.
    """
    # 1. Mechanical/Heuristic
    mechanical = lint_prose(prose)
    
    # 2. Semantic/Adversarial
    semantic = call_semantic_critic(prose, use_cache=use_cache)
    
    # 3. Contract/Canon
    contract = None
    if contract_path:
        contract = lint_contract(prose, contract_path=contract_path, use_cache=use_cache)
        
    # 4. Voice/Style
    voice = lint_voice(prose, use_cache=use_cache)
    
    # Synthesis/Judge Logic
    passed = mechanical.passed and semantic.passed and (contract.passed if contract else True) and voice.passed
    
    summary_parts = []
    if not mechanical.passed: summary_parts.append("Mechanical failures detected.")
    if not semantic.passed: summary_parts.append("Semantic/Literary violations found.")
    if contract and not contract.passed: summary_parts.append("Contract/Canon breaches detected.")
    if not voice.passed: summary_parts.append("Voice/Style drift exceeding thresholds.")
    
    summary = " ".join(summary_parts) if summary_parts else "Prose approved by the Council."
    action = "approve" if passed else "rewrite"
    
    return CouncilVerdict(
        passed=passed,
        summary=summary,
        action=action,
        critic_reports={
            "mechanical": mechanical.model_dump() if hasattr(mechanical, 'model_dump') else str(mechanical),
            "semantic": semantic.model_dump(),
            "contract": contract.model_dump() if contract else None,
            "voice": voice.model_dump() if hasattr(voice, 'model_dump') else str(voice),
        }
    )
