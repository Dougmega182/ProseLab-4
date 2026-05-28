import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

// Effect to update decorations
const updateHighlights = StateEffect.define();

// Field to store decorations
const highlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(updateHighlights)) underlines = e.value;
    }
    return underlines;
  },
  provide: f => EditorView.decorations.from(f)
});

const highlightTheme = EditorView.baseTheme({
  ".cm-underline-passive": { borderBottom: "2px solid #ff3b30", backgroundColor: "rgba(255, 59, 48, 0.1)" },
  ".cm-underline-adverb": { borderBottom: "2px solid #5856d6", backgroundColor: "rgba(88, 86, 214, 0.1)" },
  ".cm-underline-hidden": { borderBottom: "2px solid #ffcc00", backgroundColor: "rgba(255, 204, 0, 0.1)" },
  ".cm-underline-weak": { borderBottom: "2px solid #ff9500", backgroundColor: "rgba(255, 149, 0, 0.1)" },
  ".cm-underline-cliche": { borderBottom: "2px solid #af52de", backgroundColor: "rgba(175, 82, 222, 0.1)" },
  ".cm-underline-filter": { borderBottom: "2px solid #4cd964", backgroundColor: "rgba(76, 217, 100, 0.1)" },
});

export function ProseEditor({ value, onChange, findings = [], placeholder = "Start writing...", minHeight = "600px" }) {
  
  const extensions = useMemo(() => {
    const exts = [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      highlightField,
      highlightTheme,
    ];
    return exts;
  }, []);

  // Sync findings to decorations
  const onUpdate = React.useCallback((view) => {
    if (!view || !findings.length) {
      return;
    }
    
    const decorations = findings.map(f => {
      let className = "cm-underline-passive";
      if (f.type === "adverb") className = "cm-underline-adverb";
      if (f.type === "hidden-verb") className = "cm-underline-hidden";
      if (f.type === "weak-qualifier") className = "cm-underline-weak";
      if (f.type === "cliche") className = "cm-underline-cliche";
      if (f.type === "sensory-filter") className = "cm-underline-filter";
      
      // Ensure range is valid
      const start = Math.max(0, Math.min(f.offset, view.state.doc.length));
      const end = Math.max(start, Math.min(f.offset + f.length, view.state.doc.length));
      
      if (start === end) return null;

      return Decoration.mark({ class: className }).range(start, end);
    }).filter(Boolean);

    view.dispatch({
      effects: updateHighlights.of(Decoration.set(decorations, true))
    });
  }, [findings]);

  return (
    <div className="prose-editor-wrapper" style={{ width: '100%', minHeight }}>
      <CodeMirror
        value={value}
        height={minHeight}
        theme={oneDark}
        extensions={extensions}
        onUpdate={(v) => {
          if (v.docChanged || v.viewportChanged) {
            onUpdate(v.view);
          }
        }}
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
