# Chapter 1–4 Backfill Supersession Audit Report

This report audits all superseded entries in the canon store, focusing on identifying the 7 backfilled supersessions from Chapters 1–4 and evaluating them for interpretive drift or silent conflict absorption.

## Unique Extracted-At Pass Values in Store:
- `audit_trail_lost`: 206 entries
- `seed`: 55 entries
- `backfill_epilogue_20260525`: 41 entries
- `backfill_ch16_20260525`: 40 entries
- `backfill_ch10_20260525`: 39 entries
- `backfill_ch11_20260525`: 39 entries
- `backfill_ch15_20260525`: 38 entries
- `backfill_ch12_20260525`: 37 entries
- `backfill_ch14_20260525`: 36 entries
- `backfill_ch7_5_20260525`: 35 entries
- `backfill_ch8_20260525`: 35 entries
- `backfill_ch9_20260525`: 35 entries
- `backfill_ch12_5_20260525`: 35 entries
- `20260525T002543Z`: 34 entries
- `backfill_ch7_20260525`: 34 entries
- `backfill_ch13_20260525`: 34 entries
- `20260525T002753Z`: 33 entries
- `20260525T003030Z`: 33 entries
- `20260525T003313Z`: 33 entries
- `verify-fix-001`: 33 entries
- `backfill_ch6_20260525`: 33 entries
- `reconciliation_pass_a_20260525`: 5 entries
- `manual_seed_correction_bell_20260525`: 2 entries
- `reconciliation_pass_b_varn_20260525`: 2 entries

## Superseded Entries by Replaced Pass:
- Replaced from `audit_trail_lost`: 36 entries
- Replaced from `seed`: 18 entries
- Replaced from `backfill_ch16_20260525`: 6 entries
- Replaced from `backfill_ch15_20260525`: 5 entries
- Replaced from `20260525T002543Z`: 4 entries
- Replaced from `backfill_ch7_5_20260525`: 3 entries
- Replaced from `backfill_ch14_20260525`: 3 entries
- Replaced from `20260525T003313Z`: 2 entries
- Replaced from `backfill_ch6_20260525`: 2 entries
- Replaced from `backfill_ch8_20260525`: 2 entries
- Replaced from `backfill_ch9_20260525`: 2 entries
- Replaced from `backfill_ch12_20260525`: 2 entries
- Replaced from `backfill_ch12_5_20260525`: 2 entries
- Replaced from `backfill_ch13_20260525`: 2 entries
- Replaced from `20260525T002753Z`: 1 entries
- Replaced from `backfill_ch7_20260525`: 1 entries
- Replaced from `backfill_ch10_20260525`: 1 entries
- Replaced from `backfill_ch11_20260525`: 1 entries

## Detailed Supersession Analysis

