import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
from .llm.router import llm_call

class VoiceRubric(BaseModel):
    version: str
    lexical_density: float
    rhythm_delta: float
    sentence_variance: float
    forbidden_drift: float

VOICE_RUBRIC_V1 = VoiceRubric(
    version="v1",
    lexical_density=0.85,
    rhythm_delta=0.80,
    sentence_variance=0.85,
    forbidden_drift=0.95
)

# Active rubric is frozen. Change this to bump versions.
ACTIVE_VOICE_RUBRIC = VOICE_RUBRIC_V1

class VoiceScoreResult(BaseModel):
    # Enforce Pydantic immutability
    class Config:
        frozen = True

    lexical_density: float
    rhythm_delta: float
    sentence_variance: float
    forbidden_drift: float

    passed: bool
    failed_metrics: List[str]

    score_version: str
    voice_version: str
    voice_hash: str
    rationale: str

class VoiceConsistencyError(Exception):
    pass

class VoiceCriticPayload(BaseModel):
    lexical_density: float = Field(ge=0, le=1.0)
    rhythm_delta: float = Field(ge=0, le=1.0)
    sentence_variance: float = Field(ge=0, le=1.0)
    forbidden_drift: float = Field(ge=0, le=1.0)
    rationale: str

DEFAULT_VOICE_REF = Path(__file__).parent.parent.parent / "data" / "voice_reference_v1.txt"

def resolve_voice_reference_path(path: Path | str | None = None) -> Path:
    if path:
        return Path(path)
    from .project import get_project
    try:
        # If the project has its own voice reference, use it
        proj_ref = get_project().data / "voice_reference_v1.txt"
        if proj_ref.exists():
            return proj_ref
    except RuntimeError:
        pass
    return DEFAULT_VOICE_REF

def lint_voice(prose: str, reference_path: str | None = None, use_cache: bool = True) -> VoiceScoreResult:
    """
    Evaluates generated prose against a known voice baseline using strict, immutable sub-metrics.
    Returns a VoiceScoreResult. Any sub-metric falling below ACTIVE_VOICE_RUBRIC triggers a hard failure.
    """
    ref_file = resolve_voice_reference_path(reference_path)
    meta_file = ref_file.with_suffix('.meta.json')
    
    if not ref_file.exists():
        return VoiceScoreResult(
                lexical_density=1.0,
                rhythm_delta=1.0,
                sentence_variance=1.0,
                forbidden_drift=1.0,
                passed=True,
                failed_metrics=[],
                score_version=ACTIVE_VOICE_RUBRIC.version,
                voice_version="unknown",
                voice_hash="unknown",
                rationale="No voice reference found. Bypassing."
            )
            
    reference_text = ref_file.read_text(encoding="utf-8")
    voice_version = "v1"
    voice_hash = "unknown"
    if meta_file.exists():
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            voice_version = meta.get("voice_version", "v1")
            voice_hash = meta.get("sha256", "unknown")
        except Exception:
            pass
    
    system = (
        "You are a strict voice and stylistic consistency critic for the novel 'Quantum Shadows'.\n"
        "You will be provided with a Canonical Voice Reference, and a Generated Scene.\n"
        "Score the Generated Scene from 0.0 to 1.0 on four specific metrics:\n"
        "1. lexical_density: Similarity in vocabulary richness and density.\n"
        "2. rhythm_delta: Closeness of the syntactic rhythm (punctuation beats).\n"
        "3. sentence_variance: Match in the band of sentence lengths.\n"
        "4. forbidden_drift: 1.0 means no modern slang, colloquialisms or out-of-character phrases. Lower scores mean forbidden drift detected.\n"
        "Output your findings in JSON format according to the schema."
    )
    
    user = (
        "CANONICAL VOICE REFERENCE:\n"
        f"\"\"\"{reference_text[:8000]}\"\"\"\n\n"
        "GENERATED SCENE TO EVALUATE:\n"
        f"\"\"\"{prose}\"\"\"\n\n"
        "Analyze the generated scene and provide the sub-metric scores and your rationale."
    )
    
    res = llm_call(
        role="voice_critic",
        system=system,
        user_message=user,
        use_cache=use_cache,
        schema=VoiceCriticPayload.model_json_schema()
    )
    
    try:
        data = json.loads(res.text)
        lexical_density = float(data.get("lexical_density", 0.0))
        rhythm_delta = float(data.get("rhythm_delta", 0.0))
        sentence_variance = float(data.get("sentence_variance", 0.0))
        forbidden_drift = float(data.get("forbidden_drift", 0.0))
        rationale = data.get("rationale", "")
    except Exception as e:
        lexical_density = 0.0
        rhythm_delta = 0.0
        sentence_variance = 0.0
        forbidden_drift = 0.0
        rationale = f"Failed to parse LLM voice critic response: {str(e)}"
        
    # Strict Sub-metric enforcement
    failed_metrics = []
    if lexical_density < ACTIVE_VOICE_RUBRIC.lexical_density:
        failed_metrics.append("lexical_density")
    if rhythm_delta < ACTIVE_VOICE_RUBRIC.rhythm_delta:
        failed_metrics.append("rhythm_delta")
    if sentence_variance < ACTIVE_VOICE_RUBRIC.sentence_variance:
        failed_metrics.append("sentence_variance")
    if forbidden_drift < ACTIVE_VOICE_RUBRIC.forbidden_drift:
        failed_metrics.append("forbidden_drift")
        
    passed = len(failed_metrics) == 0
    
    return VoiceScoreResult(
        lexical_density=lexical_density,
        rhythm_delta=rhythm_delta,
        sentence_variance=sentence_variance,
        forbidden_drift=forbidden_drift,
        passed=passed,
        failed_metrics=failed_metrics,
        score_version=ACTIVE_VOICE_RUBRIC.version,
        voice_version=voice_version,
        voice_hash=voice_hash,
        rationale=rationale
    )
