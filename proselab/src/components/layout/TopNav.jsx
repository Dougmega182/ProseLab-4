import React from "react";

export default function TopNav({
  saveStatus,
  dateStr,
  timeStr,
  theme,
  toggleTheme,
  handleExport
}) {
  return (
    <header className="header">
      <div className="header-left">
        <img className="logo-mark" src="/logo.png" alt="ProseLab" />
        <div>
          <div className="header-title">ProseLab <span style={{ color: "var(--accent-primary)", fontWeight: 800 }}>V4</span></div>
          <div className="header-subtitle">Precision Analytical Engine</div>
        </div>
      </div>
      <div className="header-right">
        {saveStatus !== "idle" && (
          <div className={`save-indicator ${saveStatus}`}>
            {saveStatus === "saving" ? (
              <>
                <span className="spinner" />
                Saving...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Saved!
              </>
            )}
          </div>
        )}
        <div className="datetime-display" style={{ marginLeft: "15px" }}>
          <div className="datetime-date">{dateStr}</div>
          <div className="datetime-time">{timeStr}</div>
        </div>
        <div className="status-dot" title="System Online" />
        <button 
          className="theme-toggle-btn" 
          onClick={toggleTheme} 
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{ marginLeft: "15px" }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="btn btn-primary" onClick={handleExport} style={{ marginLeft: "15px", padding: "6px 14px", fontSize: "11px" }}>
          [Export] Export .MD
        </button>
      </div>
    </header>
  );
}
