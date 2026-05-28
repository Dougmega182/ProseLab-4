// ReportDashboard.jsx — Main report UI for ProseLab V2
// Renders score ring, metric cards, insights, issue list, and compiled printable editorial reports

import React, { useMemo, useState } from 'react';
import { analyze } from '../engine/reports/index.js';

// ─── Score Ring (SVG) ────────────────────────────────────────

function ScoreRing({ score, size = 140, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#22c55e' :
    score >= 60 ? '#eab308' :
    score >= 40 ? '#f97316' : '#ef4444';

  const label =
    score >= 80 ? 'Exceptional' :
    score >= 60 ? 'Solid' :
    score >= 40 ? 'Needs Work' : 'Needs Revision';

  return (
    <div style={{
      width: size,
      height: size,
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a3d"
          strokeWidth={strokeWidth}
        />
        {/* Foreground arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.4s ease',
          }}
        />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color }}>{Math.round(score)}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── Category Progress Bar ───────────────────────────────────

function CategoryBar({ label, value, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color =
    pct >= 80 ? '#22c55e' :
    pct >= 60 ? '#eab308' :
    pct >= 40 ? '#f97316' : '#ef4444';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        marginBottom: 4,
        color: 'var(--text-secondary)',
      }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--bg-input)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 3,
          background: color,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────

function MetricCard({ icon, title, value, subtitle }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 10,
      padding: '16px 18px',
      minWidth: 140,
      flex: '1 1 140px',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

// ─── Insight Item ────────────────────────────────────────────

function InsightItem({ insight }) {
  const icons = { high: '🔴', medium: '🟡', low: '🔵', info: '💡', overall: '🎯' };
  const borderColors = { high: '#ef4444', medium: '#eab308', low: '#3b82f6', info: '#6366f1', overall: '#10b981' };

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderLeft: `4px solid ${borderColors[insight.severity] || '#6366f1'}`,
      borderRadius: '0 8px 8px 0',
      padding: '16px',
      marginBottom: 12,
      fontSize: 14,
      color: 'var(--text-primary)',
      lineHeight: 1.6,
      border: '1px solid var(--border-subtle)',
      borderLeftWidth: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 18 }}>{icons[insight.severity] || '💡'}</span>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 0.5 }}>
            {insight.category}
          </div>
          {insight.message}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ────────────────────────────────

export function ReportDashboard({ 
  report, 
  text, 
  chapters = [], 
  scenes = [], 
  activeProjectTitle = "Active Manuscript", 
  onFixIssue 
}) {
  const [viewMode, setViewMode] = useState('active-scene'); // 'active-scene' | 'compiled-report'
  const [activeTab, setActiveTab] = useState('overview');

  // Compilation Configurations
  const [reportSource, setReportSource] = useState('manuscript'); // 'manuscript' | 'drafts'
  const [selectedModes, setSelectedModes] = useState({
    ANALYSE: true,
    ENGINEER: true,
    MARKET: true,
    VERDICT: true
  });
  const [compiledReport, setCompiledReport] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);

  // 1. Resolve Single Active Scene Report
  const sceneReport = useMemo(() => {
    if (report && report.metrics && report.metrics.readability && report.metrics.readability.wordCount > 0) {
      return report;
    }
    return analyze(text);
  }, [report, text]);

  // 2. Compile All Editorial Persona Feedbacks
  const handleGenerateCompiledReport = () => {
    setIsCompiling(true);
    setTimeout(() => {
      // Filter chapters & scenes based on target source
      const filteredChapters = chapters.filter(c => reportSource === 'manuscript' ? !c.isDraft : c.isDraft);
      const filteredScenes = scenes.filter(s => reportSource === 'manuscript' ? !s.isDraft : s.isDraft);

      let totalWords = 0;
      let coveredScenes = 0;

      const compiledChapters = filteredChapters
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(chapter => {
          const chapterScenes = filteredScenes
            .filter(s => s.chapterId === chapter.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(scene => {
              const words = scene.text ? scene.text.trim().split(/\s+/).filter(Boolean).length : 0;
              totalWords += words;

              // Check mode feedback coverage
              let hasReview = false;
              const modes = ['ANALYSE', 'ENGINEER', 'MARKET', 'VERDICT'];
              modes.forEach(mode => {
                if (selectedModes[mode] && scene.modeFeedback && scene.modeFeedback[mode] && Object.keys(scene.modeFeedback[mode]).length > 0) {
                  hasReview = true;
                }
              });
              if (hasReview) coveredScenes += 1;

              return {
                id: scene.id,
                title: scene.title,
                wordCount: words,
                chars: scene.chars,
                objects: scene.objects,
                goal: scene.goal,
                conflict: scene.conflict,
                change: scene.change,
                modeFeedback: scene.modeFeedback || { ANALYSE: {}, ENGINEER: {}, MARKET: {}, VERDICT: {} }
              };
            });

          return {
            id: chapter.id,
            title: chapter.title,
            scenes: chapterScenes
          };
        })
        .filter(chapter => chapter.scenes.length > 0); // Keep only chapters with scenes

      setCompiledReport({
        source: reportSource,
        stats: {
          totalChapters: compiledChapters.length,
          totalScenes: filteredScenes.length,
          totalWords,
          avgWords: filteredScenes.length > 0 ? Math.round(totalWords / filteredScenes.length) : 0,
          coveredScenes
        },
        chapters: compiledChapters
      });
      setIsCompiling(false);
    }, 600); // Premium visual loader duration
  };

  const handleExportCompiledReportToMD = () => {
    if (!compiledReport) return;
    const { source, stats, chapters } = compiledReport;

    let md = `# ProseLab V4 Editorial Compilation Report\n\n`;
    md += `**Project:** ${activeProjectTitle}\n`;
    md += `**Source:** ${source === 'manuscript' ? 'Manuscript Main Tree' : 'Editorial Drafts Tree'}\n`;
    md += `**Generated on:** ${new Date().toLocaleString('en-AU')}\n\n`;

    md += `## Summary Statistics\n`;
    md += `- **Total Chapters:** ${stats.totalChapters}\n`;
    md += `- **Total Scenes:** ${stats.totalScenes}\n`;
    md += `- **Total Word Count:** ${stats.totalWords} words\n`;
    md += `- **Average Scene Length:** ${stats.avgWords} words\n`;
    md += `- **Persona Coverage:** ${stats.coveredScenes} / ${stats.totalScenes} scenes reviewed\n\n`;
    md += `---\n\n`;

    for (const chapter of chapters) {
      md += `# CHAPTER: ${chapter.title}\n\n`;
      for (const scene of chapter.scenes) {
        md += `## Scene: ${scene.title || "Untitled Scene"}\n`;
        md += `- **Word Count:** ${scene.wordCount} words\n`;
        if (scene.chars) md += `- **Characters Present:** ${scene.chars}\n`;
        if (scene.objects) md += `- **Props Planted:** ${scene.objects}\n`;
        if (scene.goal) md += `- **Protagonist Goal:** ${scene.goal}\n`;
        if (scene.conflict) md += `- **Scene Obstacle:** ${scene.conflict}\n`;
        if (scene.change) md += `- **Irreversible Change:** ${scene.change}\n`;
        md += `\n`;

        let hasFeedback = false;
        const modes = ['ANALYSE', 'ENGINEER', 'MARKET', 'VERDICT'];

        for (const mode of modes) {
          const feedback = scene.modeFeedback[mode];
          if (selectedModes[mode] && feedback && Object.keys(feedback).length > 0) {
            hasFeedback = true;
            md += `### [Mode Review: ${mode}]\n\n`;
            for (const [persona, text] of Object.entries(feedback)) {
              const rawText = typeof text === 'object' ? (text.rawFeedback || text.content || JSON.stringify(text)) : text;
              md += `#### Persona: ${persona.toUpperCase()}\n`;
              md += `> ${rawText.split('\n').join('\n> ')}\n\n`;
            }
          }
        }

        if (!hasFeedback) {
          md += `*No editorial reviews run for this scene yet.*\n\n`;
        }
        md += `---\n\n`;
      }
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeTitle = activeProjectTitle.toLowerCase().replace(/\s+/g, '-');
    link.setAttribute("download", `editorial-report-${safeTitle}-${source}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintCompiledReport = () => {
    window.print();
  };

  return (
    <div className="report-dashboard" style={{ padding: 24, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Dynamic Style Injection for PDF/Printing and General Layout */}
      <style>{`
        .toggle-tab-btn {
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .toggle-tab-btn.active {
          background: var(--accent-primary);
          color: #fff;
        }

        .config-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .config-row {
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .config-section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-muted);
          margin-bottom: 8px;
          font-weight: 700;
        }

        .radio-box {
          border: 1px solid var(--border-subtle);
          background: var(--bg-primary);
          border-radius: 8px;
          padding: 12px 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .radio-box.active {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          background: var(--bg-card-hover);
          box-shadow: 0 0 10px var(--accent-glow);
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .checkbox-item input {
          cursor: pointer;
          accent-color: var(--accent-primary);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .stat-val {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .report-preview-box {
          background: var(--bg-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 40px;
          max-height: 500px;
          overflow-y: auto;
          color: var(--text-primary);
          font-family: 'Outfit', sans-serif;
          line-height: 1.7;
        }

        .report-chapter-title {
          border-bottom: 2px solid var(--border-subtle);
          padding-bottom: 8px;
          margin-top: 36px;
          margin-bottom: 24px;
          color: var(--text-primary);
          font-size: 20px;
          font-weight: 700;
        }

        .report-scene-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .report-scene-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
        }

        .report-blockquote {
          background: var(--bg-secondary);
          border-left: 3px solid var(--accent-primary);
          padding: 12px 18px;
          margin: 12px 0;
          font-size: 13.5px;
          color: var(--text-secondary);
          font-style: italic;
          border-radius: 0 6px 6px 0;
        }

        .report-print-header {
          display: none;
        }

        .reader-btn {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-primary);
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .reader-btn:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-active);
          color: var(--text-accent);
        }

        /* PRINTING MEDIA INJECTIONS */
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          body > *:not(.report-dashboard) {
            display: none !important;
          }
          .report-dashboard {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #fff !important;
            color: #000 !important;
            display: block !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .report-print-header {
            display: block !important;
            margin-bottom: 40px !important;
            font-family: 'Outfit', sans-serif !important;
          }
          .report-print-header h1 {
            font-size: 26pt !important;
            color: #000 !important;
            margin: 0 0 10px 0 !important;
          }
          .report-preview-box {
            overflow-y: visible !important;
            max-height: none !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            color: #000 !important;
          }
          .report-scene-card {
            background: #fff !important;
            border: 1px solid #bbb !important;
            color: #000 !important;
            page-break-inside: avoid !important;
            margin-bottom: 30px !important;
            box-shadow: none !important;
          }
          .report-scene-title {
            color: #000 !important;
            border-bottom: 1px solid #bbb !important;
            padding-bottom: 6px !important;
          }
          .report-blockquote {
            background: #f9f9f9 !important;
            border-left: 3px solid #000 !important;
            color: #111 !important;
          }
          .report-chapter-title {
            color: #000 !important;
            border-bottom: 2px solid #000 !important;
            page-break-before: always !important;
            margin-top: 40px !important;
          }
          .reader-pill {
            border: 1px solid #777 !important;
            color: #222 !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* Top Selector Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, borderBottom: '1px solid #202035', paddingBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #fff 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'Outfit' }}>
          PROSELAB WORKSTATION REPORTS
        </h2>
        <div style={{ background: '#10101e', padding: '4px', borderRadius: '8px', border: '1px solid #202038', display: 'flex', gap: '4px' }}>
          <button 
            className={`toggle-tab-btn ${viewMode === 'active-scene' ? 'active' : ''}`}
            onClick={() => setViewMode('active-scene')}
          >
            Active Scene Analysis
          </button>
          <button 
            className={`toggle-tab-btn ${viewMode === 'compiled-report' ? 'active' : ''}`}
            onClick={() => setViewMode('compiled-report')}
          >
            Editorial Compilation Report
          </button>
        </div>
      </div>

      {/* ─── VIEW 1: ACTIVE SCENE ANALYSIS ──────────────────────── */}
      {viewMode === 'active-scene' && (
        <div className="no-print">
          {(!sceneReport || !sceneReport.metrics.readability || sceneReport.metrics.readability.wordCount === 0) ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>📝</div>
              <h3 style={{ color: '#e5e7eb', marginBottom: 8 }}>Ready for Analysis</h3>
              <p>Your manuscript will be analyzed in real-time as you write.</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 32, borderBottom: '1px solid #2a2a3d' }}>
                {['overview', 'insights', 'issues'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '12px 4px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                      color: activeTab === tab ? '#fff' : '#6b7280',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  <div style={{ display: 'flex', gap: 40, marginBottom: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ScoreRing score={sceneReport.score.overall} />
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <CategoryBar label="Readability" value={sceneReport.score.breakdown.readability} />
                      <CategoryBar label="Flow & Rhythm" value={sceneReport.score.breakdown.flow} />
                      <CategoryBar label="Prose Style" value={sceneReport.score.breakdown.style} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
                    <MetricCard icon="📊" title="Words" value={sceneReport.metrics.readability.wordCount} subtitle={`${sceneReport.metrics.readability.sentenceCount} sentences`} />
                    <MetricCard icon="🎓" title="Grade Level" value={sceneReport.metrics.readability.gradeLevel} subtitle="FK Grade Level" />
                    <MetricCard icon="💧" title="Glue Index" value={sceneReport.metrics.style.glueIndex} subtitle={sceneReport.metrics.style.glueIndex > 0.4 ? "Sticky" : "Lean"} />
                    <MetricCard icon="🌊" title="Rhythm" value={sceneReport.metrics.flow.rhythmScore} subtitle="Variety Score" />
                  </div>
                </>
              )}

              {activeTab === 'insights' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  {sceneReport.insights.map((insight, idx) => (
                    <InsightItem key={idx} insight={insight} />
                  ))}
                </div>
              )}

              {activeTab === 'issues' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sceneReport.issues.map((issue, idx) => (
                      <div key={idx} style={{
                        background: '#1a1a2e',
                        padding: '16px 20px',
                        borderRadius: 12,
                        border: '1px solid #2a2a3d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ 
                              fontSize: 10, 
                              fontWeight: 700, 
                              padding: '3px 8px', 
                              borderRadius: 4, 
                              background: issue.severity === 'high' ? '#450a0a' : '#1f1f2e',
                              color: issue.severity === 'high' ? '#f87171' : '#9ca3af',
                              border: `1px solid ${issue.severity === 'high' ? '#991b1b' : '#374151'}`,
                              letterSpacing: 0.5
                            }}>
                              {issue.type.replace('-', ' ').toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 600, color: '#f3f4f6' }}>{issue.text}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>{issue.message}</div>
                        </div>
                        
                        {onFixIssue && (
                          <button 
                            onClick={() => onFixIssue(issue)}
                            className="btn-spark"
                            style={{
                              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                              border: 'none',
                              padding: '10px 18px',
                              borderRadius: 8,
                              color: 'white',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                              transition: 'transform 0.2s'
                            }}
                          >
                            <span>✨</span> Fix with AI
                          </button>
                        )}
                      </div>
                    ))}
                    {sceneReport.issues.length === 0 && (
                      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', border: '2px dashed #2a2a3d', borderRadius: 12 }}>
                        Your prose is remarkably clean. No issues found!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── VIEW 2: COMPILED EDITORIAL REPORT ───────────────────── */}
      {viewMode === 'compiled-report' && (
        <div>
          {/* Printable Document Title (Only rendered during print) */}
          <div className="report-print-header">
            <h1>Editorial Compilation Report</h1>
            <div style={{ fontSize: '11pt', color: '#444' }}>
              <strong>Project:</strong> {activeProjectTitle} &bull; 
              <strong>Source:</strong> {compiledReport?.source === 'manuscript' ? "Main Book Manuscript" : "WIP Editorial Drafts"} &bull;
              <strong>Printed:</strong> {new Date().toLocaleDateString('en-AU')}
            </div>
            <hr />
          </div>

          {/* Config Panel (Hidden during Print) */}
          <div className="config-card no-print">
            <h4 style={{ fontSize: '14px', margin: '0 0 16px 0', fontFamily: 'Outfit' }}>Configure compilation target</h4>
            
            <div className="config-row">
              <div style={{ flex: '1 1 240px' }}>
                <div className="config-section-title">Select Source</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div 
                    className={`radio-box ${reportSource === 'manuscript' ? 'active' : ''}`}
                    onClick={() => { setReportSource('manuscript'); setCompiledReport(null); }}
                  >
                    <span>📖</span> Manuscript (Main Book)
                  </div>
                  <div 
                    className={`radio-box ${reportSource === 'drafts' ? 'active' : ''}`}
                    onClick={() => { setReportSource('drafts'); setCompiledReport(null); }}
                  >
                    <span>📝</span> WIP Drafts
                  </div>
                </div>
              </div>

              <div style={{ flex: '2 1 300px' }}>
                <div className="config-section-title">Selective Review Modes</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {['ANALYSE', 'ENGINEER', 'MARKET', 'VERDICT'].map(m => (
                    <label key={m} className="checkbox-item">
                      <input 
                        type="checkbox" 
                        checked={selectedModes[m]} 
                        onChange={() => {
                          setSelectedModes(prev => ({ ...prev, [m]: !prev[m] }));
                          setCompiledReport(null);
                        }}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button 
              className="btn-spark" 
              onClick={handleGenerateCompiledReport}
              disabled={isCompiling}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                padding: '12px 28px',
                borderRadius: 8,
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.2s',
                opacity: isCompiling ? 0.6 : 1
              }}
            >
              {isCompiling ? "Compiling Persona Feedbacks..." : "⚡ Generate Compilation Report"}
            </button>
          </div>

          {/* Compiled Output Section */}
          {compiledReport ? (
            <div>
              {/* Aggregated Summary Stats (Hidden during Print) */}
              <div className="stats-grid no-print">
                <div className="stat-card">
                  <div className="stat-label">Processed Chapters</div>
                  <div className="stat-val">{compiledReport.stats.totalChapters}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Processed Scenes</div>
                  <div className="stat-val">{compiledReport.stats.totalScenes}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Words</div>
                  <div className="stat-val">{compiledReport.stats.totalWords.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Average Scene Wordcount</div>
                  <div className="stat-val">{compiledReport.stats.avgWords}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #22c55e' }}>
                  <div className="stat-label">Reviewed Scene Coverage</div>
                  <div className="stat-val">{compiledReport.stats.coveredScenes} / {compiledReport.stats.totalScenes}</div>
                </div>
              </div>

              {/* Action Buttons (Hidden during Print) */}
              <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button 
                  className="reader-btn" 
                  onClick={handlePrintCompiledReport}
                >
                  🖨️ Print Report
                </button>
                <button 
                  className="reader-btn" 
                  onClick={handleExportCompiledReportToMD}
                >
                  📥 Export as MD
                </button>
                <button 
                  className="reader-btn" 
                  onClick={() => setCompiledReport(null)}
                  style={{ background: 'transparent', border: '1px solid #c026d3', color: '#c026d3' }}
                >
                  ❌ Reset Report
                </button>
              </div>

              {/* The Compiled Report Preview */}
              <div className="report-preview-box">
                {compiledReport.chapters.map(chapter => (
                  <div key={chapter.id}>
                    <div className="report-chapter-title">
                      CHAPTER: {chapter.title}
                    </div>
                    {chapter.scenes.map(scene => {
                      let hasFeedback = false;
                      const activeModes = ['ANALYSE', 'ENGINEER', 'MARKET', 'VERDICT'];

                      return (
                        <div key={scene.id} className="report-scene-card">
                          <div className="report-scene-title">
                            <span>Scene: {scene.title || "Untitled Scene"}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'normal' }}>
                              {scene.wordCount} words
                            </span>
                          </div>

                          {/* Context Tags */}
                          <div className="reader-meta-pills" style={{ margin: '12px 0', borderBottom: 'none', paddingBottom: 0 }}>
                            {scene.chars && <span className="reader-pill">👤 Chars: {scene.chars}</span>}
                            {scene.objects && <span className="reader-pill">🔑 Props: {scene.objects}</span>}
                            {scene.goal && <span className="reader-pill">🎯 Goal: {scene.goal}</span>}
                            {scene.conflict && <span className="reader-pill">⚠️ Obstacle: {scene.conflict}</span>}
                            {scene.change && <span className="reader-pill">🔄 Shift: {scene.change}</span>}
                          </div>

                          {/* Render reviews */}
                          {activeModes.map(mode => {
                            const feedback = scene.modeFeedback[mode];
                            if (selectedModes[mode] && feedback && Object.keys(feedback).length > 0) {
                              hasFeedback = true;
                              return (
                                <div key={mode} style={{ marginTop: '16px' }}>
                                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#818cf8', fontWeight: 700 }}>
                                    Review Mode: {mode}
                                  </div>
                                  {Object.entries(feedback).map(([persona, item]) => {
                                    const rawText = typeof item === 'object' ? (item.rawFeedback || item.content || JSON.stringify(item)) : item;
                                    return (
                                      <div key={persona} style={{ marginLeft: '12px', marginTop: '8px' }}>
                                        <div style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600 }}>
                                          Persona: {persona.toUpperCase()}
                                        </div>
                                        <div className="report-blockquote">
                                          {rawText.split('\n').map((line, lIdx) => (
                                            <div key={lIdx} style={{ marginBottom: '6px' }}>{line}</div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          })}

                          {!hasFeedback && (
                            <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic', marginTop: '12px' }}>
                              *No editorial reviews run for this scene yet.*
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {compiledReport.chapters.length === 0 && (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280' }}>
                    📖 No matching scenes found. Write some chapters and scenes or select drafts.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-print" style={{ padding: '80px 24px', textAlign: 'center', border: '2px dashed #202038', borderRadius: '12px' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚡</div>
              <h3 style={{ color: '#fff', marginBottom: '8px' }}>Ready to Compile Editorial Report</h3>
              <p style={{ color: '#6b7280', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
                Generate a unified review compilation report collating all AI persona feedback inputs (Margaret, Rafael, and other editors) across the entire book manuscript or drafts.
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn-spark:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
}
