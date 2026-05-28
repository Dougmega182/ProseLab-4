import React from "react";

export default function VerdictBadge({ verdict }) {
  if (!verdict) return null;

  const isApproved = verdict === "APPROVED";
  const isRewrite = verdict === "REWRITE";

  return (
    <div style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
      <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Verdict:</span>
      <span className="status-badge" style={{
        fontSize: "11px",
        fontWeight: "600",
        background: isApproved ? "rgba(52, 213, 153, 0.15)" : isRewrite ? "rgba(239, 83, 80, 0.15)" : "rgba(255, 183, 77, 0.15)",
        color: isApproved ? "var(--success)" : isRewrite ? "var(--severity-critical)" : "var(--severity-warning)",
        border: `1px solid ${isApproved ? "rgba(52, 213, 153, 0.3)" : isRewrite ? "rgba(239, 83, 80, 0.3)" : "rgba(255, 183, 77, 0.3)"}`,
        padding: "2px 8px",
        borderRadius: "4px"
      }}>
        {verdict}
      </span>
    </div>
  );
}
