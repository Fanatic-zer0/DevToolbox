import TwoColTool from '../../../components/ui/TwoColTool';

export default function UrlEncodeTool() {
  return (
    <TwoColTool
      title="URL Encode / Decode"
      description="Percent-encode or decode URL components"
      options={[
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          default: 'encode',
          options: [
            { label: 'Encode', value: 'encode' },
            { label: 'Decode', value: 'decode' },
          ],
        },
        {
          id: 'full',
          label: 'Full URL',
          type: 'toggle',
          default: false,
        },
      ]}
      transform={(input, opts) => {
        if (!input) return { output: '' };
        try {
          if (opts.mode === 'encode') {
            const out = opts.full ? encodeURIComponent(input) : encodeURIComponent(input);
            return { output: out };
          } else {
            return { output: decodeURIComponent(input.replace(/\+/g, ' ')) };
          }
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
