import TwoColTool from '../../../components/ui/TwoColTool';

function jsonToCsv(input: string, delimiter: string): string {
  const data = JSON.parse(input);
  if (!Array.isArray(data)) throw new Error('Input must be a JSON array');
  if (data.length === 0) return '';
  const keys = Object.keys(data[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(delimiter) || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [keys.join(delimiter), ...data.map((row: Record<string, unknown>) => keys.map((k) => escape(row[k])).join(delimiter))];
  return rows.join('\n');
}

function csvToJson(input: string, delimiter: string): string {
  const lines = input.split('\n').filter((l) => l.trim());
  if (!lines.length) return '[]';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.replace(/^"|"$/g, '').trim() ?? '']));
  });
  return JSON.stringify(rows, null, 2);
}

export default function JsonCsvTool() {
  return (
    <TwoColTool
      title="JSON ↔ CSV"
      description="Convert between JSON arrays and CSV tables"
      options={[
        {
          id: 'direction',
          label: 'Direction',
          type: 'select',
          default: 'json-to-csv',
          options: [
            { label: 'JSON → CSV', value: 'json-to-csv' },
            { label: 'CSV → JSON', value: 'csv-to-json' },
          ],
        },
        {
          id: 'delimiter',
          label: 'Delimiter',
          type: 'select',
          default: ',',
          options: [
            { label: 'Comma (,)', value: ',' },
            { label: 'Semicolon (;)', value: ';' },
            { label: 'Tab', value: '\t' },
            { label: 'Pipe (|)', value: '|' },
          ],
        },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          return opts.direction === 'json-to-csv'
            ? { output: jsonToCsv(input, String(opts.delimiter)) }
            : { output: csvToJson(input, String(opts.delimiter)) };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
