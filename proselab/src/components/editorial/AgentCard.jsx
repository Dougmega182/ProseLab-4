import React from "react";
import VerdictBadge from "./VerdictBadge";

export default function AgentCard({ pKey, personaName, feedback }) {
  return (
    <div className="panel" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
      <div className="panel-header" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
        <span className="panel-title" style={{ color: "var(--accent-primary)", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          AGENT: {personaName || pKey}
        </span>
      </div>
      <div className="output-content" style={{ fontSize: "13px", padding: "16px" }}>
        {typeof feedback === "string" ? (
          <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{feedback}</div>
        ) : (
          <div className="structured-feedback">
            <VerdictBadge verdict={feedback.verdict} />
            
            {feedback.summary && (
              <div style={{ fontWeight: "500", color: "var(--text-primary)", marginBottom: "16px", lineHeight: "1.5" }}>
                {feedback.summary}
              </div>
            )}
            
            {feedback.issues && feedback.issues.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--severity-critical)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em" }}>Critical Flaws:</div>
                <ul style={{ paddingLeft: "16px", margin: 0, listStyleType: "circle", color: "var(--text-primary)" }}>
                  {feedback.issues.map((issue, idx) => (
                    <li key={idx} style={{ marginBottom: "6px", lineHeight: "1.4" }}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {feedback.strengths && feedback.strengths.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--success)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em" }}>Strengths:</div>
                <ul style={{ paddingLeft: "16px", margin: 0, listStyleType: "circle", color: "var(--text-primary)" }}>
                  {feedback.strengths.map((strength, idx) => (
                    <li key={idx} style={{ marginBottom: "6px", lineHeight: "1.4" }}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {feedback.rawFeedback && (
              <div style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                fontSize: "12px",
                fontFamily: "var(--font-mono)"
              }}>
                {feedback.rawFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
