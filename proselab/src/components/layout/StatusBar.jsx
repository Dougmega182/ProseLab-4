import React from "react";

export default function StatusBar({
  providerCards,
  runtimeCards,
  cacheDiagnostics,
  handleClearCache,
  handleClearCosts,
  handleResetLocalData,
  isFocusMode,
  setIsFocusMode
}) {
  return (
    <div className="env-status shell-status">
      <div className="provider-status-grid">
        {providerCards.map(card => (
          <div key={card.key} className={`provider-status-card is-${card.status}`}>
            <div className="provider-status-head">
              <span>{card.label}</span>
              <div className={`env-dot ${card.status === "ready" ? "connected" : card.status === "partial" ? "info" : "missing"}`} />
            </div>
            <strong>{card.status === "ready" ? "Ready" : card.status === "partial" ? "Partial" : card.status === "warning" ? "Blocked" : "Missing"}</strong>
            <p>{card.detail}</p>
          </div>
        ))}
        {runtimeCards.map(card => (
          <div key={card.label} className={`provider-status-card is-${card.tone}`}>
            <div className="provider-status-head">
              <span>{card.label}</span>
            </div>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>
      <div className="shell-status-actions">
        <div className="env-item env-note">
          <div className="env-dot info" />
          <span>Cache {cacheDiagnostics.enabled ? "On" : "Off"} | {cacheDiagnostics.version} | TTL {Math.round(cacheDiagnostics.ttlMs / 3600000)}h</span>
        </div>
        <button className="btn btn-ghost btn-compact" onClick={handleClearCache}>Clear Cache</button>
        <button className="btn btn-ghost btn-compact" onClick={handleClearCosts}>Reset Costs</button>
        <button className="btn btn-ghost btn-compact" onClick={handleResetLocalData}>Reset Local Data</button>
        <button
          className={`btn btn-compact shell-focus-toggle ${isFocusMode ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setIsFocusMode(!isFocusMode)}
        >
          {isFocusMode ? "Exit Focus" : "Focus Mode"}
        </button>
      </div>
    </div>
  );
}
