import json
from typing import Dict, Any, List
from .ast_normalizer import normalize_ast

class FailureASTParser:
    """
    A structural parser that treats failure as a first-class AST artifact.
    Uses a robust stack-based token scanner to survive adversarial markup (fuzzing).
    """
    
    def __init__(self, recovery_preference: str = "SPAN_REPAIR_INNER_PRIORITY"):
        self.recovery_preference = recovery_preference
        self.valid_routes = {"local_rewrite", "canon_correction", "prompt_tuning"}

    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parses text into a Partial Parse AST with confidence scores and dropped tokens.
        Survives all malformed inputs by degrading gracefully.
        """
        try:
            raw_ast = self._parse_internal(text)
            return normalize_ast(raw_ast)
        except Exception as e:
            # If the parser itself crashes, it's a fatal flaw in the parser design.
            # We wrap it in a CATASTROPHIC_FAILURE AST instead of raising.
            return {
                "type": "CATASTROPHIC_FAILURE",
                "clean_text": text,
                "recovered_nodes": [],
                "dropped_tokens": [],
                "recovery_strategy": f"FATAL_EXCEPTION: {str(e)}"
            }

    def _parse_internal(self, text: str) -> Dict[str, Any]:
        clean_text_parts = []
        recovered_nodes = []
        dropped_tokens = []
        
        i = 0
        n = len(text)
        
        # We will track active spans. If we see a `{#` we resolve the most recent unclosed span.
        # If we see `[` we push to stack. If we see `]`, we mark the top span as closed.
        
        class SpanContext:
            def __init__(self, start_idx: int):
                self.start_idx = start_idx
                self.end_idx = -1
                self.content = ""
                self.closed = False

        stack: List[SpanContext] = []
        last_clean_idx = 0
        
        while i < n:
            # Lookahead for route marker
            if text[i:i+2] == "{#":
                # Find the end of the route block
                end_route = text.find("}", i)
                if end_route == -1:
                    # Unclosed route block. Drop the broken token and continue.
                    dropped_tokens.append("{#")
                    clean_text_parts.append(text[last_clean_idx:i])
                    i += 2
                    last_clean_idx = i
                    continue
                
                # Extract route block
                route_block = text[i+2:end_route]
                parts = route_block.split(":", 1)
                
                if len(parts) == 2:
                    route, note = parts[0].strip(), parts[1].strip()
                else:
                    # Malformed route.
                    route, note = "UNKNOWN", route_block.strip()
                
                # We have a valid-ish route. Apply it to the top of the stack if it exists.
                if stack:
                    # Pop the most recent span
                    target_span = stack.pop()
                    if target_span.closed:
                        # Well-formed span
                        span_text = target_span.content
                        confidence = 1.0
                        strategy = "WELL_FORMED"
                    else:
                        # Unclosed span, recovery required
                        span_text = target_span.content + text[last_clean_idx:i]
                        confidence = 0.5
                        strategy = "RECOVERED_UNCLOSED_SPAN"
                    
                    recovered_nodes.append({
                        "route": route if route in self.valid_routes else "UNKNOWN",
                        "original_span": span_text,
                        "note": note,
                        "confidence": confidence
                    })
                    if route not in self.valid_routes:
                        dropped_tokens.append(f"{{#{route_block}}}")
                else:
                    # Freestanding note
                    recovered_nodes.append({
                        "route": route if route in self.valid_routes else "UNKNOWN",
                        "original_span": None,
                        "note": note,
                        "confidence": 0.8
                    })
                
                # Append clean text up to the start of the `{#`
                clean_text_parts.append(text[last_clean_idx:i])
                
                i = end_route + 1
                last_clean_idx = i
                continue
                
            elif text[i] == "[":
                # Open a new span
                clean_text_parts.append(text[last_clean_idx:i])
                span = SpanContext(i)
                stack.append(span)
                i += 1
                last_clean_idx = i
                
            elif text[i] == "]":
                if stack:
                    # Close the topmost unclosed span
                    top_span = stack[-1]
                    if not top_span.closed:
                        top_span.content += text[last_clean_idx:i]
                        top_span.closed = True
                        top_span.end_idx = i
                        
                        clean_text_parts.append(text[last_clean_idx:i])
                        i += 1
                        last_clean_idx = i
                    else:
                        # Stray closing bracket
                        dropped_tokens.append("]")
                        clean_text_parts.append(text[last_clean_idx:i])
                        i += 1
                        last_clean_idx = i
                else:
                    # Stray closing bracket
                    dropped_tokens.append("]")
                    clean_text_parts.append(text[last_clean_idx:i])
                    i += 1
                    last_clean_idx = i
            else:
                i += 1

        # Append remaining
        clean_text_parts.append(text[last_clean_idx:])
        
        # If there are any unclosed spans left on the stack, they are orphaned
        for span in stack:
            dropped_tokens.append("[")
            
        clean_text = "".join(clean_text_parts)
        
        # Determine parse status
        if not dropped_tokens and all(n["confidence"] == 1.0 or n["original_span"] is None for n in recovered_nodes) and all(n["route"] != "UNKNOWN" for n in recovered_nodes):
            ast_type = "PARSE_SUCCESS"
            final_strategy = "NONE"
        else:
            ast_type = "PARTIAL_PARSE"
            if "UNKNOWN" in [n["route"] for n in recovered_nodes]:
                final_strategy = "PRESERVE_UNKNOWN_ROUTE"
            elif stack:
                final_strategy = "ORPHANED_BRACKETS_DROPPED"
            else:
                final_strategy = "PROBABILISTIC_RECOVERY"

        return {
            "type": ast_type,
            "clean_text": clean_text,
            "recovered_nodes": recovered_nodes,
            "dropped_tokens": dropped_tokens,
            "recovery_strategy": final_strategy
        }
