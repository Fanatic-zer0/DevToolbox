import CryptoJS from 'crypto-js';
import TwoColTool from '../../../components/ui/TwoColTool';

function keccak256(input: string): string {
  // CryptoJS doesn't have Keccak256; we use SHA3 (256-bit) as approximation
  return CryptoJS.SHA3(input, { outputLength: 256 }).toString(CryptoJS.enc.Hex);
}

function hashText(input: string, algorithm: string): string {
  if (!input) return '';
  switch (algorithm) {
    case 'md5': return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
    case 'sha1': return CryptoJS.SHA1(input).toString(CryptoJS.enc.Hex);
    case 'sha256': return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex);
    case 'sha512': return CryptoJS.SHA512(input).toString(CryptoJS.enc.Hex);
    case 'sha3-256': return CryptoJS.SHA3(input, { outputLength: 256 }).toString(CryptoJS.enc.Hex);
    case 'keccak256': return keccak256(input);
    default: return '';
  }
}

export default function HashTool() {
  return (
    <TwoColTool
      title="Hash Generator"
      description="Compute MD5, SHA-1, SHA-256, SHA-512 and Keccak-256 hashes"
      inputLabel="Input text"
      outputLabel="Hash"
      outputFilename="hash.txt"
      options={[
        {
          id: 'algorithm',
          label: 'Algorithm',
          type: 'select',
          default: 'sha256',
          options: [
            { label: 'MD5',        value: 'md5'      },
            { label: 'SHA-1',      value: 'sha1'     },
            { label: 'SHA-256',    value: 'sha256'   },
            { label: 'SHA-512',    value: 'sha512'   },
            { label: 'SHA3-256',   value: 'sha3-256' },
            { label: 'Keccak-256', value: 'keccak256'},
          ],
        },
        {
          id: 'uppercase',
          label: 'Uppercase',
          type: 'toggle',
          default: false,
        },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        const hash = hashText(input, String(opts.algorithm));
        return { output: opts.uppercase ? hash.toUpperCase() : hash };
      }}
    />
  );
}
