import TwoColTool from '../../../components/ui/TwoColTool';

function encodeBase64(input: string, urlSafe: boolean): string {
  try {
    const b64 = btoa(unescape(encodeURIComponent(input)));
    return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') : b64;
  } catch {
    return 'Error: could not encode to Base64';
  }
}

function decodeBase64(input: string): string {
  try {
    const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(normalized)));
  } catch {
    return 'Error: invalid Base64 input';
  }
}

export default function Base64StringTool() {
  return (
    <TwoColTool
      title="Base64 String Encode / Decode"
      description="Encode strings to Base64 or decode Base64 back to text"
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
        { id: 'urlSafe', label: 'URL-safe', type: 'toggle', default: false },
      ]}
      transform={(input, opts) => {
        if (!input) return { output: '' };
        if (opts.mode === 'encode') {
          return { output: encodeBase64(input, Boolean(opts.urlSafe)) };
        }
        return { output: decodeBase64(input) };
      }}
    />
  );
}
