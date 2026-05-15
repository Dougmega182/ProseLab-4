import React, { useState, useEffect } from 'react';

export default function IngestionPanel({ projectId, storage, onImportComplete }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      // Sync projects first to help AI classification
      const projects = await storage.listProjects();
      await fetch('/api/ingestion/api/sync/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: projects.map(p => p.title) })
      });

      const response = await fetch('/api/ingestion/api/documents/pending');
      if (!response.ok) throw new Error('Could not reach ingestion server');
      const data = await response.json();
      setPending(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleImport = async (doc) => {
    try {
      // Use the storage adapter to save the document
      // Depending on the category, we might create a Character, Rule, or Scene.
      const category = doc.classification?.category || 'notes';
      
      let importResult;
      if (category === 'characters') {
        importResult = await storage.createCharacter({
          name: doc.fileName.replace(/\.[^.]+$/, ''),
          description: doc.textContent,
          source: 'email-ingestion',
          metadata: { email: doc.emailMeta }
        });
      } else if (category === 'worldbuilding') {
        importResult = await storage.createWorldRule({
          title: doc.fileName.replace(/\.[^.]+$/, ''),
          content: doc.textContent,
          source: 'email-ingestion',
          metadata: { email: doc.emailMeta }
        });
      } else {
        // Default to a generic document/note
        importResult = await storage.createDocument({
          projectId,
          title: doc.fileName,
          content: doc.textContent,
          type: category,
          source: 'email-ingestion',
          metadata: { email: doc.emailMeta }
        });
      }

      // Mark as processed on the server
      await fetch(`/api/ingestion/api/documents/process/${doc.id}`, { method: 'POST' });
      
      // Refresh list
      fetchPending();
      if (onImportComplete) onImportComplete(importResult);
      
      alert(`Imported ${doc.fileName} as ${category}`);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="ingestion-panel">
      <div className="preproduction-header">
        <div>
          <div className="preproduction-kicker">Email Ingestion</div>
          <div className="preproduction-title">Attachments from psailafamily154@gmail.com</div>
        </div>
        <button className="btn btn-ghost" onClick={fetchPending} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mode-alert mode-alert-error">
          <strong>Ingestion Server Offline</strong>
          <p>{error}. Make sure the ingestion server is running on port 3001.</p>
        </div>
      )}

      <div className="pending-list">
        {pending.length === 0 && !loading && !error && (
          <div className="output-placeholder">No pending email attachments found.</div>
        )}

        {pending.map(doc => (
          <div key={doc.id} className="pending-card">
            <div className="pending-card-header">
              <div className="pending-file-info">
                <strong>{doc.fileName}</strong>
                <span>{doc.emailMeta?.from}</span>
              </div>
              <div className={`category-badge category-${doc.classification?.category}`}>
                {doc.classification?.category}
              </div>
            </div>
            
            <div className="pending-card-body">
              <div className="email-context">
                <em>Subject: {doc.emailMeta?.subject}</em>
                <p>{doc.emailMeta?.body?.substring(0, 150)}...</p>
              </div>
              
              <div className="ai-reasoning">
                <strong>AI Reason:</strong> {doc.classification?.reason}
                <div className="confidence-meter">
                  <div className="confidence-fill" style={{ width: `${(doc.classification?.confidence || 0) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="pending-card-actions">
              <button className="btn btn-primary btn-compact" onClick={() => handleImport(doc)}>
                Import to Project
              </button>
              <button className="btn btn-ghost btn-compact" onClick={() => {
                if(confirm('Delete this pending document?')) {
                   fetch(`/api/ingestion/api/documents/process/${doc.id}`, { method: 'POST' }).then(fetchPending);
                }
              }}>
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 20px;
        }
        .pending-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 16px;
          transition: border-color 0.2s;
        }
        .pending-card:hover {
          border-color: var(--accent-primary);
        }
        .pending-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .pending-file-info {
          display: flex;
          flex-direction: column;
        }
        .pending-file-info strong {
          font-size: 15px;
          color: var(--text-main);
        }
        .pending-file-info span {
          font-size: 12px;
          color: var(--text-muted);
        }
        .category-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: bold;
          background: rgba(100, 108, 255, 0.1);
          color: var(--accent-primary);
        }
        .category-manuscript { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .category-characters { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .category-worldbuilding { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        
        .email-context {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          background: rgba(0,0,0,0.2);
          padding: 8px;
          border-radius: 4px;
        }
        .email-context em {
          display: block;
          margin-bottom: 4px;
          font-weight: bold;
        }
        
        .ai-reasoning {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }
        .confidence-meter {
          height: 3px;
          background: rgba(255,255,255,0.1);
          margin-top: 4px;
          border-radius: 2px;
          overflow: hidden;
        }
        .confidence-fill {
          height: 100%;
          background: var(--accent-primary);
        }
        
        .pending-card-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
