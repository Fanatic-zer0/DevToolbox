import { useState } from 'react';
import * as forge from 'node-forge';
import { CheckCircle, XCircle, Copy, Download, Loader2, Terminal } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function attrMap(attrs: forge.pki.CertificateField[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const a of attrs) m[String(a.shortName ?? a.name)] = String(a.value);
  return m;
}

function certFingerprint(cert: forge.pki.Certificate, algo: 'sha1' | 'sha256'): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes();
  const md = algo === 'sha1' ? forge.md.sha1.create() : forge.md.sha256.create();
  return md.update(der).digest().toHex().replace(/../g, (h) => h.toUpperCase() + ':').slice(0, -1);
}

function splitPemCerts(pem: string): string[] {
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
  return pem.match(regex) ?? [];
}

function getRsaModulus(key: forge.pki.PublicKey | forge.pki.PrivateKey): string {
  return (key as forge.pki.rsa.PublicKey).n?.toString(16) ?? '';
}

// Async RSA key-pair generator (uses web workers when available)
function generateRsaKeyPair(bits: number): Promise<forge.pki.rsa.KeyPair> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits, workers: -1 }, (err, kp) => {
      if (err) reject(err);
      else resolve(kp);
    });
  });
}

function pemDownload(pem: string, filename: string) {
  const blob = new Blob([pem], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function binaryDownload(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes.buffer as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const go = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={go}>
      <Copy size={11} />{copied ? 'Copied!' : label}
    </button>
  );
}

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
        <span className="flex items-center gap-2"><Terminal size={12} />CLI equivalent (openssl)</span>
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

function PemOutput({ label, pem, filename }: { label: string; pem: string; filename: string }) {
  if (!pem) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="flex gap-1">
          <CopyBtn text={pem} />
          <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={() => pemDownload(pem, filename)}>
            <Download size={11} />Download
          </button>
        </div>
      </div>
      <textarea className="input-base font-mono text-xs resize-none" rows={6} readOnly value={pem} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs flex-shrink-0 font-medium" style={{ color: 'var(--text-muted)', width: 120 }}>{label}</span>
      <span className="text-xs font-mono break-all" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)' }}>{title}</div>
      <div className="px-3">{children}</div>
    </div>
  );
}

