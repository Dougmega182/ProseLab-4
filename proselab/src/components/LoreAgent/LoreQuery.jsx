// src/components/LoreAgent/LoreQuery.jsx

import React, { useState, useRef } from 'react';

export default function LoreQuery({ agent }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleQuery = async () => {
    if (!query.trim() || loading) return;

    const userMessage = { role: 'user', content: query };
    setHistory(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const result = await agent.queryLore(query);
      const assistantMessage = {
        role: 'assistant',
        content: result.answer,
        entities: result.relevantEntities || [],
        sources: result.sources || [],
      };
      setHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      setHistory(prev => [...prev, {
        role: 'error',
        content: `Error: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const suggestedQueries = [
    'Who are the main characters?',
    'What locations have been mentioned?',
    'What are the key relationships?',
    'Are there any unresolved plot threads?',
    'Summarize the timeline of events.',
    'What factions exist and what are their goals?',
  ];

  return (
    <div className="lore-query">
      <div className="query-history">
        {history.length === 0 && (
          <div className="query-welcome">
            <h3>Ask about your lore</h3>
            <p>Query the knowledge base about characters, locations, events, and relationships.</p>
            <div className="suggested-queries">
              {suggestedQueries.map((sq, i) => (
                <button
                  key={i}
                  className="suggestion-btn"
                  onClick={() => { setQuery(sq); inputRef.current?.focus(); }}
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={`query-message ${msg.role}`}>
            <div className="message-content">
              {msg.content}
            </div>
            {msg.entities && msg.entities.length > 0 && (
              <div className="message-entities">
                <span className="entities-label">Related entities:</span>
                {msg.entities.map((e, j) => (
                  <span key={j} className="entity-chip" style={{ borderColor: getTypeColor(e.type) }}>
                    {e.name}
                  </span>
                ))}
              </div>
            )}
            {msg.sources && msg.sources.length > 0 && (
              <div className="message-sources">
                <span className="sources-label">Sources:</span>
                {msg.sources.map((s, j) => (
                  <span key={j} className="source-chip">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="query-message assistant loading">
            <div className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
      </div>

      <div className="query-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleQuery(); }}
          placeholder="Ask about your lore..."
          disabled={loading}
        />
        <button onClick={handleQuery} disabled={loading || !query.trim()}>
          Ask
        </button>
      </div>
    </div>
  );
}

function getTypeColor(type) {
  const colors = {
    character: '#4A90D9',
    location: '#2ECC71',
    item: '#E67E22',
    event: '#9B59B6',
    faction: '#E74C3C',
    concept: '#1ABC9C',
    creature: '#F39C12',
    unknown: '#95A5A6',
  };
  return colors[type] || colors.unknown;
}
