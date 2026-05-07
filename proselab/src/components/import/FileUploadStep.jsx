// src/components/import/FileUploadStep.jsx
import React, { useState, useRef, useCallback } from 'react';

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.rtf', '.doc', '.docx', '.json', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 50;

export default function FileUploadStep({ onFilesSelected, onCancel }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const fileInputRef = useRef(null);

  const validateFiles = useCallback((fileList) => {
    const errors = [];
    const valid = [];

    if (fileList.length > MAX_FILES) {
      errors.push(`Too many files. Maximum is ${MAX_FILES}.`);
      return { valid: [], errors };
    }

    for (const file of fileList) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        errors.push(`"${file.name}" has unsupported format (${ext}). Supported: ${ACCEPTED_EXTENSIONS.join(', ')}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
        continue;
      }

      if (file.size === 0) {
        errors.push(`"${file.name}" is empty.`);
        continue;
      }

      valid.push(file);
    }
    return { valid, errors };
  }, []);

  const handleFiles = useCallback((fileList) => {
    const { valid, errors } = validateFiles(Array.from(fileList));
    setValidationErrors(errors);

    // Merge with existing, avoiding duplicates by name
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const newFiles = valid.filter(f => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  }, [validateFiles]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleContinue = useCallback(() => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  }, [selectedFiles, onFilesSelected]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="file-upload-step">
      <div
        className={`file-upload-step__dropzone ${dragActive ? 'file-upload-step__dropzone--active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="file-upload-step__dropzone-content">
          <span className="file-upload-step__icon">📁</span>
          <p className="file-upload-step__primary-text">
            Drag & drop files here, or click to browse
          </p>
          <p className="file-upload-step__secondary-text">
            Supports: {ACCEPTED_EXTENSIONS.join(', ')} — Max {MAX_FILES} files, 10MB each
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {validationErrors.length > 0 && (
        <div className="file-upload-step__errors">
          {validationErrors.map((err, i) => (
            <div key={i} className="file-upload-step__error">⚠️ {err}</div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="file-upload-step__file-list">
          <h3>{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</h3>
          <ul>
            {selectedFiles.map((file, i) => (
              <li key={i} className="file-upload-step__file-item">
                <span className="file-upload-step__file-name">{file.name}</span>
                <span className="file-upload-step__file-size">{formatSize(file.size)}</span>
                <button
                  className="file-upload-step__remove-btn"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  title="Remove file"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="import-wizard__actions">
        <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn--primary"
          onClick={handleContinue}
          disabled={selectedFiles.length === 0}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
