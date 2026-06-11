import TwoColTool from '../../../components/ui/TwoColTool';

export default function HexAsciiTool() {
  return (
    <TwoColTool
      title="Hex ↔ ASCII / Text"
      description="Convert between hexadecimal and ASCII / UTF-8 text"
      options={[
        {
          id: 'direction',
          label: 'Direction',
          type: 'select',
          default: 'hex-to-ascii',
          options: [
            { label: 'Hex → Text', value: 'hex-to-ascii' },
            { label: 'Text → Hex', value: 'ascii-to-hex' },
          ],
        },
        {
          id: 'separator',
          label: 'Separator',
          type: 'select',
          default: 'none',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Space', value: 'space' },
            { label: 'Colon', value: 'colon' },
          ],
        },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          if (opts.direction === 'hex-to-ascii') {
            const hex = input.replace(/\s+|:/g, '');
            const bytes = hex.match(/.{1,2}/g) ?? [];
            return { output: bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join('') };
          } else {
            const sep = opts.separator === 'space' ? ' ' : opts.separator === 'colon' ? ':' : '';
            const bytes = new TextEncoder().encode(input);
            return { output: Array.from(bytes).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(sep) };
          }
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
