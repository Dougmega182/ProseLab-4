import sys
from narrative_os.cli import main

def run_test():
    with open("data/prose_test/solis_apartment_brief.md", "r", encoding="utf-8") as f:
        outline = f.read()

    sys.argv = [
        "cli.py",
        "generate-scene",
        "--contract", "data/contracts/book1_contract.json",
        "--mapping", "data/contracts/s22_canon_mapping.json",
        "--retry",
        outline
    ]

    print("Executing generate-scene via Python wrapper...")
    main()

if __name__ == "__main__":
    run_test()
