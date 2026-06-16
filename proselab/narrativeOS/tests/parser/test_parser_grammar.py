import json
from pathlib import Path
from narrative_os.ast_parser import FailureASTParser

def load_golden_cases():
    cases_file = Path(__file__).parent / "golden_cases" / "cases.json"
    return json.loads(cases_file.read_text(encoding="utf-8"))

def test_ast_failure_recovery_modes():
    cases = load_golden_cases()
    
    for case in cases:
        input_text = case["input"]
        valid_outputs = case.get("valid_outputs", [])
        
        # Test that our parser can explicitly target one of the valid recovery modes
        # by passing the mode as preference
        for expected in valid_outputs:
            mode = expected["mode"]
            expected_ast = expected["ast"]
            
            # The emitter is currently hardcoded to match these modes for Proof of Concept
            # In pyparsing, we will pass explicit fallback strategies.
            parser = FailureASTParser(recovery_preference=mode)
            result_ast = parser.parse(input_text)
            actual_structure = result_ast["structure"]
            
            # For testing the fake emitter, we expect exact matches
            # The actual pyparsing output will be matched structurally
            assert actual_structure["type"] == expected_ast["type"], f"Case {case['id']} Mode {mode} failed on type"
            assert actual_structure["clean_text"] == expected_ast["clean_text"], f"Case {case['id']} Mode {mode} failed on clean_text"
            assert actual_structure["recovery_strategy"] == expected_ast["recovery_strategy"], f"Case {case['id']} Mode {mode} failed on recovery_strategy"
            
            # Match recovered nodes
            assert len(actual_structure["recovered_nodes"]) == len(expected_ast["recovered_nodes"])
            for res_node, exp_node in zip(actual_structure["recovered_nodes"], expected_ast["recovered_nodes"]):
                assert res_node["route"] == exp_node["route"]
                assert res_node["note"] == exp_node["note"]
                
    print("All Golden AST Recovery Cases Passed.")

if __name__ == "__main__":
    test_ast_failure_recovery_modes()
