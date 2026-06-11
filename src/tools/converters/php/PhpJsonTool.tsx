import TwoColTool from '../../../components/ui/TwoColTool';

// PHP serialized format: s:5:"hello"; i:42; b:1; a:2:{s:3:"foo";i:1;s:3:"bar";i:2;}
function phpUnserialize(input: string): unknown {
  let pos = 0;
  const s = input.trim();

  function readValue(): unknown {
    const type = s[pos];
    pos += 2; // skip type + ':'
    if (type === 'N') { pos--; return null; }
    if (type === 'b') { const v = s[pos] === '1'; pos += 2; return v; }
    if (type === 'i') { const end = s.indexOf(';', pos); const n = parseInt(s.slice(pos, end)); pos = end + 1; return n; }
    if (type === 'd') { const end = s.indexOf(';', pos); const f = parseFloat(s.slice(pos, end)); pos = end + 1; return f; }
    if (type === 's') {
      const lenEnd = s.indexOf(':', pos); const len = parseInt(s.slice(pos, lenEnd));
      pos = lenEnd + 2; const str = s.slice(pos, pos + len); pos += len + 2; return str;
    }
    if (type === 'a') {
      const lenEnd = s.indexOf(':', pos); const len = parseInt(s.slice(pos, lenEnd));
      pos = lenEnd + 2;
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < len; i++) {
        const key = readValue() as string | number;
        const val = readValue();
        obj[String(key)] = val;
      }
      pos++; return obj;
    }
    return null;
  }
  return readValue();
}

function phpSerialize(val: unknown): string {
  if (val === null) return 'N;';
  if (typeof val === 'boolean') return `b:${val ? 1 : 0};`;
  if (typeof val === 'number') return Number.isInteger(val) ? `i:${val};` : `d:${val};`;
  if (typeof val === 'string') return `s:${new TextEncoder().encode(val).length}:"${val}";`;
  if (Array.isArray(val)) {
    const items = val.map((v, i) => `${phpSerialize(i)}${phpSerialize(v)}`).join('');
    return `a:${val.length}:{${items}}`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    const items = entries.map(([k, v]) => `${phpSerialize(k)}${phpSerialize(v)}`).join('');
    return `a:${entries.length}:{${items}}`;
  }
  return `s:0:"";`;
}

export default function PhpJsonTool() {
  return (
    <TwoColTool
      title="PHP ↔ JSON"
      description="Convert PHP serialized data to JSON or serialize JSON back to PHP format"
      options={[
        {
          id: 'direction',
          label: 'Direction',
          type: 'select',
          default: 'php-to-json',
          options: [
            { label: 'PHP → JSON', value: 'php-to-json' },
            { label: 'JSON → PHP', value: 'json-to-php' },
          ],
        },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          if (opts.direction === 'php-to-json') {
            const obj = phpUnserialize(input);
            return { output: JSON.stringify(obj, null, 2) };
          } else {
            const obj = JSON.parse(input);
            return { output: phpSerialize(obj) };
          }
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
