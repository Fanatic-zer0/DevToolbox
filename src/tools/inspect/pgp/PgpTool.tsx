import { useState } from 'react';
import * as openpgp from 'openpgp';
import { Terminal, Copy } from 'lucide-react';
import { usePgpKeyStore, type StoredPgpKey } from '../../../store';

function CliBlock({ commands }: { commands: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(commands); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors"
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2"><Terminal size={12} />CLI equivalent (gpg)</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="relative" style={{ background: '#0d1117' }}>
          <button
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#8b949e' }}
            onClick={copy}
          >
            <Copy size={10} />{copied ? 'Copied!' : 'Copy'}
          </button>
          <pre className="p-3 pr-16 text-xs font-mono overflow-x-auto" style={{ color: '#e6edf3', margin: 0, lineHeight: 1.6 }}>{commands}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Key Manager ─────────────────────────────────────────────────────────────
function KeyManager() {
  const { keys, addKey, removeKey } = usePgpKeyStore();
  const [armored, setArmored] = useState('');
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!armored.trim()) return;
    try {
      setError('');
      let parsed: openpgp.Key;
      let isPrivate = false;
      try {
        parsed = await openpgp.readPrivateKey({ armoredKey: armored });
        isPrivate = true;
      } catch {
        parsed = await openpgp.readKey({ armoredKey: armored });
      }
      const fingerprint = parsed.getFingerprint().toUpperCase();
      const uids = parsed.getUserIDs();
      addKey({
        id: fingerprint,
        fingerprint,
        keyId: parsed.getKeyID().toHex().toUpperCase(),
        userIds: uids,
        type: isPrivate ? 'private' : 'public',
        armoredKey: armored,
        createdAt: parsed.getCreationTime().toISOString(),
        capabilities: isPrivate ? ['sign', 'auth'] : ['encrypt', 'verify'],
      });
      setArmored('');
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <textarea
          className="input-base font-mono text-xs resize-none"
          rows={6}
          placeholder="Paste PEM-armored PGP key here…"
          value={armored}
          onChange={(e) => setArmored(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="btn btn-accent btn-sm" onClick={handleImport}>Import Key</button>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>

      {keys.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No keys imported yet.</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-start justify-between rounded-lg px-3 py-2.5 gap-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{k.userIds[0] ?? k.fingerprint.slice(-8)}</span>
                  <span className={`badge ${k.type === 'private' ? 'badge-warning' : 'badge-info'}`}>{k.type}</span>
                </div>
                <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{k.fingerprint}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.userIds.join(', ')}</p>
              </div>
              <button className="btn btn-ghost btn-sm text-red-400 flex-shrink-0" onClick={() => removeKey(k.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Key Generation ───────────────────────────────────────────────────────────
function KeyGenerationForm() {
  const { addKey } = usePgpKeyStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [bits, setBits] = useState('4096');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!name || !email) return;
    setLoading(true);
    try {
      const { privateKey, publicKey } = await openpgp.generateKey({
        type: 'rsa',
        rsaBits: parseInt(bits) as 2048 | 4096,
        userIDs: [{ name, email }],
        passphrase: passphrase || undefined,
      });
      setOutput(`${privateKey}\n\n${publicKey}`);
      // Import the public key into the store
      const parsed = await openpgp.readKey({ armoredKey: publicKey });
      addKey({
        id: parsed.getFingerprint().toUpperCase(),
        fingerprint: parsed.getFingerprint().toUpperCase(),
        keyId: parsed.getKeyID().toHex().toUpperCase(),
        armoredKey: publicKey,
        type: 'public',
        userIds: [`${name} <${email}>`],
        createdAt: new Date().toISOString(),
        capabilities: ['encrypt', 'verify'],
      });
    } catch (e) {
      setOutput(`Error: ${e}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label><input className="input-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alice" /></div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label><input className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alice@example.com" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Passphrase</label><input className="input-base" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Optional" /></div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key size</label>
          <select className="input-base" value={bits} onChange={(e) => setBits(e.target.value)}>
            <option value="2048">2048 bits</option><option value="4096">4096 bits</option>
          </select>
        </div>
      </div>
      <button className="btn btn-accent btn-sm" onClick={generate} disabled={loading || !name || !email}>
        {loading ? 'Generating…' : 'Generate Key Pair'}
      </button>
      {output && (
        <textarea className="input-base font-mono text-xs resize-none" rows={10} readOnly value={output} />
      )}
      <CliBlock commands={(() => {
        const n = name.trim() || 'Your Name';
        const e = email.trim() || 'you@example.com';
        return `# Interactive (recommended):\ngpg --full-gen-key\n\n# Or batch mode (non-interactive):\ngpg --batch --gen-key <<'EOF'\nKey-Type: RSA\nKey-Length: ${bits}\nName-Real: ${n}\nName-Email: ${e}\nName-Comment:\n${passphrase ? 'Passphrase: your-passphrase' : '%no-protection'}\n%commit\nEOF\n\n# Export keys after generation:\ngpg --export --armor "${e}" > public.asc\ngpg --export-secret-keys --armor "${e}" > private.asc`;
      })()} />
    </div>
  );
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────
function EncryptPanel() {
  const { keys } = usePgpKeyStore();
  const pubKeys = keys.filter((k) => k.type === 'public');
  const [message, setMessage] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const encrypt = async () => {
    if (!message || !selectedKeys.length) return;
    try {
      const encKeys = await Promise.all(
        keys.filter((k) => selectedKeys.includes(k.id)).map((k) => openpgp.readKey({ armoredKey: k.armoredKey }))
      );
      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: message }),
        encryptionKeys: encKeys,
      });
      setOutput(encrypted as string);
      setError('');
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-3">
      <textarea className="input-base font-mono resize-none" rows={5} placeholder="Plaintext message to encrypt…" value={message} onChange={(e) => setMessage(e.target.value)} />
      {pubKeys.length === 0 ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Import a public key in the Keys tab first.</p> : (
        <div>
          <p className="text-xs mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>Encrypt for (recipients):</p>
          <div className="space-y-1">
            {pubKeys.map((k) => (
              <label key={k.id} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={selectedKeys.includes(k.id)} onChange={(e) => setSelectedKeys(e.target.checked ? [...selectedKeys, k.id] : selectedKeys.filter((id) => id !== k.id))} />
                {k.userIds[0] ?? k.fingerprint.slice(-8)}
              </label>
            ))}
          </div>
        </div>
      )}
      <button className="btn btn-accent btn-sm" onClick={encrypt} disabled={!message || !selectedKeys.length}>Encrypt</button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {output && <textarea className="input-base font-mono text-xs resize-none" rows={8} readOnly value={output} />}
      <CliBlock commands={(() => {
        const recipients = keys
          .filter((k) => selectedKeys.includes(k.id))
          .map((k) => { const m = (k.userIds[0] ?? '').match(/<(.+)>/); return m ? m[1] : (k.userIds[0] ?? k.fingerprint.slice(-8)); });
        const recipientFlags = (recipients.length > 0 ? recipients : ['recipient@example.com'])
          .map((r) => `  --recipient "${r}" \\`).join('\n');
        return `gpg --encrypt \\\n${recipientFlags}\n  --armor \\\n  --output encrypted.asc \\\n  plaintext.txt`;
      })()} />
    </div>
  );
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────
function DecryptPanel() {
  const { keys } = usePgpKeyStore();
  const privKeys = keys.filter((k) => k.type === 'private');
  const [ciphertext, setCiphertext] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const decrypt = async () => {
    const kd = keys.find((k) => k.id === selectedKey);
    if (!ciphertext || !kd) return;
    try {
      let privKey = await openpgp.readPrivateKey({ armoredKey: kd.armoredKey });
      if (passphrase) privKey = await openpgp.decryptKey({ privateKey: privKey, passphrase });
      const msg = await openpgp.readMessage({ armoredMessage: ciphertext });
      const { data } = await openpgp.decrypt({ message: msg, decryptionKeys: privKey });
      setOutput(data as string);
      setError('');
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-3">
      <textarea className="input-base font-mono text-xs resize-none" rows={8} placeholder="Paste armored PGP message…" value={ciphertext} onChange={(e) => setCiphertext(e.target.value)} />
      {privKeys.length === 0 ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Import a private key first.</p> : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Private key</label>
            <select className="input-base" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
              <option value="">Select key…</option>
              {privKeys.map((k) => <option key={k.id} value={k.id}>{k.userIds[0] ?? k.fingerprint.slice(-8)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Passphrase</label><input className="input-base" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="If encrypted" /></div>
        </div>
      )}
      <button className="btn btn-accent btn-sm" onClick={decrypt} disabled={!ciphertext || !selectedKey}>Decrypt</button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {output && <textarea className="input-base font-mono resize-none" rows={5} readOnly value={output} />}
      <CliBlock commands={`gpg --decrypt \\\n  --output decrypted.txt \\\n  encrypted.asc\n\n# Or pipe to stdout:\ngpg --decrypt encrypted.asc`} />
    </div>
  );
}

// ─── Sign ─────────────────────────────────────────────────────────────────────
function SignPanel() {
  const { keys } = usePgpKeyStore();
  const privKeys = keys.filter((k) => k.type === 'private');
  const [message, setMessage] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const sign = async () => {
    const kd = keys.find((k) => k.id === selectedKey);
    if (!message || !kd) return;
    try {
      let privKey = await openpgp.readPrivateKey({ armoredKey: kd.armoredKey });
      if (passphrase) privKey = await openpgp.decryptKey({ privateKey: privKey, passphrase });
      const signed = await openpgp.sign({
        message: await openpgp.createMessage({ text: message }),
        signingKeys: privKey,
      });
      setOutput(signed as string);
      setError('');
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-3">
      <textarea className="input-base font-mono resize-none" rows={5} placeholder="Message to sign…" value={message} onChange={(e) => setMessage(e.target.value)} />
      {privKeys.length === 0 ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Import a private key first.</p> : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Private key</label>
            <select className="input-base" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
              <option value="">Select key…</option>
              {privKeys.map((k) => <option key={k.id} value={k.id}>{k.userIds[0] ?? k.fingerprint.slice(-8)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Passphrase</label><input className="input-base" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="If encrypted" /></div>
        </div>
      )}
      <button className="btn btn-accent btn-sm" onClick={sign} disabled={!message || !selectedKey}>Sign</button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {output && <textarea className="input-base font-mono text-xs resize-none" rows={10} readOnly value={output} />}
      <CliBlock commands={(() => {
        const kd = keys.find((k) => k.id === selectedKey);
        const uid = kd ? ((kd.userIds[0] ?? '').match(/<(.+)>/) || [])[1] ?? kd.userIds[0] ?? 'you@example.com' : 'you@example.com';
        return `# Clear-sign (message + signature in one file):\ngpg --clearsign \\\n  --local-user "${uid}" \\\n  message.txt\n\n# Detached signature (separate .sig file):\ngpg --detach-sign --armor \\\n  --local-user "${uid}" \\\n  message.txt`;
      })()} />
    </div>
  );
}

// ─── Verify ───────────────────────────────────────────────────────────────────
function VerifyPanel() {
  const { keys } = usePgpKeyStore();
  const pubKeys = keys.filter((k) => k.type === 'public');
  const [signedMsg, setSignedMsg] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  const verify = async () => {
    const kd = keys.find((k) => k.id === selectedKey);
    if (!signedMsg || !kd) return;
    try {
      const publicKey = await openpgp.readKey({ armoredKey: kd.armoredKey });
      const msg = await openpgp.readMessage({ armoredMessage: signedMsg });
      const { signatures } = await openpgp.verify({ message: msg, verificationKeys: publicKey });
      const valid = await signatures[0]?.verified;
      setResult({ valid: !!valid, message: valid ? 'Signature is valid!' : 'Signature could not be verified.' });
      setError('');
    } catch (e) { setError(String(e)); setResult(null); }
  };

  return (
    <div className="space-y-3">
      <textarea className="input-base font-mono text-xs resize-none" rows={8} placeholder="Paste PGP signed message…" value={signedMsg} onChange={(e) => setSignedMsg(e.target.value)} />
      {pubKeys.length === 0 ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Import the signer's public key first.</p> : (
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Verification key</label>
          <select className="input-base" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            <option value="">Select key…</option>
            {pubKeys.map((k) => <option key={k.id} value={k.id}>{k.userIds[0] ?? k.fingerprint.slice(-8)}</option>)}
          </select>
        </div>
      )}
      <button className="btn btn-accent btn-sm" onClick={verify} disabled={!signedMsg || !selectedKey}>Verify</button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {result && (
        <div className={`rounded-lg px-3 py-2.5 text-sm font-medium ${result.valid ? 'badge-success' : 'badge-danger'}`}
          style={{ background: result.valid ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: result.valid ? 'var(--success)' : 'var(--danger)' }}>
          {result.message}
        </div>
      )}
      <CliBlock commands={`# Verify a clear-signed or inline-signed message:\ngpg --verify signed_message.asc\n\n# Verify with detached signature:\ngpg --verify signature.asc original_file.txt\n\n# Show signer details:\ngpg --verify --verbose signed_message.asc`} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'keys', label: 'Keys' },
  { id: 'generate', label: 'Generate' },
  { id: 'encrypt', label: 'Encrypt' },
  { id: 'decrypt', label: 'Decrypt' },
  { id: 'sign', label: 'Sign' },
  { id: 'verify', label: 'Verify' },
];

export default function PgpTool() {
  const [tab, setTab] = useState('keys');

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>PGP / GPG Tool</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Encrypt, decrypt, sign and verify messages — runs entirely in your browser</p>
      </div>

      <div className="flex border-b gap-1 px-4" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-accent' : 'border-transparent'}`}
            style={{ color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)' }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-2xl">
        {tab === 'keys' && <KeyManager />}
        {tab === 'generate' && <KeyGenerationForm />}
        {tab === 'encrypt' && <EncryptPanel />}
        {tab === 'decrypt' && <DecryptPanel />}
        {tab === 'sign' && <SignPanel />}
        {tab === 'verify' && <VerifyPanel />}
      </div>
    </div>
  );
}
