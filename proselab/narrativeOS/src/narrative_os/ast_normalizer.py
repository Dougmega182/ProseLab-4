import json
import hashlib
from typing import Dict, Any

def normalize_ast(raw_ast: Dict[str, Any]) -> Dict[str, Any]:
    """
    Takes a raw parser AST output and canonicalizes it into a stable semantic identity.
    Produces a stable ast_hash that serves as a determinism lock.
    """
    
    # 1. Round confidence scores to prevent float drift
    normalized_nodes = []
    for node in raw_ast.get("recovered_nodes", []):
        norm_node = {
            "route": node.get("route", ""),
            "original_span": node.get("original_span"),
            "note": node.get("note", ""),
            "confidence": round(float(node.get("confidence", 0.0)), 2)
        }
        normalized_nodes.append(norm_node)
        
    # 2. Sort nodes to remove recovery sequence bias
    # Sort by route, then note, then original_span
    normalized_nodes.sort(key=lambda n: (n["route"], n["note"], n["original_span"] or ""))
    
    # 3. Sort dropped tokens to remove parsing trace bias
    dropped_tokens = sorted(raw_ast.get("dropped_tokens", []))
    
    # 4. Construct normalized structure with strict keys
    structure = {
        "type": raw_ast.get("type", "UNKNOWN"),
        "clean_text": raw_ast.get("clean_text", ""),
        "recovery_strategy": raw_ast.get("recovery_strategy", "NONE"),
        "recovered_nodes": normalized_nodes,
        "dropped_tokens": dropped_tokens
    }
    
    # 5. Serialize canonically to ensure identical hashing across runtimes
    # Separators specified to eliminate whitespace differences
    canonical_json = json.dumps(structure, sort_keys=True, separators=(',', ':'))
    
    # 6. Generate hash
    ast_hash = hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
    
    return {
        "ast_hash": ast_hash,
        "structure": structure
    }
