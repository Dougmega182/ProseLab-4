/**
 * Voice Analyzer
 * Analyzes writing samples to extract authorial voice fingerprints.
 * Supports incremental refinement based on user feedback and persistent storage.
 */

export class VoiceAnalyzer {
  constructor(db, llm) {
    this.db = db;
    this.llm = llm;
  }

  async analyzeAndBuildProfile(projectId, samples) {
    if (!samples || samples.length === 0) {
      throw new Error('At least one writing sample is required');
    }

    // Combine samples, truncating if necessary
    const maxSampleChars = 15000;
    let combinedSamples = '';

    for (const sample of samples) {
      if (combinedSamples.length + sample.length > maxSampleChars) {
        const remaining = maxSampleChars - combinedSamples.length;
        if (remaining > 500) {
          combinedSamples += '\n\n---\n\n' + sample.slice(0, remaining);
        }
        break;
      }
      combinedSamples += (combinedSamples ? '\n\n---\n\n' : '') + sample;
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert literary analyst specializing in authorial voice. Analyze the provided writing samples and produce a detailed voice profile that could be used to guide an AI in replicating this writing style.

Your analysis should cover:

1. **Sentence Structure**: Average sentence length, variation patterns, use of fragments, complex vs. simple sentences, use of subordinate clauses
2. **Paragraph Structure**: Length tendencies, how paragraphs open and close, transition patterns
3. **Diction**: Vocabulary level (literary, conversational, sparse, ornate), favored word types, any distinctive word choices
4. **Narrative Distance**: Close/deep POV vs. distant, how interiority is handled, balance of showing vs. telling
5. **Dialogue Style**: Tag usage (said vs. alternatives), action beats, dialect/voice differentiation, ratio of dialogue to narration
6. **Sensory Detail**: Which senses are favored, density of sensory language, how setting is woven in
7. **Pacing**: Scene vs. summary balance, how time transitions are handled, action sequence pacing
8. **Figurative Language**: Frequency and type of metaphor/simile, any recurring imagery patterns
9. **Tone & Mood**: Overall emotional register, use of humor/irony, darkness/lightness
10. **Distinctive Habits**: Any unique stylistic tics, recurring patterns, signature moves

Produce the profile as a structured document that could serve as a style guide. Be specific and cite brief examples from the text where possible. Format as clear prose instructions, not a checklist.`
      },
      {
        role: 'user',
        content: `Analyze these writing samples and produce a voice profile:\n\n${combinedSamples}`
      }
    ];

    const result = await this.llm.chat(messages, {
      purpose: 'analysis',
      temperature: 0.4,
      max_tokens: 2000
    });

    const profile = {
      id: crypto.randomUUID(),
      projectId,
      content: result.content,
      sampleCount: samples.length,
      sampleCharCount: combinedSamples.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store the profile
    const existing = await this.db.voiceProfiles
      .where('projectId').equals(projectId)
      .first();

    if (existing) {
      await this.db.voiceProfiles.update(existing.id, {
        content: profile.content,
        sampleCount: profile.sampleCount,
        sampleCharCount: profile.sampleCharCount,
        updatedAt: profile.updatedAt
      });
      profile.id = existing.id;
    } else {
      await this.db.voiceProfiles.add(profile);
    }

    return profile;
  }

  async getProfile(projectId) {
    return this.db.voiceProfiles
      .where('projectId').equals(projectId)
      .first();
  }

  async refineProfile(projectId, feedback) {
    const existing = await this.getProfile(projectId);
    if (!existing) {
      throw new Error('No existing voice profile to refine');
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert literary analyst. You previously created a voice profile for a writer. The writer has provided feedback on what needs adjustment. Revise the profile accordingly, keeping everything that wasn't mentioned as needing change.`
      },
      {
        role: 'user',
        content: `Current voice profile:\n\n${existing.content}\n\n---\n\nFeedback and adjustments needed:\n\n${feedback}\n\nPlease produce the revised voice profile.`
      }
    ];

    const result = await this.llm.chat(messages, {
      purpose: 'analysis',
      temperature: 0.4,
      max_tokens: 2000
    });

    await this.db.voiceProfiles.update(existing.id, {
      content: result.content,
      updatedAt: new Date().toISOString()
    });

    return {
      ...existing,
      content: result.content,
      updatedAt: new Date().toISOString()
    };
  }

  async deleteProfile(projectId) {
    const existing = await this.getProfile(projectId);
    if (existing) {
      await this.db.voiceProfiles.delete(existing.id);
    }
  }
}
