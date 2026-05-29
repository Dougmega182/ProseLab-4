import React from "react";

export default function StatusBar({
  cacheStats,
  costStats,
  wordCount,
  isFocusMode,
  setIsFocusMode
}) {
  const formatCost = (cost) => {
    if (typeof cost !== 'number') return "0.0000";
    return cost.toFixed(4);
  };

  return (
    <div className="env-status shell-status" style={{ 
      padding: "0 12px", 
      height: "24px", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between",
      background: "#08080a",
      borderTop: "1px solid #1a1a22",
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "10px",
      letterSpacing: "0.05em",
      color: "#888",
      textTransform: "uppercase"
    }}>
      <div className="status-left" style={{ display: "flex", gap: "6px" }}>
        <div style={{ width: "4px", height: "4px", background: "#555", borderRadius: "50%" }}></div>
        <div style={{ width: "4px", height: "4px", background: "#555", borderRadius: "50%" }}></div>
        <div style={{ width: "4px", height: "4px", background: "#555", borderRadius: "50%" }}></div>
      </div>

      <div className="status-right" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div className="status-item" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>GALAXY AI:</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#aaa" }}>
            <div style={{ width: "6px", height: "6px", background: "#4ade80", borderRadius: "50%" }}></div>
            Ready
          </span>
        </div>

        <div className="status-item">
          <span>TOKEN SPEND: </span>
          <span style={{ color: "#aaa" }}>${formatCost(costStats?.today?.cost)}</span>
        </div>

        <div className="status-item">
          <span>CACHE: </span>
          <span style={{ color: "#aaa" }}>{cacheStats?.entries || 0}cached</span>
        </div>

        <div className="status-item">
          <span>WORDS: </span>
          <span style={{ color: "#aaa" }}>{wordCount?.toLocaleString() || "0"}</span>
        </div>

        <div className="status-item" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>SYSTEM: </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#4ade80" }}>
            ✓ All clear
          </span>
        </div>

        <button 
          onClick={() => setIsFocusMode(!isFocusMode)}
          style={{ 
            background: isFocusMode ? "#333" : "transparent",
            border: "1px solid #333",
            color: isFocusMode ? "#fff" : "#aaa",
            padding: "2px 8px",
            fontSize: "9px",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            cursor: "pointer",
            borderRadius: "2px",
            marginLeft: "8px",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => {
            if (!isFocusMode) {
              e.currentTarget.style.background = "#222";
              e.currentTarget.style.color = "#eee";
            }
          }}
          onMouseOut={(e) => {
            if (!isFocusMode) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#aaa";
            }
          }}
        >
          Focus Mode
        </button>
      </div>
    </div>
  );
}