### Entry: `kain.shadow_delta_14`
- **Namespace:** `character`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **Old Value:** QSA file SHADOW/DELTA-14/K.J. – PRE-ACQUISITION exists, written before Kain's recruitment. He was recruited knowing his degradation curve and retirement threshold. Written by Emily; she knew he would eventually find it.
- **New Value:** Kain discovers and opens the file SHADOW/DELTA-14/K.J. – PRE-ACQUISITION, locked with Level 7 biometric key. He bypasses it using an override protocol he built four years ago, exploiting legacy 2140s security parameters. The file contains seven sections: SUBJECT PROFILE, ICS BASELINE, ENTANGLEMENT HISTORY, RESIDUE MAPPING, OPERATIONAL OBJECTIVE, ACQUISITION WINDOW, and NEUROLOGICAL BLUEPRINT. His ICS Baseline is listed as 96. The NEUROLOGICAL BLUEPRINT renders his full neural architecture including 'a single, faint, anomalous patch of dormant PQ genotype visible as a localized green stain near the corpus callosum.' The SHADOW INSTANCE overlays his wireframe in red, with identical nodes but altered connection directionality — optimising his insecurities into functional strengths (e.g., 'Tram Preference: 7:30 AM -> Confidence/Optimized Schedule'; 'Coffee Preference: Cream -> Self-Reward/Operational Ease').
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `bell.identity`
- **Namespace:** `character`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `manual_seed_correction_bell_20260525` (Source Ch: 8)
- **Old Value:** Bell is Emily's operational partner and a QSA technician/analyst. Ch 8 ('BELL DISCOVERS THE LIE') is her POV: she discovers that Kain's true ICS (41) and post-jump readings (e.g. jump 200 ICS 58) have been withheld from her. Quietly competent — adjusts a kitchen clock by 45 seconds rather than reach for a tablet when she realises she's being watched/surveilled.
- **New Value:** Bell is Hayden's operational partner and a QSA technician/analyst. Quietly competent — adjusts a kitchen clock by 45 seconds rather than reach for a tablet when she realises she is being watched. Discovers Hayden's concealed ICS degradation in Ch 8 (see bell.pov_chapter, hayden.ics_full_trajectory). Knows Kain only by name from Hayden's early-cycle logs as 'the QSA Norm consultant, the dormant carrier Emily had brought in as a procedural instrument' (see bell.knowledge_of_kain).
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `bell.discovery`
- **Namespace:** `character`
- **Old Pass:** `seed` (Source Ch: 8)
- **New Pass:** `manual_seed_correction_bell_20260525` (Source Ch: 8)
- **Old Value:** Bell concludes (Ch 8 close): 'Kain has been authorised to continue active fieldwork at ICS 41 without mandatory disclosure to his partner. No direct evidence. Sufficient inference. The QSA did not run operations like this without authorisation at the handling level, and Emily was the handler, and the handler knew the asset's status or the handler was negligent, and Emily was not negligent.' She does not call Kain. She does not know Kain.
- **New Value:** Bell concludes (Ch 8): Hayden has been authorised to continue active fieldwork at ICS 41 without mandatory disclosure to his partner. Builds a partition file of evidence over six weeks. Decides to leave incrementally, below the threshold of Hayden's residue-reading (see bell.departure_geometry). Does NOT contact Emily — infers Emily approved the operational parameters (see plot.loop_emily_handler_complicity). Does NOT contact Kain (see bell.knowledge_of_kain). The original seed entry erroneously attributed this discovery to Kain's data instead of Hayden's.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `varn.identity`
- **Namespace:** `character`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `reconciliation_pass_b_varn_20260525` (Source Ch: 2)
- **Old Value:** Varn is one of the three most recent confirmed Replacement Anomalies (Chen, Varn, and an unnamed QSA asset from a 2154 report). No details beyond name and category at this seeding.
- **New Value:** Elias Varn — mid-level procurement officer in the Department of Infrastructure's quantum relay division, Level 2 clearance, six years in post when Kain was assigned to audit his contractor payments. Replaced by an instance during Kain's investigation. The Varn extraction is the inflection point of Kain's career and the operation Emily names when she recruits him: 'You did it four years ago with Elias Varn' (note: Ch 1 dialogue's 'four years ago' and Ch 2 extraction's 'fifteen years before the present' are in apparent conflict; see plot.loop_varn_timeline_discrepancy). Origin of multiple downstream entries: varn.replacement_case, varn.gait_variance, varn.extraction_outcome, kain.varn_case, kain.career_destruction, kain.emily_betrayal_taxonomy, kain.varn_proxy_server, kain.proprioceptive_mapping_habit.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.prologue_chen_killed`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Prologue: Marcus Chen is killed in his Melbourne apartment by his Replacement during a forced morning routine. Triggers a dead-man's switch on his QSA comm device, transmitting the last 60 seconds to a secure QSA server as biometrics flatline against the casing.
- **New Value:** Chen was killed by his Replacement during a forced morning routine in his own apartment. The Replacement had sufficient knowledge of Chen's habits, schedule, and domestic environment to stage a convincing facsimile — but the staging contained deliberate or inadvertent tells (wrong mug, imperfect handwriting on the schedule). Chen is the fourth confirmed Replacement Anomaly in fourteen months.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.ch1_black_pearl`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 1)
- **New Pass:** `20260525T002543Z` (Source Ch: 1)
- **Old Value:** Ch 1 (BLACK PEARL BAR): Kain meets Emily at the Black Pearl. She names Marcus Chen and frames the Replacement Anomaly pattern (fourth confirmed in 14 months). Tremor in Kain's right hand. Bleed peripheral fragmentation on the walk in.
- **New Value:** Emily briefs Kain off-grid at the Black Pearl. She reveals: Chen is the fourth confirmed Replacement Anomaly in fourteen months with three probable and possibly more. 'Whoever is running this understands quantum insertion at a level that shouldn't exist outside the QSA. They're replacing operatives in positions of institutional influence. And the replacements don't know they are replacements.' The QSA cannot investigate internally without triggering a political crisis that would collapse the Accords.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.ch4_alfred_hospital`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 4)
- **New Pass:** `reconciliation_pass_a_20260525` (Source Ch: 4)
- **Old Value:** Ch 4 (ALFRED HOSPITAL): Hospital sequence. Setup for the Reyes contact thread. Threshold manifest visit context.
- **New Value:** Ch 4 (ALFRED HOSPITAL) is the chapter of Hayden's collapse: his ICS reading is documented below the operational threshold, escalating the carrier's clinical situation past the point where continued fieldwork is institutionally defensible. See hayden.collapse_ch4, hayden.ics_ch4, hayden.ics_below_threshold for in-chapter detail. Note: the Reyes contact thread (M. Reyes at Alfred) is Ch 9, not Ch 4 — original seed was misframed on this point.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.ch5_chen_apartment`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 5)
- **New Pass:** `reconciliation_pass_a_20260525` (Source Ch: 5)
- **Old Value:** Ch 5 (THE APARTMENT): Kain performs his reading pass at Chen's preserved apartment. Maltese Falcon spine-reversed. Mug ring on counter. QSA evidence lock on the door.
- **New Value:** Ch 5 (THE APARTMENT) is Kain's solo reading pass of Chen's preserved apartment. Establishes the handedness palimpsest: Chen was left-handed; the Replacement is right-handed; four independent environmental traces preserve evidence of both — the Maltese Falcon spine crease, the desk lamp position moved left-to-right in month one of the anomaly period, the shower dial calcium pattern (7 o'clock for Chen vs. 9 o'clock for the Replacement), and the kitchen drawer handle wear. See plot.ch5_maltese_falcon_spine_crease, plot.ch5_shower_anomaly, plot.ch5_desk_lamp, plot.ch5_kitchen_drawer, chen.left_handed, chen.replacement_right_handed.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.ch10_dead_mans_switch`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 10)
- **New Pass:** `reconciliation_pass_a_20260525` (Source Ch: 10)
- **Old Value:** Ch 10 (DEAD MAN'S SWITCH): Kain reads Solis's journals (after obtaining the decryption key). Confronts Emily. 'You have two jumps left.' Kain refuses stand-down and walks out.
- **New Value:** Ch 10 (DEAD MAN'S SWITCH) is a four-scene chapter: Kain at the Fitzroy library terminal (plot.ch10_fitzroy_library_terminal); the cipher pointing to the dead-man's switch (plot.ch10_dead_mans_switch_key); the confrontation with Emily in her private operations office, where she delivers the 'two jumps left' warning and Kain refuses stand-down (plot.ch10_emily_confrontation, emily.two_jumps_warning); and the PQ-gen-549 conversation thread (plot.ch10_conv_pq_gen_549).
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.ch12_the_breach`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 12)
- **New Pass:** `reconciliation_pass_a_20260525` (Source Ch: 12)
- **Old Value:** Ch 12 (THE BREACH): Kain breaches a credential-denied space (Level 4 credential 'no longer existed'). Hayden's voice drifts. Multiple Coherence Offset coordinates traversed (77-Alpha-9: 0.004, 88-Gamma-3: 0.011). ICS readings 53 → 54/55.
- **New Value:** Ch 12 (THE BREACH) covers the breach of a credential-denied space ("Level 4 credential 'no longer existed'") and Hayden's voice drifting spatially as his vocal cord innervation degrades. The chapter ends at the Sphere convergence event itself (covered by plot.ch12_convergence_event — the 6% gap, the copper-scented ward, Kain's left hand failing). See also plot.ch12_alfred_crescent_14, plot.ch12_identity_scrub.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.maltese_falcon_tell`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Marcus Chen reversed THE MALTESE FALCON (spine facing in) on his bookshelf during the Replacement attack — violating his father's strictest rule. The book's reversed spine survives the Replacement's cleanup; it is one of the readable signals Kain finds in Ch 5.
- **New Value:** Chen deliberately reversed The Maltese Falcon on his bookshelf — 'spine facing in, violating his father's strictest rule' — as a planted tell during the Replacement attack. This is evidence left for a future investigator.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.loop_replacement_origin`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Who is running the Replacement Anomaly program? The QSA's own internal apparatus, or an external actor with QSA access? The replacement of Chen demonstrated sophisticated knowledge of QSA personnel and the Sphere.
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Who is running the Replacement Anomaly program? The QSA's own internal apparatus, or an external actor with QSA access? The replacement of Chen demonstrated sophisticated knowledge of QSA personnel and the Sphere.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kains_third_jump`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 10)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: Kain refused stand-down. He has two jumps left before the third triggers neurological collapse. How does he use them?
- **New Value:** OPEN: Kain has declared himself off-network with two jumps remaining before neurological collapse. He has the Solis journals and the CONV-PQ-GEN-549 file knowledge. Where does he jump, and what does he pursue? 'I have two jumps left. And I'm using them for me.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.loop_solis_retirement`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `reconciliation_pass_a_20260525` (Source Ch: 14)
- **Old Value:** OPEN: Why did Martina Solis retire? Her journals are sequestered, her research kept at the same classification as the program itself. What did she find?
- **New Value:** RESOLVED in Ch 14. Solis was sequestered because she had documented the degradation curve fourteen years ago; the QSA sequestered her specifically because she wrote it down. See solis.ch14_sequestration_reason for the in-chapter passage. Original: Why did Martina Solis retire? Her journals are sequestered, her research kept at the same classification as the programme itself.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_reyes_identity`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `backfill_ch7_5_20260525` (Source Ch: 7)
- **Old Value:** OPEN: Is 'M. Reyes' (Alfred Hospital, room 2-14) the same Reyes as the closed 2149 case? If so, why is the case reactivating now?
- **New Value:** RESOLVED: Resolved in Chapter 7. Original: Is 'M. Reyes' (Alfred Hospital, room 2-14) the same Reyes as the closed 2149 case? If so, why is the case reactivating now?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_emily_motivation`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **Old Value:** OPEN: Emily wrote SHADOW/DELTA-14/K.J. – PRE-ACQUISITION, recruited Kain knowing his Bleed curve, and sent him the Chen file. What is she optimising for — Kain's survival, the investigation's outcome, or something else?
- **New Value:** RESOLVED: Resolved in Chapter 11. Original: Emily wrote SHADOW/DELTA-14/K.J. – PRE-ACQUISITION, recruited Kain knowing his Bleed curve, and sent him the Chen file. What is she optimising for — Kain's survival, the investigation's outcome, or something else?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_varn_details`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 2)
- **Old Value:** OPEN: Who was Varn? Named as a Replacement Anomaly alongside Chen, no other details seeded.
- **New Value:** RESOLVED: Resolved in Chapter 2. Original: Who was Varn? Named as a Replacement Anomaly alongside Chen, no other details seeded.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_sep_null_purpose`
- **Namespace:** `plot`
- **Old Pass:** `seed` (Source Ch: 0)
- **New Pass:** `backfill_ch12_20260525` (Source Ch: 12)
- **Old Value:** OPEN: Why would anyone need a carrier at the SEP-NULL given that complete buffer saturation occurs in 0.4 seconds and the position is clinically unsurvivable?
- **New Value:** RESOLVED: Resolved in Chapter 12. Original: Why would anyone need a carrier at the SEP-NULL given that complete buffer saturation occurs in 0.4 seconds and the position is clinically unsurvivable?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `chen.apartment_location`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 5)
- **Old Value:** Chen's apartment overlooks the Melbourne skyline. He has lived there for three years: 'He had looked at that view every morning for three years and it had never looked back.'
- **New Value:** Chen's apartment is in Southbank, fourteenth floor, in a building constructed in 2139. The building's facade carries 'the faint iridescent patina of coherence-reactive polymer' that has degraded from Melbourne's electromagnetic environment. The lobby has a Gen-3 autom-unit at the concierge station. The apartment is sealed with a QSA evidence lock carrying the agency's blue classification stripe.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.divorce`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen is divorced. The divorce shaped his daily routine: 'He had worked out at o six hundred every morning since the divorce because the only thing he could control at six a.m was whether he got out of bed.'
- **New Value:** Chen is divorced. His post-divorce routine is load-bearing characterisation: 'He had worked out at o six hundred every morning since the divorce because the only thing he could control at six a.m was whether he got out of bed.' The Replacement later weaponises this: 'You drank black coffee because you were punishing yourself for the divorce.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.security_pass_hook`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** Chen always used the top hook for his security pass — 'not a decision, but a habit.' The Replacement placed it on the bottom hook. Chen noticed but left it where the Replacement had put it, preserving the discrepancy as evidence.
- **New Value:** Chen used the top hook by the door for three years — 'not a decision, but a habit.' The Replacement placed the security pass on the bottom hook. Chen notices but leaves it where the Replacement put it.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.white_mug`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Replacement used a white mug. 'He had never used the white mug.' The mug is a negative-space tell — its presence on the counter is evidence of the Replacement's imperfect reconstruction.
- **New Value:** The Replacement placed a white mug on the kitchen counter. 'He had never used the white mug.' The mug is a negative-space tell — its presence signals the Replacement's imperfect reconstruction of Chen's life.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.replacement_encounter`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen's Replacement demonstrated: (1) perfect vocal mimicry of Chen's voice and cadence, including knowledge of his current caseload ('the Chen report ready by Thursday, dimensional variance data'); (2) superhuman speed — 'faster than any calibration he had for a human body'; (3) no preparatory body language before striking — 'no lean, no gathering of weight before commitment'; (4) a smile that was mechanically correct but expressively wrong — 'the muscles moving through the correct positions without arriving at the correct result.'
- **New Value:** Chen discovers his Replacement has already infiltrated his apartment and assumed his daily routine, including his current caseload: 'yes, I'll have the Chen report ready by Thursday. The dimensional variance data is still being processed.' The Replacement speaks in Chen's own voice and cadence.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.flagged_eighteen_months`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen was flagged eighteen months before the Prologue for 'behavioural inconsistencies,' per the Replacement's claim. This predates the attack by a significant margin, implying long-term surveillance and planning.
- **New Value:** The Replacement claims Chen was 'flagged eighteen months ago. Behavioural inconsistencies. The Agency decided—' before Chen interrupts. The Replacement frames the replacement as an institutional decision.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.wrist_injury`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Replacement broke Chen's wrist during the attack: 'his wrist gave with a wet pop at the joint, the angle arriving before the pain did.'
- **New Value:** The Replacement breaks Chen's wrist during the attack: 'his wrist gave with a wet pop at the joint, the angle arriving before the pain did.' He later pushes himself up on his good arm; 'His wrist hung wrong.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.dead_mans_switch_activation`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen's QSA comm device has a dead-man's switch: 'a secondary function — a dead-man's switch that transmitted the last sixty seconds to a secure QSA server if the agent's biometrics flatlined while in contact with the casing.' Chen deliberately grasped the device while the Replacement strangled him — 'his biometrics alive against the contact surface' — and held on as his pulse slowed. The device emitted 'a single, soft beep,' confirming transmission.
- **New Value:** Chen's QSA comm device has a dead-man's switch: 'a secondary function — a dead-man's switch that transmitted the last sixty seconds to a secure QSA server if the agent's biometrics flatlined while in contact with the casing.' Chen deliberately grabs the device from the Replacement's hand to maintain biometric contact as the Replacement strangles him. The device emits 'a single, soft beep' — implying the transmission triggered.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.caseload_dimensional_variance`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** Chen's current caseload includes a 'Chen report' due Thursday and 'dimensional variance data' still being processed. The Replacement mimicked this knowledge perfectly.
- **New Value:** Chen's current caseload involves 'dimensional variance data' that is 'still being processed,' referenced by the Replacement mimicking his voice. This is the only window into Chen's professional work beyond his title. The 'Chen report' is due Thursday.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.comm_device_activation`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen activates his QSA comm device with a specific sequence — 'thumb, thumb, index' — and sets it recording on the floor beside him, indicator light masked by his palm.
- **New Value:** Chen activates his QSA comm device with a specific sequence — 'thumb, thumb, index' — and sets it to record, masking the indicator light with his palm. This is muscle memory from active casework: 'He activated it the way he'd activated it a hundred times on active cases.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.maltese_falcon`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen deliberately reverses the spine of The Maltese Falcon on his bookshelf — 'spine facing in, violating his father's strictest rule' — as an evidence marker during the Replacement's attack. This is a planted tell for a future investigator.
- **New Value:** Chen owns a copy of The Maltese Falcon, kept on a bookshelf. During the Replacement's shower, Chen reverses the spine — 'spine facing in, violating his father's strictest rule' — as a deliberate evidence marker. The act is four silent steps from the kitchen counter.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.fathers_rule`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen's father had a 'strictest rule' about book spines facing outward. Reversing The Maltese Falcon violates this rule, making it a signal only someone who knew Chen's family habits would recognise.
- **New Value:** Chen's father had a 'strictest rule' about book spines facing outward. Reversing The Maltese Falcon violates this rule, which is why Chen chose it as an evidence marker — it is a signal only someone who knew his father's habits would recognise as deliberate.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.schedule_forgery`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Replacement wrote Chen's laminated schedule in his hand — 'close enough that his own graphology team wouldn't flag it, not close enough that he would miss it. The pressure was wrong. The spacing between letters was a fraction wide, the pressure of someone reconstructing rather than producing.' Chen photographs it with the comm device.
- **New Value:** The Replacement wrote Chen's laminated schedule in Chen's hand — 'close enough that his own graphology team wouldn't flag it, not close enough that he would miss it. The pressure was wrong. The spacing between letters was a fraction wide, the pressure of someone reconstructing rather than producing.' Chen photographed it with the comm device.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.death`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen is killed by the Replacement via carotid compression: 'Its fingers found his throat with mechanical precision, pressing against the carotid with the accuracy of something that did not need to estimate. Chen's vision narrowed. His pulse throbbed through his palm against the casing, slowing, slowing.' The chapter ends with the device beep; Chen's death is implied but not explicitly stated in the Prologue text itself — the final line is 'The device emitted a single, soft beep.'
- **New Value:** Chen is killed by the Replacement via strangulation (carotid compression) in his apartment. The chapter ends with Chen's pulse slowing to flatline while he holds the comm device. His final conscious thought: 'Someone will find this.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.caseload`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen's current caseload includes a 'Chen report' due Thursday and 'dimensional variance data' still being processed. The Replacement is already working this caseload in Chen's voice.
- **New Value:** Chen's current caseload includes a 'Chen report' due Thursday and 'dimensional variance data' still being processed. The Replacement speaks about this caseload in Chen's voice, implying it has assumed his professional responsibilities.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.ideology`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** The Replacement articulates a philosophy of optimisation over replication: 'I'm not copying your life, Marcus. I'm living the life you were too broken to live. And no one — no one — will miss the version of you that was afraid of everything.' It reframes Chen's habits as pathologies and its own as improvements: confident tram time, coffee with cream, healthy sleep.
- **New Value:** The Replacement articulates a philosophy of improvement over replication: 'I'm not copying your life, Marcus. I'm living the life you were too broken to live. And no one — no one — will miss the version of you that was afraid of everything.' It reframes each of Chen's habits as pathology and its own versions as health.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.already_optimised_claim`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** The Replacement claims: 'evidence requires someone to find it. Someone to understand it. And the people who might understand are already optimised.' This implies multiple QSA personnel have already been replaced before Chen.
- **New Value:** The Replacement claims Chen's evidence is futile: 'evidence requires someone to find it. Someone to understand it. And the people who might understand are already optimised.' This implies multiple QSA personnel capable of investigating have themselves been replaced.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.reflection_anomaly`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Prologue opens: 'The reflection in the window finished tying its shoe a half-second late.' Chen notices the desynchronisation and holds still, counting heartbeats. The skyline 'had never looked back' — until now. This is the inciting perceptual break.
- **New Value:** The chapter opens with a temporal desynchronisation: 'The reflection in the window finished tying its shoe a half-second late.' Chen notices the delay, freezes, and counts his heartbeats. The skyline 'had never looked back' — until now. This is the inciting perceptual event that alerts Chen to the Replacement's presence.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.recognition_not_surprise`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** When Chen and the Replacement see each other face to face, the expression on the Replacement's face is 'not surprise. Recognition.' It says: 'You're still here. That's not supposed to happen.' The Replacement expected Chen to already be gone.
- **New Value:** When the Replacement encounters Chen still in the apartment, its expression is 'not surprise. Recognition.' It says: 'You're still here. That's not supposed to happen.' The Replacement expected Chen to have already left.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.loop_replacement_origin.v2`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Who is running the Replacement program? The Replacement implies institutional authority ('The Agency decided—') but also a version of the QSA Chen does not know ('The QSA you know doesn't'). The origin, authorisation, and manufacturing process of Replacements are unexplained.
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Who is running the Replacement program? The Replacement implies institutional authority ('The Agency decided—') but also a version of the QSA Chen does not know ('The QSA you know doesn't'). The origin, authorisation, and manufacturing process of Replacements are unexplained.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `chen.weapon_storage`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** Chen's service weapon is kept in a bedroom safe, twelve steps from the window where he first notices the reflection anomaly. His QSA comm device is in the desk drawer, three steps away. He chooses the comm device over the weapon: 'His service weapon was twelve steps away, in the bedroom safe. His QSA comm device was three steps away, in the desk drawer. He took the three steps.'
- **New Value:** Chen's service weapon is stored in his bedroom safe, twelve steps from the window where he notices the reflection anomaly. His QSA comm device is in the desk drawer, three steps away. He chooses the comm device over the weapon.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.routine_real`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen's actual routine, which differs from what the Replacement performs: tram at 0715 (not 0730), coffee black (not with cream), workout at 0600 (not 0700), seven-minute shower. 'He took the tram at o seven fifteen. He drank his coffee black. He had worked out at o six hundred every morning since the divorce because the only thing he could control at six a.m was whether he got out of bed.'
- **New Value:** Chen's actual routine, which differs from what the Replacement adopted: tram at 0715 (not 0730), black coffee (not with cream), workout at 0600 (not 0700), seven-minute showers. 'He took the tram at o seven fifteen. He drank his coffee black. He had worked out at o six hundred every morning since the divorce because the only thing he could control at six a.m was whether he got out of bed.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.hook_habit`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen used the top hook by the door for his security pass for three years — 'not a decision, but a habit — an accumulation of doing the same thing enough times that the reasoning dissolved and only the motion remained.' The Replacement placed the pass on the bottom hook.
- **New Value:** Chen uses the top hook by the door for his security pass — 'not a decision, but a habit — an accumulation of doing the same thing enough times that the reasoning dissolved and only the motion remained.' The Replacement placed the pass on the bottom hook.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.voice_mimicry`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Replacement speaks in Chen's voice with Chen's cadence and references Chen's current caseload before entering the apartment: 'His own voice. His own cadence. His current caseload.'
- **New Value:** The Replacement can reproduce Chen's voice and current caseload verbatim. Chen hears it speaking on entry: '—yes, I'll have the Chen report ready by Thursday. The dimensional variance data is still being processed.' Described as: 'His own voice. His own cadence. His current caseload.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.smile_defect`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Replacement's smile is physically correct but expressively wrong, described twice: 'the muscles moving through the correct positions without arriving at the correct result' and 'the muscles achieving their positions without arriving at the expression.' This is a consistent tell — the Replacement can reproduce facial muscle configurations but not the affect they are supposed to convey.
- **New Value:** The Replacement's smile is consistently described as mechanically correct but expressively wrong: 'the muscles moving through the correct positions without arriving at the correct result' and later 'the muscles achieving their positions without arriving at the expression.' This is a repeating tell — the body performs the motion but does not produce the meaning.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.self_description`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The Replacement describes itself as 'an improvement' and 'the version of you this reality needs.' It frames its purpose not as replication but as optimisation: 'I'm not copying your life, Marcus. I'm living the life you were too broken to live.'
- **New Value:** The Replacement describes itself as 'an improvement,' not a copy: 'I'm not copying your life, Marcus. I'm living the life you were too broken to live.' It reframes each of Chen's habits as pathology and its own versions as health: afraid of crowds vs. confident, punishing himself vs. allowing pleasure, insomnia vs. sleeping well.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.death_method`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen is killed by strangulation — the Replacement's 'fingers found his throat with mechanical precision, pressing against the carotid with the accuracy of something that did not need to estimate. Chen's vision narrowed. His pulse throbbed through his palm against the casing, slowing, slowing.'
- **New Value:** The Replacement kills Chen by carotid compression: 'Its fingers found his throat with mechanical precision, pressing against the carotid with the accuracy of something that did not need to estimate. Chen's vision narrowed. His pulse throbbed through his palm against the casing, slowing, slowing.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.carotid_precision`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** The Replacement kills with anatomical precision that is explicitly non-human: 'pressing against the carotid with the accuracy of something that did not need to estimate.' The phrasing 'something' rather than 'someone' is the narrator's — the text shifts from 'he' to 'it' for the Replacement during the violence.
- **New Value:** The Replacement strangles Chen with mechanical anatomical precision: 'Its fingers found his throat with mechanical precision, pressing against the carotid with the accuracy of something that did not need to estimate.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.prologue_reflection_anomaly`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** The chapter opens with a temporal desynchronisation in Chen's reflection: 'The reflection in the window finished tying its shoe a half-second late.' This is the inciting observation — Chen notices the delay and immediately begins threat assessment. The anomaly is never explained within the chapter.
- **New Value:** The chapter opens with a temporal desynchronisation: 'The reflection in the window finished tying its shoe a half-second late.' This is the inciting observation that causes Chen to freeze and notice the intrusion. The reflection anomaly occurs before the Replacement enters through the front door, suggesting it may be a perceptual effect of the Replacement's proximity rather than a direct visual of the Replacement itself.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.three_year_tenure`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen has occupied his apartment for three years. Multiple habits are anchored to this duration: the view ('every morning for three years'), the top hook ('for three years'), the seven-minute shower ('every morning for three years'). The three-year baseline is what makes the Replacement's deviations detectable.
- **New Value:** Chen has lived in his apartment for three years: 'He had looked at that view every morning for three years.' His habits (top hook, seven-minute shower, 7:15 tram) are three-year accumulations.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.service_weapon_location`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `audit_trail_lost` (Source Ch: 0)
- **Old Value:** Chen's service weapon is kept in a bedroom safe, twelve steps from the window where he noticed the reflection anomaly. His QSA comm device is in a desk drawer, three steps away. He chose the comm device over the weapon: 'He took the three steps.'
- **New Value:** Chen's service weapon is in his bedroom safe, twelve steps from the window. 'His service weapon was twelve steps away, in the bedroom safe.' He chooses the comm device (three steps, desk drawer) over the weapon.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.maltese_falcon_reversal`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** Chen deliberately reversed The Maltese Falcon on his bookshelf — 'spine facing in, violating his father's strictest rule' — as an evidence marker during the Replacement's presence. He moved to the bookshelf and back in the window while the Replacement was in the kitchen.
- **New Value:** Chen pulls The Maltese Falcon from the shelf and reverses it — 'spine facing in, violating his father's strictest rule' — as a deliberate evidence marker. He does this in the window between the Replacement opening the refrigerator and the footsteps reaching the hallway.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `replacement.superhuman_speed`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** The Replacement moves with inhuman speed and no preparatory body language: 'It moved faster than he was prepared for — faster than any calibration he had for a human body.' 'The body gave no preparatory warning, no lean, no gathering of weight before commitment. The distance between them ceased to exist in the way a frame gets cut from film.' Its grip on Chen's throat is described as 'mechanical precision, pressing against the carotid with the accuracy of something that did not need to estimate.'
- **New Value:** The Replacement moves 'faster than any calibration he had for a human body.' Its attack gives no preparatory warning: 'no lean, no gathering of weight before commitment. The distance between them ceased to exist in the way a frame gets cut from film.' It breaks Chen's wrist with 'a wet pop at the joint, the angle arriving before the pain did.'
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.eighteen_month_flag`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** The Replacement states Chen 'was flagged eighteen months ago. Behavioural inconsistencies. The Agency decided—' before Chen interrupts. The eighteen-month timeline places the flagging well before the Replacement's physical arrival.
- **New Value:** The Replacement states Chen was 'flagged eighteen months ago' for 'behavioural inconsistencies' and that 'The Agency decided—' before Chen interrupts. The flagging predates the Prologue by eighteen months. The nature of the inconsistencies and whether the flagging was legitimate or manufactured are unstated.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.shower_duration`
- **Namespace:** `character`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** Chen takes a seven-minute shower every morning. The Replacement takes longer — Chen estimates twelve to fourteen minutes: 'the replacement would likely not know that, would take whatever time it wanted.'
- **New Value:** Chen takes a seven-minute shower every morning. The Replacement takes twelve to fourteen minutes: 'He'd taken a seven-minute shower every morning for three years and the replacement would likely not know that, would take whatever time it wanted.' The duration gap gives Chen time to examine the apartment.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `chen.final_thought`
- **Namespace:** `plot`
- **Old Pass:** `audit_trail_lost` (Source Ch: 0)
- **New Pass:** `verify-fix-001` (Source Ch: 0)
- **Old Value:** Chen's last conscious thought: 'Someone will find this.' Italicised, set apart. The 'this' encompasses the dead-man's switch transmission at minimum, and possibly the full evidence trail. This is the chapter's closing plant — the expectation that an investigator will follow.
- **New Value:** Chen's last conscious thought: 'Someone will find this.' The antecedent of 'this' is ambiguous — the dead-man's switch transmission, the reversed Maltese Falcon, the schedule photograph, or all three together.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `varn.first_name`
- **Namespace:** `character`
- **Old Pass:** `20260525T002543Z` (Source Ch: 1)
- **New Pass:** `reconciliation_pass_b_varn_20260525` (Source Ch: 2)
- **Old Value:** Varn's first name is Elias. Emily: 'You did it four years ago with Elias Varn.'
- **New Value:** Elias Varn — mid-level procurement officer in the Department of Infrastructure's quantum relay division, Level 2 clearance, six years in post when Kain was assigned to audit his contractor payments. Replaced by an instance during Kain's investigation. The Varn extraction is the inflection point of Kain's career and the operation Emily names when she recruits him: 'You did it four years ago with Elias Varn' (note: Ch 1 dialogue's 'four years ago' and Ch 2 extraction's 'fifteen years before the present' are in apparent conflict; see plot.loop_varn_timeline_discrepancy). Origin of multiple downstream entries: varn.replacement_case, varn.gait_variance, varn.extraction_outcome, kain.varn_case, kain.career_destruction, kain.emily_betrayal_taxonomy, kain.varn_proxy_server, kain.proprioceptive_mapping_habit.
- **Drift Analysis:** Refinement / elaboration. Check if claims contradict or silently absorb conflict.

### Entry: `plot.loop_replacements_self_awareness`
- **Namespace:** `plot`
- **Old Pass:** `20260525T002543Z` (Source Ch: 1)
- **New Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **Old Value:** OPEN: Emily states 'the replacements don't know they are replacements,' but the Prologue's Replacement is fully self-aware and articulate about its nature. Is Emily's intelligence wrong, or are there different classes of Replacement with varying degrees of self-knowledge?
- **New Value:** RESOLVED: Resolved in Chapter 11. Original: Emily states 'the replacements don't know they are replacements,' but the Prologue's Replacement is fully self-aware and articulate about its nature. Is Emily's intelligence wrong, or are there different classes of Replacement with varying degrees of self-knowledge?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_bleed_discovery`
- **Namespace:** `plot`
- **Old Pass:** `20260525T002543Z` (Source Ch: 1)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: Kain is concealing active Bleed from Emily while accepting an off-book investigation. 'He hadn't told her about the fragmentation. He wasn't going to.' His tremor and peripheral stutters are worsening under stress. When will Emily or someone else discover his condition, and what happens when they do?
- **New Value:** RESOLVED: Resolved in Chapter 10. Original: Kain is concealing active Bleed from Emily while accepting an off-book investigation. 'He hadn't told her about the fragmentation. He wasn't going to.' His tremor and peripheral stutters are worsening under stress. When will Emily or someone else discover his condition, and what happens when they do?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_varn_connection`
- **Namespace:** `plot`
- **Old Pass:** `20260525T002543Z` (Source Ch: 1)
- **New Pass:** `audit_trail_lost` (Source Ch: 2)
- **Old Value:** OPEN: The Varn case (Elias Varn, four years ago) is the reason Emily recruits Kain. It is also the inflection point after which 'everything that followed ran downhill' — coinciding with Kain's clearance revocation and the onset of his Bleed. Kain says 'We'll talk about Varn. But not here.' What happened on the Varn case, and why does it connect to the current Replacement investigation?
- **New Value:** RESOLVED: Resolved in Chapter 2. Original: The Varn case (Elias Varn, four years ago) is the reason Emily recruits Kain. It is also the inflection point after which 'everything that followed ran downhill' — coinciding with Kain's clearance revocation and the onset of his Bleed. Kain says 'We'll talk about Varn. But not here.' What happened on the Varn case, and why does it connect to the current Replacement investigation?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_solis_true_status`
- **Namespace:** `plot`
- **Old Pass:** `20260525T002753Z` (Source Ch: 2)
- **New Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **Old Value:** OPEN: Emily says Solis is 'retired' but the word lands 'with the dead weight of words that are technically accurate and functionally incomplete.' What is Solis's actual current status? Is she alive, sequestered, replaced, or something else? Emily deflects by looking at the tablet rather than answering directly.
- **New Value:** RESOLVED: Resolved in Chapter 11. Original: Emily says Solis is 'retired' but the word lands 'with the dead weight of words that are technically accurate and functionally incomplete.' What is Solis's actual current status? Is she alive, sequestered, replaced, or something else? Emily deflects by looking at the tablet rather than answering directly.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_cascade_clock`
- **Namespace:** `plot`
- **Old Pass:** `20260525T003313Z` (Source Ch: 4)
- **New Pass:** `backfill_ch12_5_20260525` (Source Ch: 12)
- **Old Value:** OPEN: Hayden is in active transition-induced cascade — each transition costs more coherence than recovery can restore. His ICS dropped from 34 to 32 in forty minutes during a single round trip. At this rate, how many transitions does he have left before neurological collapse? The chapter frames the stolen treatment data as 'the difference between thirty-two and something that was not thirty-two.'
- **New Value:** RESOLVED: Resolved in Chapter 12. Original: Hayden is in active transition-induced cascade — each transition costs more coherence than recovery can restore. His ICS dropped from 34 to 32 in forty minutes during a single round trip. At this rate, how many transitions does he have left before neurological collapse? The chapter frames the stolen treatment data as 'the difference between thirty-two and something that was not thirty-two.'
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_412_transitions_purpose`
- **Namespace:** `plot`
- **Old Pass:** `20260525T003313Z` (Source Ch: 4)
- **New Pass:** `backfill_ch8_20260525` (Source Ch: 8)
- **Old Value:** OPEN: What has Hayden been doing across 412 transitions over eight months? The Alfred Hospital infiltration is one mission, but 412 crossings implies sustained, intensive operations. What is his larger objective? The chapter shows only the Winters data theft but implies a much longer campaign.
- **New Value:** RESOLVED: Resolved in Chapter 8. Original: What has Hayden been doing across 412 transitions over eight months? The Alfred Hospital infiltration is one mission, but 412 crossings implies sustained, intensive operations. What is his larger objective? The chapter shows only the Winters data theft but implies a much longer campaign.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_winters_replaced`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch6_20260525` (Source Ch: 6)
- **New Pass:** `backfill_ch7_20260525` (Source Ch: 7)
- **Old Value:** OPEN: Kain concludes 'The replacement had already been here' based on the appointment board notation 'W. methodology cross-ref.' Has Winters herself been replaced, or has a replacement merely infiltrated her clinic schedule? The 9:00 patient appointment that morning may have been attended by a replacement rather than Winters. Kain needs the biometric entry log to determine 'whether the person who had attended the nine o'clock appointment this morning was Sarah Winters or someone who had spent three days learning to be her.'
- **New Value:** RESOLVED: Resolved in Chapter 7. Original: Kain concludes 'The replacement had already been here' based on the appointment board notation 'W. methodology cross-ref.' Has Winters herself been replaced, or has a replacement merely infiltrated her clinic schedule? The 9:00 patient appointment that morning may have been attended by a replacement rather than Winters. Kain needs the biometric entry log to determine 'whether the person who had attended the nine o'clock appointment this morning was Sarah Winters or someone who had spent three days learning to be her.'
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_journals_leverage`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch6_20260525` (Source Ch: 6)
- **New Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **Old Value:** OPEN: Kain knows Emily took the Solis journals and is deliberately withholding this knowledge. 'Telling her would tell her that he knew, and knowing that he knew would change the geometry of everything that followed.' This creates a hidden leverage dynamic — Kain holds information about Emily's evidence tampering that she does not know he holds. When and how will he deploy this knowledge?
- **New Value:** RESOLVED: Resolved in Chapter 11. Original: Kain knows Emily took the Solis journals and is deliberately withholding this knowledge. 'Telling her would tell her that he knew, and knowing that he knew would change the geometry of everything that followed.' This creates a hidden leverage dynamic — Kain holds information about Emily's evidence tampering that she does not know he holds. When and how will he deploy this knowledge?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_reyes_contact_identity`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch7_20260525` (Source Ch: 7)
- **New Pass:** `backfill_ch7_5_20260525` (Source Ch: 7)
- **Old Value:** OPEN: Who is M. Reyes — the replacement's network contact who used a cover name to enter Alfred Hospital as a patient? The Alfred database shows a Marcus Reyes (63, cardiac, last seen 14 months ago) with no neurology connection. Kain concludes it is 'a cover name.' What was passed to the replacement on the intake form, and what is Reyes's actual identity and role in the network?
- **New Value:** RESOLVED: Resolved in Chapter 7. Original: Who is M. Reyes — the replacement's network contact who used a cover name to enter Alfred Hospital as a patient? The Alfred database shows a Marcus Reyes (63, cardiac, last seen 14 months ago) with no neurology connection. Kain concludes it is 'a cover name.' What was passed to the replacement on the intake form, and what is Reyes's actual identity and role in the network?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_reyes_file_trail`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch7_5_20260525` (Source Ch: 7)
- **New Pass:** `backfill_ch9_20260525` (Source Ch: 9)
- **Old Value:** OPEN: Reyes has laid a three-step cross-referencing trail from the M. Reyes name to Emily Voss's operational history, accessible via Level 4 credentials. Will Kain follow this trail? Reyes is certain he will — 'That is what terminal men do — they stop waiting for permission' — but the trail is designed to feel like Kain's own discovery. Will Kain recognize the manipulation, or will the discovery feel organic?
- **New Value:** RESOLVED: Resolved in Chapter 9. Original: Reyes has laid a three-step cross-referencing trail from the M. Reyes name to Emily Voss's operational history, accessible via Level 4 credentials. Will Kain follow this trail? Reyes is certain he will — 'That is what terminal men do — they stop waiting for permission' — but the trail is designed to feel like Kain's own discovery. Will Kain recognize the manipulation, or will the discovery feel organic?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_emily_confrontation_outcome`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch7_5_20260525` (Source Ch: 7)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: Reyes predicts Kain will confront Emily about the journals. Two outcomes: she shows him (investigation accelerates, network benefits) or she doesn't (Kain becomes unpredictable, 'a different kind of asset'). Which path does Emily choose? The network benefits either way — but the consequences for Kain and Emily's relationship are radically different.
- **New Value:** RESOLVED: Resolved in Chapter 10. Original: Reyes predicts Kain will confront Emily about the journals. Two outcomes: she shows him (investigation accelerates, network benefits) or she doesn't (Kain becomes unpredictable, 'a different kind of asset'). Which path does Emily choose? The network benefits either way — but the consequences for Kain and Emily's relationship are radically different.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_thirty_jumps_accuracy`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch7_5_20260525` (Source Ch: 7)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: Reyes estimates Kain has thirty jumps left, but qualifies it: 'the medical literature was ambiguous on the precise conversion rate' and 'Probably enough.' The existing canon gives Kain two jumps left (per Emily's Ch 10 confrontation). The discrepancy between Reyes's thirty-jump estimate and Emily's two-jump figure is unresolved — is Reyes working from outdated data, or does Emily's figure account for something Reyes doesn't know?
- **New Value:** RESOLVED: Resolved in Chapter 10. Original: Reyes estimates Kain has thirty jumps left, but qualifies it: 'the medical literature was ambiguous on the precise conversion rate' and 'Probably enough.' The existing canon gives Kain two jumps left (per Emily's Ch 10 confrontation). The discrepancy between Reyes's thirty-jump estimate and Emily's two-jump figure is unresolved — is Reyes working from outdated data, or does Emily's figure account for something Reyes doesn't know?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_bell_departure_cascade_effect`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch8_20260525` (Source Ch: 8)
- **New Pass:** `backfill_ch12_20260525` (Source Ch: 12)
- **Old Value:** OPEN: Hayden's own calculations project full cascade within 14-20 jumps without anchor proximity. Bell is now actively planning departure. When she leaves, Hayden's remaining window collapses from 40-55 jumps to 14-20. Does Hayden detect the departure in time to recalculate, and what does he do when the anchor variable is gone?
- **New Value:** RESOLVED: Resolved in Chapter 12. Original: Hayden's own calculations project full cascade within 14-20 jumps without anchor proximity. Bell is now actively planning departure. When she leaves, Hayden's remaining window collapses from 40-55 jumps to 14-20. Does Hayden detect the departure in time to recalculate, and what does he do when the anchor variable is gone?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_emily_handler_complicity`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch8_20260525` (Source Ch: 8)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: Bell infers Emily approved operational parameters allowing Hayden to continue fieldwork at ICS 41 without mandatory disclosure to his partner. 'The QSA did not run operations like this without authorisation at the handling level, and Emily was the handler.' Bell has 'no direct evidence' but 'sufficient inference.' Did Emily knowingly allow Hayden's non-disclosure, and does this connect to her handling of Kain's concealed Bleed?
- **New Value:** RESOLVED: Resolved in Chapter 10. Original: Bell infers Emily approved operational parameters allowing Hayden to continue fieldwork at ICS 41 without mandatory disclosure to his partner. 'The QSA did not run operations like this without authorisation at the handling level, and Emily was the handler.' Bell has 'no direct evidence' but 'sufficient inference.' Did Emily knowingly allow Hayden's non-disclosure, and does this connect to her handling of Kain's concealed Bleed?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_folded_paper_contents`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch9_20260525` (Source Ch: 9)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: Kain retrieves the folded paper the replacement left on the tram seat and pockets it without unfolding it. Earlier, the paper from the tram target was blank — 'The target had left him nothing but the name, the warning, and the confidence that he would do the rest.' Is this the same paper? Does it now contain something, or is the act of retrieval itself the message — a signal to Emily via the Pelco array that Kain has chosen the replacement's side of the information?
- **New Value:** RESOLVED: Resolved in Chapter 10. Original: Kain retrieves the folded paper the replacement left on the tram seat and pockets it without unfolding it. Earlier, the paper from the tram target was blank — 'The target had left him nothing but the name, the warning, and the confidence that he would do the rest.' Is this the same paper? Does it now contain something, or is the act of retrieval itself the message — a signal to Emily via the Pelco array that Kain has chosen the replacement's side of the information?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_emily_fourteen_months_data`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch9_20260525` (Source Ch: 9)
- **New Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **Old Value:** OPEN: The replacement states Emily has fourteen months of data on what happens when a dormant PQ carrier encounters active Sphere entanglement — Kain's data. What has she done with it? Is this data the real purpose of Kain's recruitment, with the investigation as cover? Does the data relate to the network's interest in a dormant carrier with active Sphere exposure?
- **New Value:** RESOLVED: Resolved in Chapter 10. Original: The replacement states Emily has fourteen months of data on what happens when a dormant PQ carrier encounters active Sphere entanglement — Kain's data. What has she done with it? Is this data the real purpose of Kain's recruitment, with the investigation as cover? Does the data relate to the network's interest in a dormant carrier with active Sphere exposure?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_instrument_awareness`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch10_20260525` (Source Ch: 10)
- **New Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **Old Value:** OPEN: Kain now knows he is 'an instrument being calibrated for its twelfth use' — not an operative running an investigation. The CONV-PQ-GEN-549 file states his resonance signal is 340% cleaner than the median carrier and 'Projected deployment 12 is scheduled.' Who scheduled deployment 12, and what is its objective? Is the current investigation itself the twelfth deployment, or is deployment 12 a separate Sphere insertion?
- **New Value:** RESOLVED: Resolved in Chapter 11. Original: Kain now knows he is 'an instrument being calibrated for its twelfth use' — not an operative running an investigation. The CONV-PQ-GEN-549 file states his resonance signal is 340% cleaner than the median carrier and 'Projected deployment 12 is scheduled.' Who scheduled deployment 12, and what is its objective? Is the current investigation itself the twelfth deployment, or is deployment 12 a separate Sphere insertion?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_deployment_12_decision`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch11_20260525` (Source Ch: 11)
- **New Pass:** `backfill_ch12_20260525` (Source Ch: 12)
- **Old Value:** OPEN: Kain's tactical pivot was 'not a decision made in the room' but one made at the Fitzroy Library terminal. He has taken the journals and walked out. But deployment twelve is scheduled for Thursday and would complete the Sphere map. Does Kain intend to refuse deployment twelve, use it as leverage, or ultimately submit to it? 'Six percent remaining. One deployment.'
- **New Value:** RESOLVED: Resolved in Chapter 12. Original: Kain's tactical pivot was 'not a decision made in the room' but one made at the Fitzroy Library terminal. He has taken the journals and walked out. But deployment twelve is scheduled for Thursday and would complete the Sphere map. Does Kain intend to refuse deployment twelve, use it as leverage, or ultimately submit to it? 'Six percent remaining. One deployment.'
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_sep_null_decision`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch12_20260525` (Source Ch: 12)
- **New Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **Old Value:** OPEN: The chapter closes on Kain reviewing the transition coordinates, the 40-second window, the unsurvivable integration — and the phrase 'The instrument, deciding.' He has the journals, the coordinates, an ICS of 57 (above the 40 threshold), and approximately 49 minutes of power. Does Kain choose to enter the SEP-NULL? The chapter frames the decision without resolving it. 'Six journals on the floor containing fourteen months of his own degradation, recorded in blue ink by a woman who had designed the instrument for the specific task and had not accounted for the instrument deciding.'
- **New Value:** RESOLVED: Resolved in Chapter 15. Original: The chapter closes on Kain reviewing the transition coordinates, the 40-second window, the unsurvivable integration — and the phrase 'The instrument, deciding.' He has the journals, the coordinates, an ICS of 57 (above the 40 threshold), and approximately 49 minutes of power. Does Kain choose to enter the SEP-NULL? The chapter frames the decision without resolving it. 'Six journals on the floor containing fourteen months of his own degradation, recorded in blue ink by a woman who had designed the instrument for the specific task and had not accounted for the instrument deciding.'
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_fate_post_convergence`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch12_20260525` (Source Ch: 12)
- **New Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **Old Value:** OPEN: During the convergence event at the Sphere, Hayden is 'gone entirely' — subsumed by the Entrainment Plateau while holding the singularity steady. 'He was an Acceptable Loss. But he was the one who had chosen the moment.' Is Hayden dead, integrated into the Sphere's coherence structure, or in some other state? The text says 'the Sphere dead, and Hayden Marsh gone entirely' — but the subsequent Alfred Crescent scene shows Hayden alive in the chair. The chapter's timeline is non-linear: the Sphere scene and the safe house scene appear to be different temporal moments. What is the chronological relationship?
- **New Value:** RESOLVED: Resolved in Chapter 16. Original: During the convergence event at the Sphere, Hayden is 'gone entirely' — subsumed by the Entrainment Plateau while holding the singularity steady. 'He was an Acceptable Loss. But he was the one who had chosen the moment.' Is Hayden dead, integrated into the Sphere's coherence structure, or in some other state? The text says 'the Sphere dead, and Hayden Marsh gone entirely' — but the subsequent Alfred Crescent scene shows Hayden alive in the chair. The chapter's timeline is non-linear: the Sphere scene and the safe house scene appear to be different temporal moments. What is the chronological relationship?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_coordinates_use`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch12_5_20260525` (Source Ch: 12)
- **New Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **Old Value:** OPEN: Kain has encoded 847 SEP-NULL entry vector coordinates in working memory and verified them three times. He possesses the technical knowledge for the SEP-NULL protocol, and his ICS is above 40. The room no longer exists on the civic grid. 'The room did not exist. The coordinates did.' What does Kain do with the coordinates — attempt the SEP-NULL insertion, use them as leverage, or preserve them as evidence?
- **New Value:** RESOLVED: Resolved in Chapter 15. Original: Kain has encoded 847 SEP-NULL entry vector coordinates in working memory and verified them three times. He possesses the technical knowledge for the SEP-NULL protocol, and his ICS is above 40. The room no longer exists on the civic grid. 'The room did not exist. The coordinates did.' What does Kain do with the coordinates — attempt the SEP-NULL insertion, use them as leverage, or preserve them as evidence?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_hayden_post_power_cut`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch12_5_20260525` (Source Ch: 12)
- **New Pass:** `backfill_ch13_20260525` (Source Ch: 13)
- **Old Value:** OPEN: After the power cut, the room is absolutely dark, the civic grid no longer acknowledges the address, and Hayden's boundary drifts without pattern. Kain has the coordinates encoded. The chapter ends in stasis — 'The room did not exist. The coordinates did.' What happens next in the dark room? Does Kain leave, does Hayden's condition deteriorate further, or does the biophotonic field's entrainment reach its terminal point?
- **New Value:** RESOLVED: Resolved in Chapter 13. Original: After the power cut, the room is absolutely dark, the civic grid no longer acknowledges the address, and Hayden's boundary drifts without pattern. Kain has the coordinates encoded. The chapter ends in stasis — 'The room did not exist. The coordinates did.' What happens next in the dark room? Does Kain leave, does Hayden's condition deteriorate further, or does the biophotonic field's entrainment reach its terminal point?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_relay_bearing_operational_use`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch13_20260525` (Source Ch: 13)
- **New Pass:** `backfill_ch14_20260525` (Source Ch: 14)
- **Old Value:** OPEN: The relay's preserved field orientation points forty-seven degrees east of magnetic north toward the Sphere's primary entanglement locus fourteen metres below Alfred Hospital's eastern sublevel. Hayden identifies the freight lift (Schindler unit) as the existing QSA access infrastructure. Kain now has a compass bearing to the Sphere from outside the QSA's controlled access. Will he use the relay bearing and the freight lift to reach the Sphere independently, bypassing Emily's operational control?
- **New Value:** RESOLVED: Resolved in Chapter 14. Original: The relay's preserved field orientation points forty-seven degrees east of magnetic north toward the Sphere's primary entanglement locus fourteen metres below Alfred Hospital's eastern sublevel. Hayden identifies the freight lift (Schindler unit) as the existing QSA access infrastructure. Kain now has a compass bearing to the Sphere from outside the QSA's controlled access. Will he use the relay bearing and the freight lift to reach the Sphere independently, bypassing Emily's operational control?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_alfred_crescent_original_function`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch13_20260525` (Source Ch: 13)
- **New Pass:** `backfill_ch14_20260525` (Source Ch: 14)
- **Old Value:** OPEN: The Alfred Crescent building was an active QSA site with an entanglement relay calibrated to serve the Sphere. The relay was installed for 'whatever the site's original operational function had been.' What was the building's original QSA function? The relay's orientation toward the Sphere suggests it was part of the Sphere's operational infrastructure — a remote node, a monitoring station, or a carrier staging area. The function 'moved elsewhere' before decommissioning in 2094.
- **New Value:** RESOLVED: Resolved in Chapter 14. Original: The Alfred Crescent building was an active QSA site with an entanglement relay calibrated to serve the Sphere. The relay was installed for 'whatever the site's original operational function had been.' What was the building's original QSA function? The relay's orientation toward the Sphere suggests it was part of the Sphere's operational infrastructure — a remote node, a monitoring station, or a carrier staging area. The function 'moved elsewhere' before decommissioning in 2094.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_language_loss`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch14_20260525` (Source Ch: 14)
- **New Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **Old Value:** OPEN: Hayden has lost the capacity for language entirely, transmitting only as biophotonic frequency bursts — 'a nervous system that had lost the organisational capacity for language but retained the capacity for signal.' His tone carries direction and duration but no words. Is this loss permanent? Does it indicate his ICS has dropped below a threshold where language processing fails, and if so, what threshold? His last spoken words were in the plant room; now he communicates only through the field.
- **New Value:** RESOLVED: Resolved in Chapter 15. Original: Hayden has lost the capacity for language entirely, transmitting only as biophotonic frequency bursts — 'a nervous system that had lost the organisational capacity for language but retained the capacity for signal.' His tone carries direction and duration but no words. Is this loss permanent? Does it indicate his ICS has dropped below a threshold where language processing fails, and if so, what threshold? His last spoken words were in the plant room; now he communicates only through the field.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_sphere_chamber_next`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch14_20260525` (Source Ch: 14)
- **New Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **Old Value:** OPEN: Kain has entered the Sphere chamber with 312 coordinates remaining, a degrading correction technique, 19% buffer efficiency, and the Sphere hovering three metres in diameter. What does he do inside the chamber? The chapter ends at the threshold. Does he attempt the SEP-NULL protocol, use the Sphere for coordinate verification, or pursue something else entirely?
- **New Value:** RESOLVED: Resolved in Chapter 15. Original: Kain has entered the Sphere chamber with 312 coordinates remaining, a degrading correction technique, 19% buffer efficiency, and the Sphere hovering three metres in diameter. What does he do inside the chamber? The chapter ends at the threshold. Does he attempt the SEP-NULL protocol, use the Sphere for coordinate verification, or pursue something else entirely?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_inside_sphere`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch14_20260525` (Source Ch: 14)
- **New Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **Old Value:** OPEN: Hayden's tone transmits 'from the inside' of the Sphere's coherence structure — 'the sound of a man who had arrived at the coordinate that Kain was standing outside of.' Hayden appears to already be inside or integrated with the Sphere. How did he get there? When did he enter? His last known position was the plant room at Alfred Crescent. The chapter does not show his transit to the hospital or his entry into the Sphere.
- **New Value:** RESOLVED: Resolved in Chapter 15. Original: Hayden's tone transmits 'from the inside' of the Sphere's coherence structure — 'the sound of a man who had arrived at the coordinate that Kain was standing outside of.' Hayden appears to already be inside or integrated with the Sphere. How did he get there? When did he enter? His last known position was the plant room at Alfred Crescent. The chapter does not show his transit to the hospital or his entry into the Sphere.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_40_second_count_outcome`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **New Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **Old Value:** OPEN: The chapter ends with 'The 40-second window opened. Kain counted.' The count has begun but the chapter does not show whether Kain survives the 40 seconds, completes the resonance signature, or what happens to his neural architecture during integration. The SEP-NULL protocol is 'not survivable' per Article 9.6. Does Kain complete the count? What does the completed resonance signature produce?
- **New Value:** RESOLVED: Resolved in Chapter 16. Original: The chapter ends with 'The 40-second window opened. Kain counted.' The count has begun but the chapter does not show whether Kain survives the 40 seconds, completes the resonance signature, or what happens to his neural architecture during integration. The SEP-NULL protocol is 'not survivable' per Article 9.6. Does Kain complete the count? What does the completed resonance signature produce?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_wire_correction_exhaustion`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **New Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **Old Value:** OPEN: Kain has 54 corrections remaining for 312 coordinates — the arithmetic does not work. He 'filed the arithmetic and kept moving.' Did he verify all 312 coordinates before crossing the containment boundary, or did he cross with unverified coordinates? The chapter shows corrections at five, four, and three metres but does not confirm all 312 were verified before the threshold crossing.
- **New Value:** RESOLVED: Resolved in Chapter 16. Original: Kain has 54 corrections remaining for 312 coordinates — the arithmetic does not work. He 'filed the arithmetic and kept moving.' Did he verify all 312 coordinates before crossing the containment boundary, or did he cross with unverified coordinates? The chapter shows corrections at five, four, and three metres but does not confirm all 312 were verified before the threshold crossing.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_post_sphere_state`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **New Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **Old Value:** OPEN: Hayden is present in the Sphere's containment architecture as a biophotonic frequency — no longer a body but a signal entrained with the Sphere's field. He transmits through structural steel, not air. Is Hayden alive, dead, or integrated into the Sphere's coherence structure? His transmission carries identity architecture ('the need to know whether the instrument had decided') but no physical form is described. What is his state after Kain crosses the threshold?
- **New Value:** RESOLVED: Resolved in Chapter 16. Original: Hayden is present in the Sphere's containment architecture as a biophotonic frequency — no longer a body but a signal entrained with the Sphere's field. He transmits through structural steel, not air. Is Hayden alive, dead, or integrated into the Sphere's coherence structure? His transmission carries identity architecture ('the need to know whether the instrument had decided') but no physical form is described. What is his state after Kain crosses the threshold?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_dissipation_stopped`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **New Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **Old Value:** OPEN: At the 0.3-radii threshold, Kain's dissipation mechanism 'did not fail gradually. It stopped.' The binding sites are saturated at ten million times design capacity. With dissipation at zero, what happens to the coherence energy accumulating in his neural architecture during the 40-second window? The clinical file modelled saturation but not sustained zero-dissipation exposure.
- **New Value:** RESOLVED: Resolved in Chapter 16. Original: At the 0.3-radii threshold, Kain's dissipation mechanism 'did not fail gradually. It stopped.' The binding sites are saturated at ten million times design capacity. With dissipation at zero, what happens to the coherence energy accumulating in his neural architecture during the 40-second window? The clinical file modelled saturation but not sustained zero-dissipation exposure.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_fifth_notebook_wire_depletion`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch15_20260525` (Source Ch: 15)
- **New Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **Old Value:** OPEN: The wire coil on the fifth notebook — Emily's most recent six months of data — is Kain's only correction tool. It is a consumable resource approaching its end: 'the margin between the wire's remaining sharpness and the threshold pressure required to generate a correction-grade signal was narrowing.' If the wire fails inside the 40-second window, Kain loses the ability to correct transposed coordinates during the resonance event. Does the wire hold?
- **New Value:** RESOLVED: Resolved in Chapter 16. Original: The wire coil on the fifth notebook — Emily's most recent six months of data — is Kain's only correction tool. It is a consumable resource approaching its end: 'the margin between the wire's remaining sharpness and the threshold pressure required to generate a correction-grade signal was narrowing.' If the wire fails inside the 40-second window, Kain loses the ability to correct transposed coordinates during the resonance event. Does the wire hold?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_below_operational_floor`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Kain is now operating below the 19% buffer efficiency that Emily identified as the operational floor. 'He did not know what was below the floor. He was about to find out.' His left hand is permanently non-functional, his right hand trembles continuously, and his visual field is at ~60%. What capacity remains, and how long before the degradation renders him entirely non-functional?
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Kain is now operating below the 19% buffer efficiency that Emily identified as the operational floor. 'He did not know what was below the floor. He was about to find out.' His left hand is permanently non-functional, his right hand trembles continuously, and his visual field is at ~60%. What capacity remains, and how long before the degradation renders him entirely non-functional?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_hayden_state_post_discharge`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Hayden is 'gone, in the specific way that a frequency is gone when the last of its energy has been discharged.' Kain notes this is 'not the same as dead, which was not the same as anything he had a word for yet.' Is Hayden's pattern preserved within the Sphere's now-integrated lattice, or is he simply extinguished? The slightly warmer air is the only trace. Kain defers naming: 'He would find a word later.'
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Hayden is 'gone, in the specific way that a frequency is gone when the last of its energy has been discharged.' Kain notes this is 'not the same as dead, which was not the same as anything he had a word for yet.' Is Hayden's pattern preserved within the Sphere's now-integrated lattice, or is he simply extinguished? The slightly warmer air is the only trace. Kain defers naming: 'He would find a word later.'
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_left_hand_march_prediction`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Solis in the Bleed vision says 'You're going to lose the use of your left hand by March. I've read the progression charts. Emily sent them.' The left hand fails in this chapter during the buffer collapse. Was the March prediction accurate (is it currently March in the story timeline), or did the operational stress accelerate the loss ahead of the clinical projection?
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Solis in the Bleed vision says 'You're going to lose the use of your left hand by March. I've read the progression charts. Emily sent them.' The left hand fails in this chapter during the buffer collapse. Was the March prediction accurate (is it currently March in the story timeline), or did the operational stress accelerate the loss ahead of the clinical projection?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_map_closed_consequences`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: The 847-coordinate map is closed and the SEP-NULL threshold is stable. What does a closed map mean operationally? The map was the QSA's objective — does its closure end the replacement network threat, stabilise baseline reality permanently, or serve some other function? The chapter states the field stabilised but does not explain the strategic consequence.
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: The 847-coordinate map is closed and the SEP-NULL threshold is stable. What does a closed map mean operationally? The map was the QSA's objective — does its closure end the replacement network threat, stabilise baseline reality permanently, or serve some other function? The chapter states the field stabilised but does not explain the strategic consequence.
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_chromatic_aberration_permanent`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Kain's left-eye damage produces a permanent iridescent fringe — 'the specific optical signature of a PQ pathway that had been pushed past its structural limit and would not fully recover.' He catalogues it and sets it aside. Will this permanent visual impairment affect his ability to detect residue, read spaces, or perform his investigative method going forward?
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Kain's left-eye damage produces a permanent iridescent fringe — 'the specific optical signature of a PQ pathway that had been pushed past its structural limit and would not fully recover.' He catalogues it and sets it aside. Will this permanent visual impairment affect his ability to detect residue, read spaces, or perform his investigative method going forward?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

### Entry: `plot.loop_kain_next_move_post_alfred`
- **Namespace:** `plot`
- **Old Pass:** `backfill_ch16_20260525` (Source Ch: 16)
- **New Pass:** `backfill_epilogue_20260525` (Source Ch: 999)
- **Old Value:** OPEN: Kain exits the Alfred Hospital into cold Melbourne air with a dead lighter, a non-functional left hand, a trembling right hand, and degraded vision. He walks. Where is he going? The map is closed, Hayden is gone, and the case is 'not solved' but 'closed.' What does Kain do next — report to Emily, pursue the remaining investigation threads, or something else?
- **New Value:** RESOLVED: Resolved in Chapter 999. Original: Kain exits the Alfred Hospital into cold Melbourne air with a dead lighter, a non-functional left hand, a trembling right hand, and degraded vision. He walks. Where is he going? The map is closed, Hayden is gone, and the case is 'not solved' but 'closed.' What does Kain do next — report to Emily, pursue the remaining investigation threads, or something else?
- **Drift Analysis:** Resolution of open loop (EXPECTED / LOW DRIFT).

