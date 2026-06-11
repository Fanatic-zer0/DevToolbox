import TwoColTool from '../../../components/ui/TwoColTool';

// Simple JSON → TypeScript type generator
function toTypescript(obj: unknown, name = 'Root', depth = 0): string {
  if (obj === null) return 'null';
  if (Array.isArray(obj)) {
    const item = obj[0] ?? {};
    return `${toTypescript(item, name, depth)}[]`;
  }
  if (typeof obj === 'object') {
    const indent = '  '.repeat(depth + 1);
    const fields = Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => `${indent}${k}: ${toTypescript(v, k, depth + 1)};`).join('\n');
    if (depth === 0) return `export interface ${name} {\n${fields}\n}`;
    return `{\n${fields}\n${'  '.repeat(depth)}}`;
  }
  if (typeof obj === 'string') return 'string';
  if (typeof obj === 'number') return 'number';
  if (typeof obj === 'boolean') return 'boolean';
  return 'unknown';
}

function toPython(obj: unknown, name = 'Root'): string {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return `# Cannot generate Python dataclass from non-object\n${name} = ${JSON.stringify(obj)}`;
  }
  const fields = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => {
      const t = Array.isArray(v) ? 'list' : v === null ? 'None' : typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : typeof v;
      return `  ${k}: ${t}`;
    }).join('\n');
  return `from dataclasses import dataclass\n\n@dataclass\nclass ${name}:\n${fields}`;
}

function toGo(obj: unknown, name = 'Root'): string {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return '// Input must be a JSON object';
  const fields = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => {
      const pascal = k.replace(/(?:^|[_-])([a-z])/g, (_, c: string) => c.toUpperCase());
      const t = v === null ? 'interface{}' : Array.isArray(v) ? '[]interface{}' : typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float64') : typeof v === 'boolean' ? 'bool' : typeof v === 'string' ? 'string' : 'interface{}';
      return `  ${pascal} ${t} \`json:"${k}"\``;
    }).join('\n');
  return `type ${name} struct {\n${fields}\n}`;
}

function toRust(obj: unknown, name = 'Root'): string {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return '// Input must be a JSON object';
  const fields = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => {
      const t = v === null ? 'Option<serde_json::Value>' : Array.isArray(v) ? 'Vec<serde_json::Value>' : typeof v === 'number' ? (Number.isInteger(v) ? 'i64' : 'f64') : typeof v === 'boolean' ? 'bool' : typeof v === 'string' ? 'String' : 'serde_json::Value';
      return `  pub ${k}: ${t},`;
    }).join('\n');
  return `#[derive(Debug, Serialize, Deserialize)]\npub struct ${name} {\n${fields}\n}`;
}

const GENERATORS: Record<string, (obj: unknown) => string> = {
  typescript: (o) => toTypescript(o),
  python:     (o) => toPython(o),
  go:         (o) => toGo(o),
  rust:       (o) => toRust(o),
};

const LANG_MAP: Record<string, string> = {
  typescript: 'typescript', python: 'text', go: 'text', rust: 'text',
};

export default function JsonToCodeTool() {
  return (
    <TwoColTool
      title="JSON to Code"
      description="Generate TypeScript interfaces, Python dataclasses, Go structs, and Rust structs from JSON"
      inputLang="json"
      outputFilename="types.ts"
      options={[
        {
          id: 'target',
          label: 'Language',
          type: 'select',
          default: 'typescript',
          options: [
            { label: 'TypeScript', value: 'typescript' },
            { label: 'Python', value: 'python' },
            { label: 'Go', value: 'go' },
            { label: 'Rust', value: 'rust' },
          ],
        },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const obj = JSON.parse(input);
          const gen = GENERATORS[String(opts.target)] ?? GENERATORS.typescript;
          return { output: gen(obj) };
        } catch (e) {
          return { output: '', error: `JSON parse error: ${e}` };
        }
      }}
    />
  );
}
