from narrative_os.prose_lint import lint_prose

def test_hard_banned_words():
    # vibrant is banned
    result = lint_prose("The vibrant room was full of light.")
    assert not result.passed
    assert any("vibrant" in v[0] for v in result.hard_violations)

def test_hard_banned_phrases():
    # thick with is banned
    result = lint_prose("The air was thick with smoke.")
    assert not result.passed
    assert any("thick_with" in v[0] for v in result.hard_violations)

def test_hard_banned_filter_words():
    # saw, felt, heard are filter verbs and banned
    result = lint_prose("He saw the door open.")
    assert not result.passed
    assert any("filter_word" in v[0] for v in result.hard_violations)

def test_contrasts():
    # not X, but Y
    result = lint_prose("It was not fear, but curiosity.")
    assert not result.passed
    assert any("not_X_but_Y" in v[0] for v in result.hard_violations)

    # wasn't X. It was Y.
    result = lint_prose("It wasn't fear. It was curiosity.")
    assert not result.passed
    assert any("not_X_but_Y" in v[0] for v in result.hard_violations)

def test_dramatic_pause_em_dash():
    # Dramatic pause em-dash (single)
    result = lint_prose("He turned around—slowly.")
    assert not result.passed
    assert any("em_dash_dramatic" in v[0] for v in result.hard_violations)

    # Parenthetical em-dashes (pair) should be OK
    result2 = lint_prose("He turned around—although he was tired—and walked away.")
    # Should not have em_dash_dramatic violation
    assert not any("em_dash_dramatic" in v[0] for v in result2.hard_violations)

def test_rhetorical_question_immediate_answer():
    result = lint_prose("Was he afraid? Yes, he was.")
    assert not result.passed
    assert any("rhetorical_question" in v[0] for v in result.hard_violations)

def test_colon_fragment_list():
    result = lint_prose("He was the perfect spy: quiet, unassuming, deadly.")
    assert not result.passed
    assert any("colon_fragment_list" in v[0] for v in result.hard_violations)

def test_physical_crutches():
    result = lint_prose("Her heart swelled with pride.")
    assert not result.passed
    assert any("heart_emotional" in v[0] for v in result.hard_violations)

    result2 = lint_prose("He furrowed his brow.")
    assert not result2.passed
    assert any("furrowed_brow" in v[0] for v in result2.hard_violations)

def test_illegal_deductions_and_s22_terms():
    result1 = lint_prose("Alain Aspect was not a simple name.")
    assert not result1.passed
    assert any("s22_term" in v[0] for v in result1.hard_violations)

    result2 = lint_prose("The lock showed lubricant viscosity.")
    assert not result2.passed
    assert any("impossible_deduction" in v[0] for v in result2.hard_violations)

    result3 = lint_prose("A&S means Alain and Solis.")
    assert not result3.passed
    assert any("as_decoding" in v[0] for v in result3.hard_violations)

def test_soft_caps():
    # Rule of three cap is 2
    prose = "He liked red, green, and blue. She liked cats, dogs, and birds. They liked tea, coffee, and water."
    result = lint_prose(prose)
    assert not result.passed
    assert any("rule_of_three" in c[0] for c in result.cap_violations)

    # Kind of / sort of cap is 3
    prose2 = "It was kind of cold. He was sort of tired. It felt kind of strange. She was sort of happy."
    result2 = lint_prose(prose2)
    assert not result2.passed
    assert any("kind_of" in c[0] for c in result2.cap_violations)

def test_anaphora_chain_detection():
    # Anaphora chain is repeated sentence starts. Max cap is 2.
    prose = "He walked to the window. He looked out at the street. He wondered if anyone was watching."
    result = lint_prose(prose)
    assert not result.passed
    assert any("anaphora_chain" in c[0] for c in result.cap_violations)
