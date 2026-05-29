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
    <div className="workspace-container" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-primary)", position: "relative" }}>
      {topNav && <div className="workspace-topnav">{topNav}</div>}
      <div className="workspace-main-area" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {leftSidebar}
        <div className="workspace-content" style={{ flex: 1, overflowY: "auto", padding: "24px", position: "relative" }}>
          {children}
        </div>
        {rightSidebar}
      </div>
      {statusBar && <div className="workspace-statusbar" style={{ flexShrink: 0, width: "100%", zIndex: 100 }}>{statusBar}</div>}
    </div>
  );
}
