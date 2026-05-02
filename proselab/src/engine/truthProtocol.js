export const TruthProtocol = {
  schema: {
    trace_id: "string",
    verdict: "APPROVE | REWRITE",
    reasoning_trace: "string", 
    ambiguity_score: "number (0-1)", // 0 = Certain, 1 = Impossible to agree
    grounding_status: "PASS | FAIL", 
    annotators: [
       { id: "string", verdict: "APPROVE | REWRITE" }
    ],
    adjudicator: { id: "string", verdict: "APPROVE | REWRITE", reasoning: "string" }
  },
  
  getGoldVerdict(sample) {
    if (sample.adjudicator?.verdict) return sample.adjudicator.verdict;
    return sample.annotators[0].verdict; // Fallback to first if no conflict
  },

  calculateWeight(sample) {
    // We weight the evaluation by how much humans agree on the truth.
    // If ambiguity is 1.0, the weight is 0.
    return 1 - (sample.ambiguity_score || 0);
  }
};

export const DISAGREEMENT_CLASSES = {
  ENTITY_MISMATCH: "ENTITY_MISMATCH",       // Mapping of roles differs
  DELIVERY_AMBIGUITY: "DELIVERY_AMBIGUITY", // Visibility of intent differs
  EXTRACTION_FAILURE: "EXTRACTION_FAILURE", // Mismatch in event extraction spans
  SCORE_VARIANCE: "SCORE_VARIANCE",         // Difference in stylistic scores
  LOGIC_CONFLICT: "LOGIC_CONFLICT"          // Difference in invariant reasoning
};
