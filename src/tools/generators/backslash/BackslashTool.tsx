import TwoColTool from '../../../components/ui/TwoColTool';

const ESCAPE_MAP: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f', '\\': '\\\\', '"': '\\"', "'": "\\'" };
const UNESCAPE_MAP: Record<string, string> = Object.fromEntries(Object.entries(ESCAPE_MAP).map(([k, v]) => [v, k]));

function escapeBackslash(s: string): string {
  return s.replace(/[\n\r\t\b\f\\"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

function unescapeBackslash(s: string): string {
  return s.replace(/\\[nrtbf\\"']/g, (seq) => UNESCAPE_MAP[seq] ?? seq)
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export default function BackslashTool() {
  return (
    <TwoColTool
      title="Backslash Escape / Unescape"
      description="Escape or unescape backslash sequences (\n, \t, \&quot; ...)"
      options={[
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          default: 'escape',
          options: [
            { label: 'Escape', value: 'escape' },
            { label: 'Unescape', value: 'unescape' },
          ],
        },
      ]}
      transform={(input, opts) => {
        if (!input) return { output: '' };
        return { output: opts.mode === 'escape' ? escapeBackslash(input) : unescapeBackslash(input) };
      }}
    />
  );
}
