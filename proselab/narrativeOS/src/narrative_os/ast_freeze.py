"""
AST Freeze Layer.

Converts a normalized AST dict into a deeply immutable structure.
Any downstream transformation MUST clone via `thaw()` before mutating,
producing a new frozen AST. The original is never touched.
"""

import copy
import json
import hashlib
from typing import Any, Dict


class FrozenAST:
    """
    Immutable AST container. Internal structure cannot be mutated after creation.
    All access is read-only. Transformations must go through thaw() -> modify -> refreeze().
    """

    __slots__ = ("_hash", "_structure", "_serialized")

    def __init__(self, normalized_ast: Dict[str, Any]):
        # Deep copy on construction to sever all external references
        structure = copy.deepcopy(normalized_ast.get("structure", normalized_ast))
        ast_hash = normalized_ast.get("ast_hash")

        # Canonical serialization
        serialized = json.dumps(structure, sort_keys=True, separators=(",", ":"))

        # Recompute hash from our own copy to guarantee integrity
        computed_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        if ast_hash is not None and ast_hash != computed_hash:
            raise ValueError(
                f"AST hash mismatch on freeze. "
                f"Provided: {ast_hash}, Computed: {computed_hash}. "
                f"Structure was mutated before freezing."
            )

        object.__setattr__(self, "_hash", computed_hash)
        object.__setattr__(self, "_structure", structure)
        object.__setattr__(self, "_serialized", serialized)

    def __setattr__(self, name: str, value: Any) -> None:
        raise AttributeError("FrozenAST is immutable. Use thaw() to create a mutable copy.")

    def __delattr__(self, name: str) -> None:
        raise AttributeError("FrozenAST is immutable.")

    @property
    def ast_hash(self) -> str:
        return self._hash

    @property
    def structure(self) -> Dict[str, Any]:
        # Return a deep copy so callers cannot mutate internals
        return copy.deepcopy(self._structure)

    @property
    def clean_text(self) -> str:
        return self._structure.get("clean_text", "")

    @property
    def ast_type(self) -> str:
        return self._structure.get("type", "UNKNOWN")

    @property
    def recovered_nodes(self) -> list:
        return copy.deepcopy(self._structure.get("recovered_nodes", []))

    @property
    def dropped_tokens(self) -> list:
        return copy.deepcopy(self._structure.get("dropped_tokens", []))

    @property
    def recovery_strategy(self) -> str:
        return self._structure.get("recovery_strategy", "NONE")

    def to_dict(self) -> Dict[str, Any]:
        """Returns a full deep copy of the frozen AST as a plain dict."""
        return {"ast_hash": self._hash, "structure": copy.deepcopy(self._structure)}

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, FrozenAST):
            return NotImplemented
        return self._hash == other._hash

    def __repr__(self) -> str:
        return f"FrozenAST(hash={self._hash[:12]}..., type={self.ast_type})"


def thaw(frozen: FrozenAST) -> Dict[str, Any]:
    """
    Creates a mutable deep copy of a FrozenAST for transformation.
    The caller modifies this dict, then refreezes via FrozenAST().
    The original FrozenAST is never touched.
    """
    return frozen.to_dict()


def refreeze(mutated_dict: Dict[str, Any]) -> FrozenAST:
    """
    Takes a mutated AST dict (from thaw()) and produces a new FrozenAST.
    The hash will naturally differ if the structure changed.
    """
    from .ast_normalizer import normalize_ast

    # Re-normalize to enforce canonical ordering after mutation
    renormalized = normalize_ast(mutated_dict.get("structure", mutated_dict))
    return FrozenAST(renormalized)