function MatchBadge({ match, yes, no }: { match: boolean | null; yes: string; no: string }) {
  if (match === null) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold"
      style={{ background: match ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', color: match ? 'var(--success)' : 'var(--danger)', border: `1px solid ${match ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
      {match ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {match ? yes : no}
    </div>
  );
}

// ─── Tab: Decode ─────────────────────────────────────────────────────────────

function DecodeTab() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<{
    subject: Record<string, string>; issuer: Record<string, string>;
    serial: string; notBefore: string; notAfter: string; san: string[];
    fingerprints: { sha1: string; sha256: string }; publicKey: { type: string; bits: number };
    signatureAlg: string; version: number;
  } | null>(null);

  const parse = () => {
    if (!input.trim()) return;
    try {
      const cert = forge.pki.certificateFromPem(input);
      const san: string[] = [];
      const ext = cert.getExtension('subjectAltName') as { altNames?: { type: number; value?: string; ip?: string }[] } | null;
      for (const n of ext?.altNames ?? []) {
        if (n.type === 2 && n.value) san.push(`DNS: ${n.value}`);
        else if (n.type === 7 && n.ip) san.push(`IP: ${n.ip}`);
      }
      // Detect key type without assuming RSA
      let keyType = 'Unknown';
      let keyBits = 0;
      const pubKeyInfo = (cert as any).publicKey;
      const sigOid = cert.siginfo.algorithmOid;
      // EC / ECDSA OIDs
      const ecOids = ['1.2.840.10045.2.1'];
      const edOids = ['1.3.101.112', '1.3.101.113']; // Ed25519, Ed448
      try {
        const rsaPub = cert.publicKey as forge.pki.rsa.PublicKey;
        if (rsaPub.n) { keyType = 'RSA'; keyBits = rsaPub.n.bitLength(); }
      } catch {
        // not RSA — determine from OID
        const spkiAsn1 = forge.pki.publicKeyToAsn1(pubKeyInfo);
        const algOid: string = (spkiAsn1 as any).value?.[0]?.value?.[0]?.value ?? sigOid;
        if (ecOids.includes(algOid) || sigOid.startsWith('1.2.840.10045')) {
          keyType = 'EC (ECDSA)';
          // curve OID is the second param in algorithm sequence
          const curveOid: string = (spkiAsn1 as any).value?.[0]?.value?.[1]?.value ?? '';
          const curveMap: Record<string, number> = {
            '1.2.840.10045.3.1.7': 256,   // P-256
            '1.3.132.0.34': 384,            // P-384
            '1.3.132.0.35': 521,            // P-521
          };
          keyBits = curveMap[curveOid] ?? 0;
        } else if (edOids.includes(algOid)) {
          keyType = algOid === '1.3.101.112' ? 'Ed25519' : 'Ed448';
          keyBits = algOid === '1.3.101.112' ? 256 : 448;
        }
      }
      setInfo({
        subject: attrMap(cert.subject.attributes), issuer: attrMap(cert.issuer.attributes),
        serial: cert.serialNumber, notBefore: cert.validity.notBefore.toISOString(),
        notAfter: cert.validity.notAfter.toISOString(), san,
        fingerprints: { sha1: certFingerprint(cert, 'sha1'), sha256: certFingerprint(cert, 'sha256') },
        publicKey: { type: keyType, bits: keyBits },
        signatureAlg: sigOid, version: cert.version + 1,
      });
      setError('');
    } catch (e) { setError(String(e)); setInfo(null); }
  };

  const now = new Date();
  const expired = info ? new Date(info.notAfter) < now : false;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>PEM Certificate</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={8}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          value={input} onChange={(e) => setInput(e.target.value)} />
        {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="flex items-center gap-2 mt-2">
          <button className="btn btn-accent btn-sm" onClick={parse}>Parse Certificate</button>
          {info && <span className={`badge ${expired ? 'badge-danger' : 'badge-success'}`}>{expired ? 'Expired' : 'Valid'}</span>}
        </div>
      </div>
      {info && (
        <div className="space-y-3 max-w-2xl">
          <Section title="Subject">{Object.entries(info.subject).map(([k, v]) => <Field key={k} label={k} value={v} />)}</Section>
          <Section title="Issuer">{Object.entries(info.issuer).map(([k, v]) => <Field key={k} label={k} value={v} />)}</Section>
          <Section title="Validity">
            <Field label="Not Before" value={new Date(info.notBefore).toLocaleString()} />
            <Field label="Not After" value={`${new Date(info.notAfter).toLocaleString()}${expired ? '  ⚠ EXPIRED' : ''}`} />
            <Field label="Version" value={`v${info.version}`} />
            <Field label="Serial" value={info.serial} />
          </Section>
          {info.san.length > 0 && (
            <Section title="Subject Alternative Names">
              {info.san.map((s, i) => <Field key={i} label={`SAN ${i + 1}`} value={s} />)}
            </Section>
          )}
          <Section title="Public Key">
            <Field label="Type" value={info.publicKey.type} />
            <Field label="Bits" value={String(info.publicKey.bits)} />
            <Field label="Signature Alg" value={info.signatureAlg} />
          </Section>
          <Section title="Fingerprints">
            <Field label="SHA-1" value={info.fingerprints.sha1} />
            <Field label="SHA-256" value={info.fingerprints.sha256} />
          </Section>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Cert ↔ Key ─────────────────────────────────────────────────────────

function CertKeyTab() {
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [result, setResult] = useState<{ match: boolean; certBits: number; keyBits: number; detail: string } | null>(null);
  const [error, setError] = useState('');

  const check = () => {
    setError(''); setResult(null);
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const privKey = forge.pki.privateKeyFromPem(keyPem);
      const certMod = getRsaModulus(cert.publicKey);
      const keyMod = getRsaModulus(privKey as unknown as forge.pki.PublicKey);
      const match = certMod.length > 0 && certMod === keyMod;
      const certPub = cert.publicKey as forge.pki.rsa.PublicKey;
      const keyPriv = privKey as forge.pki.rsa.PrivateKey;
      setResult({
        match,
        certBits: certPub.n?.bitLength() ?? 0,
        keyBits: keyPriv.n?.bitLength() ?? 0,
        detail: match ? 'Public key modulus in certificate matches the private key.' : 'Moduli do NOT match — this key did not generate this certificate.',
      });
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Verifies that a certificate's public key modulus matches the corresponding private key.
      </p>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Certificate (PEM)</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={6}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          value={certPem} onChange={(e) => setCertPem(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Private Key (PEM)</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={6}
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...or...&#10;-----BEGIN PRIVATE KEY-----"
          value={keyPem} onChange={(e) => setKeyPem(e.target.value)} />
      </div>
      <button className="btn btn-accent btn-sm" onClick={check} disabled={!certPem.trim() || !keyPem.trim()}>
        Check Match
      </button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {result && (
        <div className="space-y-3">
          <MatchBadge match={result.match} yes="Certificate and Private Key MATCH" no="Certificate and Private Key do NOT match" />
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Certificate key size', value: `${result.certBits} bits` }, { label: 'Private key size', value: `${result.keyBits} bits` }].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="text-base font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{result.detail}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Cert ↔ CSR ─────────────────────────────────────────────────────────

function CertCsrTab() {
  const [certPem, setCertPem] = useState('');
  const [csrPem, setCsrPem] = useState('');
  const [result, setResult] = useState<{
    modulusMatch: boolean; subjectMatch: boolean;
    certSubject: string; csrSubject: string;
  } | null>(null);
  const [error, setError] = useState('');

  const check = () => {
    setError(''); setResult(null);
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const csr = forge.pki.certificationRequestFromPem(csrPem);
      if (!csr.verify()) throw new Error('CSR signature is invalid');
      const certMod = getRsaModulus(cert.publicKey);
      const csrMod = getRsaModulus(csr.publicKey as forge.pki.PublicKey);
      const modulusMatch = certMod.length > 0 && certMod === csrMod;
      const certSub = attrMap(cert.subject.attributes);
      const csrSub = attrMap(csr.subject.attributes);
      const certSubStr = Object.entries(certSub).map(([k, v]) => `${k}=${v}`).join(', ');
      const csrSubStr = Object.entries(csrSub).map(([k, v]) => `${k}=${v}`).join(', ');
      const subjectMatch = certSubStr === csrSubStr;
      setResult({ modulusMatch, subjectMatch, certSubject: certSubStr, csrSubject: csrSubStr });
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Verifies that a certificate was issued from a given CSR — checks public key and subject match.
      </p>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Certificate (PEM)</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={5}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          value={certPem} onChange={(e) => setCertPem(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>CSR / Certificate Signing Request (PEM)</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={5}
          placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;...&#10;-----END CERTIFICATE REQUEST-----"
          value={csrPem} onChange={(e) => setCsrPem(e.target.value)} />
      </div>
      <button className="btn btn-accent btn-sm" onClick={check} disabled={!certPem.trim() || !csrPem.trim()}>
        Check Match
      </button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {result && (
        <div className="space-y-3">
          <MatchBadge match={result.modulusMatch && result.subjectMatch}
            yes="Certificate was issued from this CSR" no="Certificate does NOT match this CSR" />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              {result.modulusMatch ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : <XCircle size={13} style={{ color: 'var(--danger)' }} />}
              <span style={{ color: 'var(--text-primary)' }}>Public key modulus {result.modulusMatch ? 'matches' : 'does NOT match'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {result.subjectMatch ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : <XCircle size={13} style={{ color: 'var(--danger)' }} />}
              <span style={{ color: 'var(--text-primary)' }}>Subject DN {result.subjectMatch ? 'matches' : 'does NOT match'}</span>
            </div>
          </div>
          {!result.subjectMatch && (
            <div className="space-y-1 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              <p><span style={{ color: 'var(--text-muted)' }}>Cert subject: </span>{result.certSubject}</p>
              <p><span style={{ color: 'var(--text-muted)' }}>CSR subject:  </span>{result.csrSubject}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Chain Verify ────────────────────────────────────────────────────────

interface ChainLink {
  index: number; subject: string; issuer: string;
  notAfter: string; selfSigned: boolean;
  issuerChainOk: boolean; signatureOk: boolean | null;
}

function ChainVerifyTab() {
  const [chainPem, setChainPem] = useState('');
  const [links, setLinks] = useState<ChainLink[]>([]);
  const [error, setError] = useState('');
  const [overallOk, setOverallOk] = useState<boolean | null>(null);

  const verify = () => {
    setError(''); setLinks([]); setOverallOk(null);
    try {
      const pems = splitPemCerts(chainPem);
      if (pems.length === 0) throw new Error('No certificates found. Paste one or more PEM certificates.');
      const certs = pems.map((p) => forge.pki.certificateFromPem(p));
      const now = new Date();
      const result: ChainLink[] = certs.map((cert, i) => {
        const subj = attrMap(cert.subject.attributes);
        const iss = attrMap(cert.issuer.attributes);
        const toStr = (m: Record<string, string>) => Object.entries(m).map(([k, v]) => `${k}=${v}`).join(', ');
        const selfSigned = toStr(subj) === toStr(iss);
        // Check issuer DN matches next cert's subject
        let issuerChainOk = selfSigned;
        if (!selfSigned && i + 1 < certs.length) {
          const nextSubj = attrMap(certs[i + 1].subject.attributes);
          issuerChainOk = toStr(iss) === toStr(nextSubj);
        }
        // Signature verify (leaf → issuer)
        let signatureOk: boolean | null = null;
        if (!selfSigned && i + 1 < certs.length) {
          try { signatureOk = certs[i + 1].verify(cert); } catch { signatureOk = false; }
        } else if (selfSigned) {
          try { signatureOk = cert.verify(cert); } catch { signatureOk = false; }
        }
        return {
          index: i, subject: toStr(subj), issuer: toStr(iss),
          notAfter: cert.validity.notAfter.toISOString(), selfSigned,
          issuerChainOk, signatureOk,
        };
      });
      setLinks(result);
      const allOk = result.every((l) => l.issuerChainOk && l.signatureOk !== false && new Date(l.notAfter) >= now);
      setOverallOk(allOk);
    } catch (e) { setError(String(e)); }
  };

  const now = new Date();

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Paste the full certificate chain (leaf first, then intermediates, then root CA). Each cert must be PEM encoded.
      </p>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Certificate Chain (PEM — one or more certs)</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={10}
          placeholder={"-----BEGIN CERTIFICATE-----\n(leaf cert)\n-----END CERTIFICATE-----\n\n-----BEGIN CERTIFICATE-----\n(intermediate)\n-----END CERTIFICATE-----\n\n-----BEGIN CERTIFICATE-----\n(root CA)\n-----END CERTIFICATE-----"}
          value={chainPem} onChange={(e) => setChainPem(e.target.value)} />
      </div>
      <button className="btn btn-accent btn-sm" onClick={verify} disabled={!chainPem.trim()}>Verify Chain</button>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {links.length > 0 && (
        <div className="space-y-3">
          <MatchBadge match={overallOk!}
            yes={`Chain is valid (${links.length} certificate${links.length > 1 ? 's' : ''})`}
            no="Chain has issues — see details below" />
          {links.map((link) => {
            const expired = new Date(link.notAfter) < now;
            return (
              <div key={link.index} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>
                    {link.index === 0 ? 'Leaf' : link.selfSigned ? 'Root CA' : `Intermediate ${link.index}`}
                  </span>
                  {expired && <span className="badge badge-danger text-xs">Expired</span>}
                  {link.selfSigned && <span className="badge badge-info text-xs">Self-signed</span>}
                </div>
                <div className="px-3">
                  <Field label="Subject" value={link.subject} />
                  <Field label="Issuer" value={link.issuer} />
                  <Field label="Not After" value={`${new Date(link.notAfter).toLocaleString()}${expired ? ' ⚠' : ''}`} />
                  <div className="flex gap-4 py-2 text-xs">
                    <span className="flex items-center gap-1">
                      {link.issuerChainOk ? <CheckCircle size={11} style={{ color: 'var(--success)' }} /> : <XCircle size={11} style={{ color: 'var(--danger)' }} />}
                      <span style={{ color: 'var(--text-secondary)' }}>Issuer chain</span>
                    </span>
                    {link.signatureOk !== null && (
                      <span className="flex items-center gap-1">
                        {link.signatureOk ? <CheckCircle size={11} style={{ color: 'var(--success)' }} /> : <XCircle size={11} style={{ color: 'var(--danger)' }} />}
                        <span style={{ color: 'var(--text-secondary)' }}>Signature</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Generate CSR ───────────────────────────────────────────────────────

function GenCsrTab() {
  const [cn, setCn] = useState('');
  const [org, setOrg] = useState('');
  const [ou, setOu] = useState('');
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [san, setSan] = useState('');
  const [keySize, setKeySize] = useState<'2048' | '4096'>('2048');
  const [csrPem, setCsrPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!cn.trim()) { setError('Common Name is required.'); return; }
    setError(''); setLoading(true); setCsrPem(''); setKeyPem('');
    try {
      const kp = await generateRsaKeyPair(parseInt(keySize));
      const csr = forge.pki.createCertificationRequest();
      csr.publicKey = kp.publicKey;
      const attrs: forge.pki.CertificateField[] = [{ name: 'commonName', value: cn.trim() }];
      if (org.trim()) attrs.push({ name: 'organizationName', value: org.trim() });
      if (ou.trim()) attrs.push({ name: 'organizationalUnitName', value: ou.trim() });
      if (country.trim()) attrs.push({ name: 'countryName', value: country.trim() });
      if (state.trim()) attrs.push({ name: 'stateOrProvinceName', value: state.trim() });
      if (locality.trim()) attrs.push({ name: 'localityName', value: locality.trim() });
      csr.setSubject(attrs);
      // SANs in a CSR require a challengePassword extensions attribute; the CA usually sets them from the cert template.
      // We add them as a CSR extensions request (extensionRequest / OID 1.2.840.113549.1.9.14) if provided.
      const sanList = san.split(',').map((s) => s.trim()).filter(Boolean);
      if (sanList.length > 0) {
        csr.setAttributes([{
          name: 'extensionRequest',
          extensions: [{ name: 'subjectAltName', altNames: sanList.map((s) => {
            const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(s) || s.startsWith('[');
            return isIp ? { type: 7, ip: s } : { type: 2, value: s };
          }) }],
        }]);
      }
      csr.sign(kp.privateKey, forge.md.sha256.create());
      setCsrPem(forge.pki.certificationRequestToPem(csr));
      setKeyPem(forge.pki.privateKeyToPem(kp.privateKey));
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Generate a Certificate Signing Request and private key. Send the CSR to a CA to obtain a signed certificate.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Common Name (CN) *</label>
          <input className="input-base" value={cn} onChange={(e) => setCn(e.target.value)} placeholder="example.com" />
        </div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Organization (O)</label>
          <input className="input-base" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="My Company Ltd" /></div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Org Unit (OU)</label>
          <input className="input-base" value={ou} onChange={(e) => setOu(e.target.value)} placeholder="Engineering" /></div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Country (2-letter)</label>
          <input className="input-base" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" maxLength={2} /></div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>State / Province</label>
          <input className="input-base" value={state} onChange={(e) => setState(e.target.value)} placeholder="California" /></div>
        <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Locality / City</label>
          <input className="input-base" value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="San Francisco" /></div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key Size</label>
          <select className="input-base text-xs" value={keySize} onChange={(e) => setKeySize(e.target.value as '2048' | '4096')}>
            <option value="2048">2048 bits</option><option value="4096">4096 bits</option>
          </select>
        </div>
        <div className="col-span-2"><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Subject Alternative Names (comma-separated: DNS or IP)</label>
          <input className="input-base font-mono text-xs" value={san} onChange={(e) => setSan(e.target.value)} placeholder="www.example.com, api.example.com, 192.168.1.1" /></div>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button className="btn btn-accent btn-sm flex items-center gap-2" onClick={generate} disabled={loading}>
        {loading && <Loader2 size={12} className="animate-spin" />}{loading ? 'Generating…' : 'Generate CSR + Key'}
      </button>
      <div className="space-y-3">
        <PemOutput label="Certificate Signing Request (CSR)" pem={csrPem} filename="request.csr" />
        <PemOutput label="Private Key (keep secret!)" pem={keyPem} filename="private.key" />
        <CliBlock commands={(() => {
          const cnVal = cn.trim() || 'example.com';
          const subj: string[] = [`/CN=${cnVal}`];
          if (org.trim()) subj.push(`O=${org.trim()}`);
          if (ou.trim()) subj.push(`OU=${ou.trim()}`);
          if (country.trim()) subj.push(`C=${country.trim()}`);
          if (state.trim()) subj.push(`ST=${state.trim()}`);
          if (locality.trim()) subj.push(`L=${locality.trim()}`);
          const subjStr = subj.join('/');
          const sanList = san.split(',').map((s) => s.trim()).filter(Boolean);
          const sanStr = sanList.map((s) => (/^\d+\.\d+\.\d+\.\d+$/.test(s) ? `IP:${s}` : `DNS:${s}`)).join(',');
          const addExt = sanStr ? ` \\\n  -addext "subjectAltName=${sanStr}"` : '';
          return `# Generate private key\nopenssl genrsa -out private.key ${keySize}\n\n# Create CSR\nopenssl req -new \\\n  -key private.key \\\n  -subj "${subjStr}"${addExt} \\\n  -out request.csr\n\n# Verify CSR\nopenssl req -in request.csr -noout -text`;
        })()} />
      </div>
    </div>
  );
}

// ─── Tab: Generate Certificate ────────────────────────────────────────────────

type CertType = 'self-signed' | 'ca-signed' | 'root-ca' | 'intermediate-ca';

function GenCertTab() {
  const [certType, setCertType] = useState<CertType>('self-signed');
  const [cn, setCn] = useState('');
  const [org, setOrg] = useState('');
  const [ou, setOu] = useState('');
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [san, setSan] = useState('');
  const [keySize, setKeySize] = useState<'2048' | '4096'>('2048');
  const [validDays, setValidDays] = useState('365');
  const [caPem, setCaPem] = useState('');
  const [caKeyPem, setCaKeyPem] = useState('');
  const [csrPem, setCsrPem] = useState('');
  const [certOut, setCertOut] = useState('');
  const [keyOut, setKeyOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const CERT_TYPES: { id: CertType; label: string; desc: string }[] = [
    { id: 'self-signed', label: 'Self-Signed', desc: 'Generate key + cert, signed by itself' },
    { id: 'ca-signed', label: 'CA-Signed', desc: 'Sign an existing CSR with a CA cert + key' },
    { id: 'root-ca', label: 'Root CA', desc: 'Create a self-signed Root CA certificate' },
    { id: 'intermediate-ca', label: 'Intermediate CA', desc: 'CA cert signed by a Root CA' },
  ];

  const buildSubject = (): forge.pki.CertificateField[] => {
    const attrs: forge.pki.CertificateField[] = [{ name: 'commonName', value: cn.trim() }];
    if (org.trim()) attrs.push({ name: 'organizationName', value: org.trim() });
    if (ou.trim()) attrs.push({ name: 'organizationalUnitName', value: ou.trim() });
    if (country.trim()) attrs.push({ name: 'countryName', value: country.trim() });
    if (state.trim()) attrs.push({ name: 'stateOrProvinceName', value: state.trim() });
    if (locality.trim()) attrs.push({ name: 'localityName', value: locality.trim() });
    return attrs;
  };

  const sanExtension = (): Record<string, unknown> | null => {
    const sanList = san.split(',').map((s) => s.trim()).filter(Boolean);
    if (sanList.length === 0) return null;
    return { name: 'subjectAltName', altNames: sanList.map((s) => {
      const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(s);
      return isIp ? { type: 7, ip: s } : { type: 2, value: s };
    }) };
  };

  const days = parseInt(validDays) || 365;

  const generate = async () => {
    if (!cn.trim() && certType !== 'ca-signed') { setError('Common Name is required.'); return; }
    setError(''); setLoading(true); setCertOut(''); setKeyOut('');
    try {
      if (certType === 'self-signed') {
        const kp = await generateRsaKeyPair(parseInt(keySize));
        const cert = forge.pki.createCertificate();
        cert.publicKey = kp.publicKey;
        cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now() + days * 86400000);
        const attrs = buildSubject();
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        const exts: any[] = [
          { name: 'basicConstraints', cA: false },
          { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
          { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
          { name: 'subjectKeyIdentifier' },
        ];
        const sanExt = sanExtension();
        if (sanExt) exts.push(sanExt);
        cert.setExtensions(exts);
        cert.sign(kp.privateKey, forge.md.sha256.create());
        setCertOut(forge.pki.certificateToPem(cert));
        setKeyOut(forge.pki.privateKeyToPem(kp.privateKey));

      } else if (certType === 'root-ca') {
        const kp = await generateRsaKeyPair(parseInt(keySize));
        const cert = forge.pki.createCertificate();
        cert.publicKey = kp.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now() + days * 86400000);
        const attrs = buildSubject();
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([
          { name: 'basicConstraints', cA: true, critical: true } as any,
          { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true } as any,
          { name: 'subjectKeyIdentifier' } as any,
        ]);
        cert.sign(kp.privateKey, forge.md.sha256.create());
        setCertOut(forge.pki.certificateToPem(cert));
        setKeyOut(forge.pki.privateKeyToPem(kp.privateKey));

      } else if (certType === 'intermediate-ca') {
        if (!caPem.trim() || !caKeyPem.trim()) { setError('Root CA certificate and key are required for Intermediate CA.'); setLoading(false); return; }
        const caCert = forge.pki.certificateFromPem(caPem);
        const caKey = forge.pki.privateKeyFromPem(caKeyPem);
        const kp = await generateRsaKeyPair(parseInt(keySize));
        const cert = forge.pki.createCertificate();
        cert.publicKey = kp.publicKey;
        cert.serialNumber = '02' + forge.util.bytesToHex(forge.random.getBytesSync(8));
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now() + days * 86400000);
        const attrs = buildSubject();
        cert.setSubject(attrs);
        cert.setIssuer(caCert.subject.attributes);
        cert.setExtensions([
          { name: 'basicConstraints', cA: true, pathlenConstraint: 0, critical: true } as any,
          { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true } as any,
          { name: 'subjectKeyIdentifier' } as any,
          { name: 'authorityKeyIdentifier', keyIdentifier: true } as any,
        ]);
        cert.sign(caKey, forge.md.sha256.create());
        setCertOut(forge.pki.certificateToPem(cert));
        setKeyOut(forge.pki.privateKeyToPem(kp.privateKey));

      } else if (certType === 'ca-signed') {
        if (!caPem.trim() || !caKeyPem.trim()) { setError('CA certificate and key are required.'); setLoading(false); return; }
        if (!csrPem.trim()) { setError('CSR is required.'); setLoading(false); return; }
        const caCert = forge.pki.certificateFromPem(caPem);
        const caKey = forge.pki.privateKeyFromPem(caKeyPem);
        const csr = forge.pki.certificationRequestFromPem(csrPem);
        if (!csr.verify()) throw new Error('CSR signature is invalid');
        const cert = forge.pki.createCertificate();
        cert.publicKey = csr.publicKey as forge.pki.PublicKey;
        cert.serialNumber = '03' + forge.util.bytesToHex(forge.random.getBytesSync(8));
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now() + days * 86400000);
        cert.setSubject(csr.subject.attributes);
        cert.setIssuer(caCert.subject.attributes);
        const exts: any[] = [
          { name: 'basicConstraints', cA: false },
          { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
          { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
          { name: 'subjectKeyIdentifier' },
          { name: 'authorityKeyIdentifier', keyIdentifier: true },
        ];
        const sanExt = sanExtension();
        if (sanExt) exts.push(sanExt);
        cert.setExtensions(exts);
        cert.sign(caKey, forge.md.sha256.create());
        setCertOut(forge.pki.certificateToPem(cert));
        setKeyOut(''); // CA-signed: no new key generated (CSR already has the key)
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const needsSubject = certType !== 'ca-signed';
  const needsCa = certType === 'ca-signed' || certType === 'intermediate-ca';
  const needsCsr = certType === 'ca-signed';

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Certificate Type</label>
        <div className="grid grid-cols-2 gap-2">
          {CERT_TYPES.map(({ id, label, desc }) => (
            <button key={id} className="text-left p-2.5 rounded-lg border transition-colors"
              style={{
                borderColor: certType === id ? 'var(--accent)' : 'var(--border)',
                background: certType === id ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
              }}
              onClick={() => setCertType(id)}>
              <div className="text-xs font-semibold" style={{ color: certType === id ? 'var(--accent)' : 'var(--text-primary)' }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {needsSubject && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Common Name (CN) *</label>
            <input className="input-base" value={cn} onChange={(e) => setCn(e.target.value)} placeholder={certType === 'root-ca' ? 'My Root CA' : 'example.com'} />
          </div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Organization (O)</label>
            <input className="input-base" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="My Company" /></div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Org Unit (OU)</label>
            <input className="input-base" value={ou} onChange={(e) => setOu(e.target.value)} placeholder="Engineering" /></div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Country (2-letter)</label>
            <input className="input-base" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} /></div>
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>State</label>
            <input className="input-base" value={state} onChange={(e) => setState(e.target.value)} /></div>
          {!['root-ca', 'intermediate-ca'].includes(certType) && (
            <div className="col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>SANs (comma-separated DNS/IP)</label>
              <input className="input-base font-mono text-xs" value={san} onChange={(e) => setSan(e.target.value)} placeholder="www.example.com, api.example.com" />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!needsCsr && (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key Size</label>
            <select className="input-base text-xs" value={keySize} onChange={(e) => setKeySize(e.target.value as '2048' | '4096')}>
              <option value="2048">2048 bits</option><option value="4096">4096 bits</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Validity (days)</label>
          <input className="input-base" type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} />
        </div>
      </div>

      {needsCsr && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>CSR (PEM)</label>
          <textarea className="input-base font-mono text-xs resize-none" rows={5}
            placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;...&#10;-----END CERTIFICATE REQUEST-----"
            value={csrPem} onChange={(e) => setCsrPem(e.target.value)} />
        </div>
      )}

      {needsCa && (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {certType === 'intermediate-ca' ? 'Root CA Certificate (PEM)' : 'CA Certificate (PEM)'}
            </label>
            <textarea className="input-base font-mono text-xs resize-none" rows={5}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              value={caPem} onChange={(e) => setCaPem(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {certType === 'intermediate-ca' ? 'Root CA Private Key (PEM)' : 'CA Private Key (PEM)'}
            </label>
            <textarea className="input-base font-mono text-xs resize-none" rows={5}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              value={caKeyPem} onChange={(e) => setCaKeyPem(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button className="btn btn-accent btn-sm flex items-center gap-2" onClick={generate} disabled={loading}>
        {loading && <Loader2 size={12} className="animate-spin" />}{loading ? 'Generating…' : 'Generate Certificate'}
      </button>

      <div className="space-y-3">
        <PemOutput label="Certificate" pem={certOut} filename="certificate.crt" />
        {keyOut && <PemOutput label="Private Key (keep secret!)" pem={keyOut} filename="private.key" />}
        <CliBlock commands={(() => {
          const cnVal = cn.trim() || (certType === 'root-ca' ? 'My Root CA' : certType === 'intermediate-ca' ? 'Intermediate CA' : 'example.com');
          const subj: string[] = [`/CN=${cnVal}`];
          if (org.trim()) subj.push(`O=${org.trim()}`);
          if (ou.trim()) subj.push(`OU=${ou.trim()}`);
          if (country.trim()) subj.push(`C=${country.trim()}`);
          if (state.trim()) subj.push(`ST=${state.trim()}`);
          const subjStr = subj.join('/');
          const sanList = san.split(',').map((s) => s.trim()).filter(Boolean);
          const sanStr = sanList.map((s) => (/^\d+\.\d+\.\d+\.\d+$/.test(s) ? `IP:${s}` : `DNS:${s}`)).join(',');
          const addSan = sanStr ? `\n  -addext "subjectAltName=${sanStr}" \\` : '';
          const d = validDays || '365';
          if (certType === 'self-signed') {
            return `openssl req -x509 \\\n  -newkey rsa:${keySize} \\\n  -keyout private.key \\\n  -out certificate.crt \\\n  -days ${d} \\\n  -nodes \\${addSan}\n  -subj "${subjStr}"\n\n# Verify:\nopenssl x509 -in certificate.crt -noout -text`;
          }
          if (certType === 'root-ca') {
            return `openssl req -x509 \\\n  -newkey rsa:${keySize} \\\n  -keyout ca.key \\\n  -out ca.crt \\\n  -days ${d} \\\n  -nodes \\\n  -subj "${subjStr}" \\\n  -addext "basicConstraints=critical,CA:TRUE" \\\n  -addext "keyUsage=critical,keyCertSign,cRLSign"\n\n# Verify:\nopenssl x509 -in ca.crt -noout -text`;
          }
          if (certType === 'intermediate-ca') {
            return `# Step 1: Generate intermediate key and CSR\nopenssl req -newkey rsa:${keySize} \\\n  -keyout intermediate.key \\\n  -out intermediate.csr \\\n  -nodes \\\n  -subj "${subjStr}"\n\n# Step 2: Sign with Root CA\nopenssl x509 -req \\\n  -in intermediate.csr \\\n  -CA root-ca.crt \\\n  -CAkey root-ca.key \\\n  -CAcreateserial \\\n  -out intermediate.crt \\\n  -days ${d} \\\n  -sha256 \\\n  -extfile <(printf "basicConstraints=critical,CA:TRUE,pathlen:0\\nkeyUsage=critical,keyCertSign,cRLSign")`;
          }
          if (certType === 'ca-signed') {
            return `openssl x509 -req \\\n  -in request.csr \\\n  -CA ca.crt \\\n  -CAkey ca.key \\\n  -CAcreateserial \\\n  -out certificate.crt \\\n  -days ${d} \\\n  -sha256\n\n# Verify:\nopenssl x509 -in certificate.crt -noout -text`;
          }
          return '';
        })()} />
      </div>
    </div>
  );
}

// ─── Tab: To PFX / P12 ───────────────────────────────────────────────────────

function ToPfxTab() {
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [chainPem, setChainPem] = useState('');
  const [password, setPassword] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [pfxBytes, setPfxBytes] = useState<Uint8Array | null>(null);

  const build = () => {
    setError(''); setReady(false); setPfxBytes(null);
    try {
      if (!certPem.trim()) { setError('Certificate is required.'); return; }
      if (!keyPem.trim()) { setError('Private key is required.'); return; }
      const cert = forge.pki.certificateFromPem(certPem);
      const key = forge.pki.privateKeyFromPem(keyPem);
      const chain: forge.pki.Certificate[] = [];
      if (chainPem.trim()) {
        const pems = splitPemCerts(chainPem);
        for (const p of pems) chain.push(forge.pki.certificateFromPem(p));
      }
      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
        key, [cert, ...chain], password,
        { algorithm: '3des', friendlyName: friendlyName.trim() || undefined }
      );
      const p12Der = forge.asn1.toDer(p12Asn1).bytes();
      const bytes = Uint8Array.from(p12Der, (c) => c.charCodeAt(0));
      setPfxBytes(bytes);
      setReady(true);
    } catch (e) { setError(String(e)); }
  };

  const download = () => {
    if (!pfxBytes) return;
    binaryDownload(pfxBytes, `${friendlyName.trim() || 'certificate'}.pfx`, 'application/x-pkcs12');
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Bundle a certificate, private key, and optional chain into a PKCS#12 (.pfx / .p12) file. Used by IIS, Windows, Java keystores, and many other systems.
      </p>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Certificate (PEM) *</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={5}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          value={certPem} onChange={(e) => setCertPem(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Private Key (PEM) *</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={5}
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
          value={keyPem} onChange={(e) => setKeyPem(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Certificate Chain — intermediates + root (PEM, optional)</label>
        <textarea className="input-base font-mono text-xs resize-none" rows={5}
          placeholder={"-----BEGIN CERTIFICATE-----\n(intermediate)\n-----END CERTIFICATE-----\n\n-----BEGIN CERTIFICATE-----\n(root CA)\n-----END CERTIFICATE-----"}
          value={chainPem} onChange={(e) => setChainPem(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Friendly Name (alias)</label>
          <input className="input-base" value={friendlyName} onChange={(e) => setFriendlyName(e.target.value)} placeholder="my-cert" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Password (leave blank for no password)</label>
          <input className="input-base" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="optional" />
        </div>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="flex gap-2 items-center flex-wrap">
        <button className="btn btn-accent btn-sm" onClick={build}>Build PFX</button>
        {ready && (
          <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={download}>
            <Download size={12} />Download .pfx
          </button>
        )}
        {ready && <span className="text-xs" style={{ color: 'var(--success)' }}>✓ PFX ready — {pfxBytes?.length} bytes</span>}
      </div>
      <CliBlock commands={(() => {
        const outName = (friendlyName.trim() || 'certificate') + '.pfx';
        const hasChain = chainPem.trim() !== '';
        const chainPart = hasChain ? `\n  -certfile chain.pem \\` : '';
        const namePart = friendlyName.trim() ? `\n  -name "${friendlyName.trim()}" \\` : '';
        const passPart = password ? `\n  -passout pass:yourpassword` : `\n  -passout pass:`;
        return `# Bundle cert + key into PFX\nopenssl pkcs12 -export \\\n  -in certificate.crt \\\n  -inkey private.key \\${chainPart}\n  -out ${outName} \\${namePart}${passPart}\n\n# Verify PFX contents:\nopenssl pkcs12 -in ${outName} -noout -info`;
      })()} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'decode', label: 'Decode' },
  { id: 'cert-key', label: 'Cert ↔ Key' },
  { id: 'cert-csr', label: 'Cert ↔ CSR' },
  { id: 'chain', label: 'Chain Verify' },
  { id: 'gen-csr', label: 'Generate CSR' },
  { id: 'gen-cert', label: 'Generate Cert' },
  { id: 'to-pfx', label: 'To PFX / P12' },
];

export default function CertificateTool() {
  const [tab, setTab] = useState('decode');

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Certificate Tools</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Decode, verify, generate, and export X.509 certificates, keys, CSRs, and PFX bundles</p>
        </div>
      </div>
      <div className="flex border-b gap-1 px-4 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.id} className="px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
            style={{ borderBottomColor: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)' }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {tab === 'decode' && <DecodeTab />}
        {tab === 'cert-key' && <CertKeyTab />}
        {tab === 'cert-csr' && <CertCsrTab />}
        {tab === 'chain' && <ChainVerifyTab />}
        {tab === 'gen-csr' && <GenCsrTab />}
        {tab === 'gen-cert' && <GenCertTab />}
        {tab === 'to-pfx' && <ToPfxTab />}
      </div>
    </div>
  );
}
