import { useState } from 'react';
import { marked } from 'marked';
import InputEditor from '../../../components/ui/InputEditor';

marked.setOptions({ gfm: true, breaks: true });

const SAMPLE = `# Markdown Preview

Write **Markdown** on the left and see the rendered output on the right.

- Supports **GFM** (GitHub Flavored Markdown)
- Tables, code blocks, task lists
- \`inline code\` and fenced blocks

\`\`\`typescript
const greeting = (name: string) => \`Hello, \${name}!\`;
\`\`\`

> Blockquotes work too.
`;

export default function MarkdownTool() {
  const [input, setInput] = useState(SAMPLE);
  const html = marked.parse(input) as string;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Markdown Preview</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Live GitHub Flavored Markdown renderer</p>
      </div>
      <div className="tool-body">
        <div className="pane">
          <div className="pane-label">Markdown</div>
          <div className="editor-fill">
            <InputEditor value={input} onChange={setInput} language="markdown" />
          </div>
        </div>
        <div className="pane-divider" />
        <div className="pane overflow-auto">
          <div className="pane-label">Preview</div>
          <div
            className="flex-1 overflow-auto p-4 prose prose-sm max-w-none"
            style={{ color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
