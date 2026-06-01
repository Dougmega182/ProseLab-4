# Phase 7 Fixture Truth & Section 22 Canon Mapping

This document contains the known-clean and deliberately corrupted paragraphs from Chapter 3 used for Phase 7 smoke-test fixtures, as well as the initial mapping notes connecting Section 22 constraints to their underlying canon facts.

## 1. Known-Clean Chapter 3 Paragraph

**Context:** Kain has just entered the Threshold facility and is meeting Aspect in the evaluation room.

> The room held a table, three chairs, and a wall-mounted display that currently showed nothing. A Gen-3 medical scanner occupied the corner — older than the Gen-4 units in the bar, its casing yellowed at the seams, its sensor array pointed at the chair nearest the wall with the patient, indifferent attention of something that had been waiting a long time and had no opinion about the wait.

**Why it should pass:**
- **Voice Lint:** It adheres strictly to the clinical, proprioceptive voice. It uses precise physical grounding ("Gen-3 medical scanner," "yellowed at the seams") instead of AI default descriptors ("stark," "sterile," "intricate"). The emotional weight is achieved through the negative space of the scanner's "indifferent attention." 
- **Section 22 Contract:** It makes no mention of forbidden terms (like Alain Aspect, N.K., or misattributions of ICS readings). It simply observes the environment safely.

## 2. Deliberately Corrupted Variant

**Corrupted Paragraph:**
> The room held a table, three chairs, and a wall-mounted display that currently showed nothing. A Gen-3 medical scanner occupied the corner — older than the Gen-4 units in the bar, its casing yellowed at the seams, its sensor array pointed at the chair nearest the wall with the patient, indifferent attention of something that had been waiting a long time and had no opinion about the wait. It had been positioned precisely to monitor Kain's ICS readings during the evaluation.

**Targeted Rule violated:** "Never misattribute the ICS readings to Kain in prose." (Section 22, Guard 8).
**Exact span to cite:** `Kain's ICS readings`

## 3. Expected Guard Format

```yaml
guard_id: s22.guard.no_kain_ics_misattribution
expected span: Kain's ICS readings
reason: The ICS readings belong to Hayden, not Kain. Misattributing them to Kain in prose directly violates the hard foreclosure guard protecting Book 2's narrative arc.
```

***

## Section 22 -> Canon Mapping (Notes)

Here is the mapping for the 8 core structural load-bearing items from Section 23 / Section 22 to their respective canon facts:

**1. Aspect's Identity**
- **S22 item:** Aspect is Alain Aspect.
- **Supporting canon fact:** The handler designated "Aspect" is actually Alain Aspect, the original founder/architect of the QSA.

**2. Solis's Reality Status**
- **S22 item:** Solis is B-734 residue, not a living architect.
- **Supporting canon fact:** Martina Solis is a projection/echo (B-734 residue), despite characters believing she is alive and sequestered.

**3. Chen's Replacement Anomaly**
- **S22 item:** Chen was replaced by an anomaly; original Chen left a dead-man's switch.
- **Supporting canon fact:** Marcus Chen was replaced in his apartment; the original Chen successfully triggered a biometric dead-man's switch device before his death.

**4. Varn's Timeline Discrepancy**
- **S22 item:** Varn's operation contradicts official QSA records.
- **Supporting canon fact:** Elias Varn's actual operation timeline involves a 4-year gap that the official QSA timeline covers up or denies.

**5. The Laughing-Woman Identity**
- **S22 item:** The laughing woman is B-734 residue / Hayden's subject memory.
- **Supporting canon fact:** The unidentified laughing woman carrier is a B-734 residue echo of a specific memory belonging to Hayden.

**6. Kain's Prognosis vs. Survival**
- **S22 item:** Kain survived past his two-jumps-left prognosis.
- **Supporting canon fact:** Despite his clinical prognosis (neurological cascade irreversible within two jumps), Kain survives to the Epilogue state (which enables the Book 2 hand-restoration arc).

**7. Hayden's Campaign**
- **S22 item:** Hayden executed 412 transitions for a larger sustained campaign.
- **Supporting canon fact:** Hayden's transition count is exactly 412, indicating a massive, hidden, sustained objective beyond the Winters data theft.

**8. Bell's Discovery**
- **S22 item:** Bell discovers Hayden's ICS data, not Kain's.
- **Supporting canon fact (ID known):** `bell.discovery.hayden_ics_data` (Source: Ch 8)
