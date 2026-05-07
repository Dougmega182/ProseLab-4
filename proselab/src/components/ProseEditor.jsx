import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';

export function ProseEditor({ value, onChange, placeholder = "Start writing...", minHeight = "600px" }) {
  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
  ], []);

  return (
    <div className="prose-editor-wrapper" style={{ width: '100%', minHeight }}>
      <CodeMirror
        value={value}
        height={minHeight}
        theme={oneDark}
        extensions={extensions}
        onChange={(val) => onChange(val)}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
        style={{
          fontSize: '16px',
          fontFamily: 'var(--font-mono)',
        }}
      />
      <style>{`
        .cm-editor {
          background: #09090c !important;
          border-radius: 4px;
          border: 1px solid #222;
        }
        .cm-scroller {
          font-family: var(--font-mono);
          line-height: 1.6;
        }
        .cm-content {
          padding: 20px !important;
          color: #ccc !important;
        }
        .cm-activeLine {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        .cm-placeholder {
          color: #444 !important;
        }
      `}</style>
    </div>
  );
}
