import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

export type LangMode = 'json' | 'html' | 'css' | 'javascript' | 'typescript' | 'xml' | 'sql' | 'markdown' | 'text';

const langExtension = (mode: LangMode) => {
  switch (mode) {
    case 'json': return json();
    case 'html': return html();
    case 'css': return css();
    case 'javascript': return javascript();
    case 'typescript': return javascript({ typescript: true });
    case 'xml': return xml();
    case 'sql': return sql();
    case 'markdown': return markdown();
    default: return [];
  }
};

interface InputEditorProps {
  value: string;
  onChange?: (v: string) => void;
  language?: LangMode;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  darkMode?: boolean;
}

export default function InputEditor({
  value,
  onChange,
  language = 'text',
  readOnly = false,
  placeholder,
  className = '',
  darkMode,
}: InputEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isDark = darkMode ?? document.documentElement.classList.contains('dark');

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      foldGutter(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      langExtension(language),
      EditorView.lineWrapping,
      ...(isDark ? [oneDark] : []),
      ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      ...(onChange
        ? [EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
          })]
        : []),
    ];

    const view = new EditorView({
      doc: value,
      extensions,
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly, isDark]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={containerRef} className={`h-full overflow-auto ${className}`} />;
}
