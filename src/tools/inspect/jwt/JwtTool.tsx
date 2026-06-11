import { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

function base64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4);
  return atob(padded);
}

function parseJwt(token: string) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('JWT must have exactly 3 parts separated by dots');
  const header = JSON.parse(base64urlDecode(parts[0]));
  const payload = JSON.parse(base64urlDecode(parts[1]));
  const signature = parts[2];
  return { header, payload, signature, raw: { header: parts[0], payload: parts[1], signature: parts[2] } };
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function JwtTool() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReturnType<typeof parseJwt> | null>(null);

  const handleChange = (value: string) => {
    setInput(value);
    if (!value.trim()) { setResult(null); setError(''); return; }
    try {
      setResult(parseJwt(value));
      setError('');
    } catch (e) {
      setResult(null);
      setError(String(e));
    }
  };

  const now = Math.floor(Date.now() / 1000);
  const expired = result?.payload?.exp && result.payload.exp < now;
  const notYetValid = result?.payload?.nbf && result.payload.nbf > now;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>JWT Debugger</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Decode and inspect JSON Web Tokens</p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            {expired ? (
              <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={11} /> Expired</span>
            ) : notYetValid ? (
              <span className="badge badge-warning">Not yet valid</span>
            ) : (
              <span className="badge badge-success flex items-center gap-1"><CheckCircle size={11} /> Valid structure</span>
            )}
            <span className="badge badge-info">{result.header.alg}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>JWT Token</label>
          <textarea
            className="input-base font-mono text-xs resize-none"
            rows={4}
            placeholder="Paste your JWT here…"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
          />
          {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Header" color="#f472b6" data={result.header}>
              <Field label="Algorithm" value={result.header.alg} />
              <Field label="Type" value={result.header.typ} />
            </Section>

            <Section title="Payload" color="#34d399" data={result.payload}>
              {result.payload.sub && <Field label="Subject" value={result.payload.sub} />}
              {result.payload.iss && <Field label="Issuer" value={result.payload.iss} />}
              {result.payload.aud && <Field label="Audience" value={String(result.payload.aud)} />}
              {result.payload.iat && <Field label="Issued at" value={formatDate(result.payload.iat)} />}
              {result.payload.exp && <Field label="Expires" value={`${formatDate(result.payload.exp)} ${expired ? '(EXPIRED)' : ''}`} />}
              {result.payload.nbf && <Field label="Not before" value={formatDate(result.payload.nbf)} />}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, data, children }: { title: string; color: string; data: unknown; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <div className="px-3 py-2 text-xs font-semibold" style={{ background: color + '22', color }}>
        {title}
      </div>
      <div className="p-3 space-y-1">{children}</div>
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', maxHeight: 160 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="font-medium flex-shrink-0" style={{ color: 'var(--text-muted)', width: 80 }}>{label}</span>
      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
