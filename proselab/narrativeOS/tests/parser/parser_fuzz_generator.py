import random
import string

def random_string(min_len=3, max_len=15):
    return ''.join(random.choices(string.ascii_letters + " ", k=random.randint(min_len, max_len)))

def generate_fuzz_cases(num_cases=1000):
    cases = []
    
    routes = ["local_rewrite", "canon_correction", "prompt_tuning", "unknown_bad", ""]
    
    for _ in range(num_cases):
        # Start with base clean text
        text = random_string(10, 50)
        
        # Decide fuzzing strategies for this string
        depth = random.choice([0, 1, 2, 3])
        
        if depth == 0:
            # Just clean text or a pure freestanding note
            if random.random() > 0.5:
                text += f" {{#{random.choice(routes)}: {random_string()}}}"
            cases.append(text)
            continue
            
        # Build nested/corrupted spans
        span_text = text
        for d in range(depth):
            route = random.choice(routes)
            note = random_string()
            
            # 20% chance to drop opening bracket
            open_b = "[" if random.random() > 0.2 else ""
            # 20% chance to drop closing bracket
            close_b = "]" if random.random() > 0.2 else ""
            
            # 20% chance to drop route block entirely
            if random.random() > 0.2:
                # 10% chance to malform route start
                route_start = "{#" if random.random() > 0.1 else "{"
                # 10% chance to drop colon
                colon = ":" if random.random() > 0.1 else ""
                # 10% chance to malform route end
                route_end = "}" if random.random() > 0.1 else ""
                
                route_block = f"{route_start}{route}{colon} {note}{route_end}"
            else:
                route_block = ""
                
            # Embed into previous text
            insert_pos = random.randint(0, len(span_text))
            
            # Sometimes insert garbage between bracket and route
            garbage = random_string(1, 5) if random.random() > 0.8 else ""
            
            span_text = span_text[:insert_pos] + f"{open_b}{random_string()}{span_text[insert_pos:]}{close_b}{garbage}{route_block}"
            
        cases.append(span_text)
        
    return cases

if __name__ == "__main__":
    import json
    from pathlib import Path
    cases = generate_fuzz_cases(1000)
    out_path = Path(__file__).parent / "fuzz_corpus.json"
    out_path.write_text(json.dumps(cases, indent=2), encoding="utf-8")
    print(f"Generated 1000 fuzz cases at {out_path.name}")
