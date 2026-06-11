import { useState } from 'react';
import { RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { copyToClipboard } from '../../../lib/utils';

const WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor reprehenderit voluptate velit esse cillum dolore fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa deserunt mollit anim laborum`.split(' ');

function sentence(wordCount = 8): string {
  const words = Array.from({ length: wordCount }, (_, i) => i === 0 ? capitalize(pick()) : pick());
  return words.join(' ') + '.';
}

function paragraph(sentences = 5): string {
  return Array.from({ length: sentences }, () => sentence(6 + Math.floor(Math.random() * 6))).join(' ');
}

function pick(): string { return WORDS[Math.floor(Math.random() * WORDS.length)]; }
function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function LoremTool() {
  const [type, setType] = useState<'paragraphs' | 'sentences' | 'words'>('paragraphs');
  const [count, setCount] = useState(3);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    if (type === 'paragraphs') setOutput(Array.from({ length: count }, () => paragraph()).join('\n\n'));
    else if (type === 'sentences') setOutput(Array.from({ length: count }, () => sentence()).join(' '));
    else setOutput(Array.from({ length: count }, () => pick()).join(' '));
  };

  const handleCopy = async () => {
    await copyToClipboard(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lorem Ipsum Generator</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Generate placeholder lorem ipsum text</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-base text-xs py-1" style={{ width: 110 }} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="paragraphs">Paragraphs</option>
            <option value="sentences">Sentences</option>
            <option value="words">Words</option>
          </select>
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="input-base text-xs py-1" style={{ width: 56 }} />
          <button className="btn btn-accent btn-sm" onClick={generate}><RefreshCw size={12} /> Generate</button>
          {output && (
            <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
              {copied ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {!output ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Click Generate to create lorem ipsum text</p>
        ) : (
          <div className="prose max-w-prose text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{output}</div>
        )}
      </div>
    </div>
  );
}
