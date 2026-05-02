/**
 * ANCHORED EXEMPLARS
 * 
 * Stable definitions of quality that exist outside the current prompt context.
 * These are used as Few-Shot examples in the Critic and Generator prompts.
 */

export const STYLE_EXEMPLARS = [
  {
    bad: "He felt a sudden wave of sadness as he looked at the broken shards. It was a tragedy to see his favorite cup destroyed like that.",
    good: "He knelt by the white ceramic shards. His fingers brushed a sharp edge, drawing a bead of red. He gathered the pieces into a pile near the sink.",
    reason: "The 'good' version replaces abstract emotional labels ('sadness', 'tragedy') with physical interaction and sensory evidence (kneeling, brushing edges, drawing blood)."
  },
  {
    bad: "She was waiting for the phone to ring, feeling very anxious about the news she might receive.",
    good: "She sat at the edge of the desk, her eyes fixed on the silent smartphone. Each tick of the wall clock echoed in the quiet room. She wiped her palms on her jeans.",
    reason: "The 'good' version shows the passage of time and physical anxiety (eyes fixed, ticking clock, wiping palms) instead of naming the state ('waiting', 'anxious')."
  },
  {
    bad: "He secured the room, locking the door so he would feel safe for the night.",
    good: "He turned the heavy brass deadbolt until it clicked. He pushed against the frame with his shoulder, but the door held firm. He stepped back into the shadows of the room.",
    reason: "The 'good' version provides sensory proof of security (the click, the shoulder push) instead of abstract interpretation ('secured', 'feel safe')."
  }
];
