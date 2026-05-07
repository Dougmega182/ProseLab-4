/**
 * VoiceProfileManager
 * UI for analyzing writing samples and managing style profiles.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { VoiceAnalyzer } from '../../engine/voice-analyzer.js';
import { ProviderManager } from '../../providers/index.js';
import { db } from '../../db/index.js';

const providerConfig = {
  openai: { apiKey: import.meta.env.VITE_OPENAI_KEY },
  anthropic: { apiKey: import.meta.env.VITE_ANTHROPIC_KEY },
  gemini: { apiKey: import.meta.env.VITE_GEMINI_KEY },
  ollama: { baseUrl: import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434' },
  modelAssignments: { analysis: 'gpt-4o' }
};

const providers = new ProviderManager(providerConfig);
const analyzer = new VoiceAnalyzer(providers);

export default function VoiceProfileManager({ projectId }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sampleText, setSampleText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  const refresh = useCallback(async () => {
    const p = await db.voiceProfiles.where('projectId').equals(projectId).toArray();
    setProfiles(p);
    
    const settings = await db.projectSettings.get(projectId);
    if (settings?.voiceProfileId) {
      setActiveProfileId(settings.voiceProfileId);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAnalyze = async () => {
    if (!sampleText.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzer.analyzeSample(sampleText);
      setAnalysisResult(result);
    } catch (e) {
      alert("Analysis failed: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveProfile = async (name) => {
    if (!analysisResult) return;

    const id = crypto.randomUUID();
    await db.voiceProfiles.add({
      id,
      projectId,
      name: name || `New Profile ${profiles.length + 1}`,
      profile: analysisResult.profile,
      metrics: analysisResult.metrics,
      signatureMoves: analysisResult.signatureMoves,
      avoidances: analysisResult.avoidances,
      examplePatterns: analysisResult.examplePatterns,
      createdAt: Date.now()
    });

    setAnalysisResult(null);
    setSampleText('');
    await refresh();
  };

  const handleSetActive = async (profileId) => {
    await db.projectSettings.update(projectId, { voiceProfileId: profileId });
    setActiveProfileId(profileId);
  };

  return (
    <div className="voice-manager">
      <div className="voice-manager-header">
        <h3>Authorial Voice Profiles</h3>
      </div>

      <div className="voice-profiles-list">
        {profiles.map(p => (
          <div key={p.id} className={`profile-card ${activeProfileId === p.id ? 'active' : ''}`}>
            <div className="profile-card-header">
              <strong>{p.name}</strong>
              <button 
                className={`btn btn-sm ${activeProfileId === p.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSetActive(p.id)}
              >
                {activeProfileId === p.id ? 'Active' : 'Set Active'}
              </button>
            </div>
            <p className="profile-excerpt">{p.profile.substring(0, 150)}...</p>
            <div className="profile-metrics-mini">
              <span>{p.metrics?.narrativeDistance} POV</span>
              <span>{p.metrics?.tense} tense</span>
              <span>{p.metrics?.avgSentenceLength} avg length</span>
            </div>
          </div>
        ))}
      </div>

      <div className="analyze-new-section">
        <h4>Analyze New Style Sample</h4>
        <textarea
          className="sample-input"
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder="Paste a 500-1000 word sample of your own prose here to build a style profile..."
          rows={10}
        />
        <div className="analyze-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleAnalyze} 
            disabled={analyzing || !sampleText.trim()}
          >
            {analyzing ? 'Analyzing Style...' : 'Analyze Sample'}
          </button>
        </div>

        {analysisResult && (
          <div className="analysis-result-preview">
            <h5>Style Analysis Results</h5>
            <div className="result-tabs">
              <div className="result-summary">
                <h6>Profile Description</h6>
                <p>{analysisResult.profile}</p>
              </div>
              <div className="result-metrics">
                <h6>Linguistic Metrics</h6>
                <ul>
                  {Object.entries(analysisResult.metrics).map(([k, v]) => (
                    <li key={k}><strong>{k}:</strong> {v}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => handleSaveProfile()}>Save this Profile</button>
          </div>
        )}
      </div>
    </div>
  );
}
