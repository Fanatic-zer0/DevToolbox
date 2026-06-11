import TwoColTool from '../../../components/ui/TwoColTool';

export default function LineSortTool() {
  return (
    <TwoColTool
      title="Line Sort / Deduplicate"
      description="Sort lines alphabetically, remove duplicates, and filter"
      options={[
        { id: 'sort', label: 'Sort', type: 'toggle', default: true },
        { id: 'dedupe', label: 'Dedupe', type: 'toggle', default: false },
        { id: 'reverse', label: 'Reverse', type: 'toggle', default: false },
        { id: 'trim', label: 'Trim', type: 'toggle', default: true },
        { id: 'removeEmpty', label: 'No blanks', type: 'toggle', default: false },
        {
          id: 'caseInsensitive',
          label: 'Case-insensitive',
          type: 'toggle',
          default: false,
        },
      ]}
      transform={(input, opts) => {
        if (!input) return { output: '' };
        let lines = input.split('\n');
        if (opts.trim) lines = lines.map((l) => l.trim());
        if (opts.removeEmpty) lines = lines.filter((l) => l !== '');
        if (opts.dedupe) {
          const seen = new Set<string>();
          lines = lines.filter((l) => {
            const key = opts.caseInsensitive ? l.toLowerCase() : l;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        if (opts.sort) {
          lines.sort((a, b) => opts.caseInsensitive
            ? a.toLowerCase().localeCompare(b.toLowerCase())
            : a.localeCompare(b));
        }
        if (opts.reverse) lines.reverse();
        return { output: lines.join('\n') };
      }}
    />
  );
}
