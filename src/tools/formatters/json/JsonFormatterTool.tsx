import TwoColTool from '../../../components/ui/TwoColTool';

export default function JsonFormatterTool() {
  return (
    <TwoColTool
      title="JSON Formatter"
      description="Pretty-print, minify, and sort JSON"
      inputLang="json"
      outputLang="json"
      outputFilename="output.json"
      options={[
        { id: 'indent', label: 'Indent', type: 'select', default: '2', options: [{ label: '2 spaces', value: '2' }, { label: '4 spaces', value: '4' }, { label: 'Tab', value: 'tab' }] },
        { id: 'sortKeys', label: 'Sort keys', type: 'toggle', default: false },
        { id: 'minify', label: 'Minify', type: 'toggle', default: false },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const parsed = JSON.parse(input);
          const indent = opts.sortKeys ? undefined : (opts.indent === 'tab' ? '\t' : parseInt(String(opts.indent)));

          const sortedParse = (val: unknown): unknown => {
            if (Array.isArray(val)) return val.map(sortedParse);
            if (val && typeof val === 'object') {
              return Object.fromEntries(
                Object.keys(val as object)
                  .sort()
                  .map((k) => [k, sortedParse((val as Record<string, unknown>)[k])])
              );
            }
            return val;
          };

          const data = opts.sortKeys ? sortedParse(parsed) : parsed;
          if (opts.minify) return { output: JSON.stringify(data) };
          return { output: JSON.stringify(data, null, opts.indent === 'tab' ? '\t' : parseInt(String(opts.indent))) };
        } catch (e) {
          return { output: '', error: `JSON error: ${e}` };
        }
      }}
    />
  );
}
