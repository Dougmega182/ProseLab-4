import React, { useEffect } from "react";

export function FullPageReader({ scene, onClose }) {
  // Global Escape-key listener to close the modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!scene) return null;

  // Calculate statistics
  const wordCount = scene.text ? scene.text.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // ~200 WPM average reading speed

  const handlePrint = () => {
    window.print();
  };

  const handleExportToMD = () => {
    const title = scene.title || "Untitled Scene";
    let md = `# ${title}\n\n`;
    if (scene.chars) md += `**Characters Present:** ${scene.chars}\n`;
    if (scene.objects) md += `**Props Planted:** ${scene.objects}\n`;
    if (scene.goal) md += `**Goal:** ${scene.goal}\n`;
    if (scene.conflict) md += `**Conflict:** ${scene.conflict}\n`;
    if (scene.change) md += `**Irreversible Change:** ${scene.change}\n`;
    md += `\n---\n\n`;
    md += scene.text || "*No text content.*";

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeTitle = title.toLowerCase().replace(/\s+/g, "-");
    link.setAttribute("download", `${safeTitle}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="full-page-reader-overlay">
      {/* Dynamic Style Injection for Perfect CSS Prints */}
      <style>{`
        .full-page-reader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: var(--bg-primary);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          color: var(--text-primary);
          animation: readerFadeIn 0.25s ease-out;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .reader-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 40px;
          border-bottom: 1px solid var(--border-subtle);
          background-color: var(--bg-secondary);
        }

        .reader-header-left h2 {
          margin: 4px 0 0 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: 'Outfit', sans-serif;
        }

        .reader-header-left span {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          font-weight: 700;
        }

        .reader-actions {
          display: flex;
          gap: 12px;
          align-items: center;
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

        .reader-close {
          font-size: 22px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          cursor: pointer;
          margin-left: 12px;
          transition: all 0.2s;
        }

        .reader-close:hover {
          background: #ef4444;
          color: #fff;
          border-color: #f87171;
        }

        .reader-body {
          flex: 1;
          overflow-y: auto;
          padding: 60px 24px;
          display: flex;
          justify-content: center;
        }

        .reader-content-lane {
          max-width: 700px;
          width: 100%;
          line-height: 1.85;
          font-size: 18px;
          color: var(--text-primary);
          font-family: 'Outfit', 'Inter', system-ui, sans-serif;
          letter-spacing: -0.1px;
        }

        .reader-meta-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 40px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .reader-pill {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .reader-content-lane p {
          margin-bottom: 24px;
          text-align: justify;
        }

        .reader-content-lane p:first-of-type {
          font-size: 20px;
          color: var(--text-primary);
          font-weight: 500;
          line-height: 1.7;
        }

        .reader-print-title {
          display: none;
        }

        @keyframes readerFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        /* Pure High-Fidelity Printing Overrides */
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          body > *:not(.full-page-reader-overlay) {
            display: none !important;
          }
          .full-page-reader-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            color: #000 !important;
            display: block !important;
          }
          .reader-header {
            display: none !important;
          }
          .reader-body {
            padding: 0 !important;
            overflow: visible !important;
          }
          .reader-content-lane {
            color: #000 !important;
            font-size: 12pt !important;
            line-height: 1.6 !important;
            max-width: 100% !important;
          }
          .reader-content-lane p {
            color: #000 !important;
            text-align: justify;
            orphans: 3;
            widows: 3;
          }
          .reader-content-lane p:first-of-type {
            font-size: 13pt !important;
            color: #000 !important;
            font-weight: 700 !important;
          }
          .reader-pill {
            border: 1px solid #666 !important;
            color: #333 !important;
            background: transparent !important;
          }
          .reader-print-title {
            display: block !important;
            margin-bottom: 30px !important;
            font-family: 'Outfit', sans-serif !important;
          }
          .reader-print-title h1 {
            font-size: 24pt !important;
            margin: 0 0 10px 0 !important;
            color: #000 !important;
          }
          .reader-print-title hr {
            border: none !important;
            border-top: 2px solid #000 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="reader-header">
        <div className="reader-header-left">
          <span>{scene.isDraft ? "Draft Workspace" : "Manuscript Workspace"}</span>
          <h2>{scene.title || "Untitled Scene"}</h2>
        </div>
        <div className="reader-actions">
          <div style={{ fontSize: "12px", color: "#6b7280", marginRight: "16px", fontFamily: "monospace" }}>
            ⏱️ {readingTime} min read &bull; {wordCount} words
          </div>
          <button className="reader-btn" onClick={handlePrint} title="Print Draft">
            🖨️ Print
          </button>
          <button className="reader-btn" onClick={handleExportToMD} title="Export to Markdown">
            📥 Export to MD
          </button>
          <button className="reader-close" onClick={onClose} title="Close Reader (Esc)" aria-label="Close Reader">
            &times;
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="reader-body">
        <div className="reader-content-lane">
          {/* Printable Layout Title */}
          <div className="reader-print-title">
            <h1>{scene.title || "Untitled Scene"}</h1>
            <div style={{ fontSize: "10pt", color: "#555", marginBottom: "15px" }}>
              {scene.isDraft ? "WIP Draft" : "Manuscript"} &bull; {wordCount} words &bull; Printed on {new Date().toLocaleDateString("en-AU")}
            </div>
            <hr />
          </div>

          {/* Context Pills */}
          <div className="reader-meta-pills">
            {scene.chars && <div className="reader-pill">👤 Characters: {scene.chars}</div>}
            {scene.objects && <div className="reader-pill">🔑 Props: {scene.objects}</div>}
            {scene.goal && <div className="reader-pill">🎯 Goal: {scene.goal}</div>}
            {scene.conflict && <div className="reader-pill">⚠️ Obstacle: {scene.conflict}</div>}
            {scene.change && <div className="reader-pill">🔄 Shift: {scene.change}</div>}
          </div>

          {/* Content */}
          {scene.text ? (
            scene.text.split("\n\n").map((para, idx) => (
              <p key={idx} style={{ textIndent: idx > 0 && !scene.isDraft ? "24px" : "0" }}>
                {para}
              </p>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "#4b5563", padding: "120px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
              <h3>This document is empty</h3>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>Write or generate some prose to display here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
