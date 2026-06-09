from enum import Enum, auto

class FailureType(Enum):
    """
    Mutually exclusive, sealed failure routing classifications.
    A failure MUST have a single root cause and a single recovery path.
    """
    VOICE_FAILURE = auto()
    PARSER_FAILURE = auto()
    AST_VALIDATION_FAILURE = auto()
    CONTRACT_FAILURE = auto()
    PROSE_LINT_FAILURE = auto()

class NarrativeFailure(Exception):
    """
    Base exception for mutually exclusive narrative generation failures.
    """
    def __init__(self, failure_type: FailureType, message: str, payload: dict = None):
        super().__init__(message)
        self.failure_type = failure_type
        self.payload = payload or {}
