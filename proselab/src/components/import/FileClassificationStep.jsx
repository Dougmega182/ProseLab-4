// src/components/import/FileClassificationStep.jsx
import React, { useState, useCallback } from 'react';

const CATEGORIES = [
  { value: 'manuscript', label: 'Manuscript / Chapter(s)', icon: '📖' },
  { value: 'characters', label: 'Character Notes', icon: '👤' },
  { value: 'worldRules', label: 'World Rules / Lore', icon: '🌍' },
  { value: 'beatMap', label: 'Beat Map / Outline', icon: '🗺️' },
  { value: 'notes', label: 'General Notes', icon: '📝' },
  { value: 'skip', label: 'Skip (Don\'t Import)', icon: '⏭️' }
];

export default function FileClassificationStep({ classifications, onConfirm, onBack, onCancel }) {
  const [items, setItems] = useState(
    classifications.map(c => ({ ...c }))
  );

  const handleCategoryChange = useCallback((index, newCategory) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, category: newCategory } : item
    ));
  }, []);

  const handleConfirm = useCallback(() => {
    const toImport = items.filter(item => item.category !== 'skip');
    if (toImport.length === 0) {
      alert('No files selected for import. Please classify at least one file or go back.');
      return;
    }
    onConfirm(items);
  }, [items, onConfirm]);

  const getCategoryInfo = (value) => CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="file-classification-step">
      <p className="file-classification-step__intro">
        We've auto-detected the type of each file. Please review and adjust if needed.
      </p>

      <div className="file-classification-step__list">
        {items.map((item, index) => {
          const catInfo = getCategoryInfo(item.category);
          return (
            <div key={index} className="file-classification-step__item">
              <div className="file-classification-step__file-info">
                <span className="file-classification-step__file-name">{item.fileName}</span>
                {item.confidence && (
                  <span className={`file-classification-step__confidence file-classification-step__confidence--${item.confidence}`}>
                    {item.confidence} confidence
                  </span>
                )}
                {item.preview && (
                  <div className="file-classification-step__preview">
                    {item.preview.substring(0, 200)}...
                  </div>
                )}
              </div>
              <div className="file-classification-step__category-select">
                <select
                  value={item.category}
                  onChange={(e) => handleCategoryChange(index, e.target.value)}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="file-classification-step__summary">
        <h4>Import Summary</h4>
        <ul>
          {CATEGORIES.filter(c => c.value !== 'skip').map(cat => {
            const count = items.filter(i => i.category === cat.value).length;
            if (count === 0) return null;
            return (
              <li key={cat.value}>
                {cat.icon} {count} {cat.label}
              </li>
            );
          })}
          {(() => {
            const skipCount = items.filter(i => i.category === 'skip').length;
            return skipCount > 0 ? <li>⏭️ {skipCount} skipped</li> : null;
          })()}
        </ul>
      </div>

      <div className="import-wizard__actions">
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn--secondary" onClick={onBack}>← Back</button>
        <button className="btn btn--primary" onClick={handleConfirm}>
          Continue →
        </button>
      </div>
    </div>
  );
}
