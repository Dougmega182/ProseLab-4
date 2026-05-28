import React from 'react';

export default function WorkspaceLayout({ leftSidebar, rightSidebar, topNav, statusBar, isFocusMode, focusHeader, children }) {
  if (isFocusMode) {
    return (
      <div className="workspace-container focus-mode" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
        {focusHeader}
        <div className="workspace-content" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-container" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
      {topNav && <div className="workspace-topnav">{topNav}</div>}
      <div className="workspace-main-area" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {leftSidebar && <div className="workspace-left-sidebar" style={{ width: "280px", borderRight: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", overflowY: "auto" }}>{leftSidebar}</div>}
        <div className="workspace-content" style={{ flex: 1, overflowY: "auto", padding: "24px", position: "relative" }}>
          {children}
        </div>
        {rightSidebar && <div className="workspace-right-sidebar" style={{ width: "320px", borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", overflowY: "auto" }}>{rightSidebar}</div>}
      </div>
      {statusBar && <div className="workspace-statusbar" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}>{statusBar}</div>}
    </div>
  );
}
