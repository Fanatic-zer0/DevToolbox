import { useState } from 'react';
import * as forge from 'node-forge';
import { CheckCircle, XCircle, Copy, Download, Loader2, Terminal } from 'lucide-react';
import { isNativeCrypto, nativeCert, type NativeSubject, type NativeKeySpec } from './nativeCrypto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function attrMap(attrs: forge.pki.CertificateField[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const a of attrs) m[String(a.shortName ?? a.name)] = String(a.value);
  return m;
}

function certFingerprint(cert: forge.pki.Certificate, algo: 'md5' | 'sha1' | 'sha256'): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes();
  const md = algo === 'md5' ? forge.md.md5.create() : algo === 'sha1' ? forge.md.sha1.create() : forge.md.sha256.create();
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

// ─── Universal (non-RSA) cert parsing via raw ASN.1 ──────────────────────────

const DN_OID_MAP: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.4': 'SN', '2.5.4.5': 'serialNumber',
  '2.5.4.6': 'C',  '2.5.4.7': 'L',  '2.5.4.8': 'ST', '2.5.4.9': 'street',
  '2.5.4.10': 'O', '2.5.4.11': 'OU', '1.2.840.113549.1.9.1': 'E',
};
const EC_SPKI_OID = '1.2.840.10045.2.1';
const EC_CURVE_BITS: Record<string, number> = {
  '1.2.840.10045.3.1.1': 192, // prime192v1 / secp192r1
  '1.3.132.0.33': 224,        // secp224r1
  '1.2.840.10045.3.1.7': 256, // prime256v1 / secp256r1 (P-256)
  '1.3.132.0.34': 384,        // secp384r1 (P-384)
  '1.3.132.0.35': 521,        // secp521r1 (P-521)
  '1.3.132.0.10': 256,        // secp256k1
  '1.3.36.3.3.2.8.1.1.7': 256,  // brainpoolP256r1
  '1.3.36.3.3.2.8.1.1.11': 384, // brainpoolP384r1
  '1.3.36.3.3.2.8.1.1.13': 512, // brainpoolP512r1
};
const ED_KEY_TYPES: Record<string, [string, number]> = {
  '1.3.101.112': ['Ed25519', 256], '1.3.101.113': ['Ed448', 448],
};
// EdDSA signature-algorithm OID → WebCrypto algorithm name (raw signature, no r/s)
const ED_SIG_ALG_NAME: Record<string, string> = {
  '1.3.101.112': 'Ed25519', '1.3.101.113': 'Ed448',
};

function isNonRsaError(e: unknown): boolean {
  const s = String(e);
  return s.includes('OID is not RSA') || s.includes('Cannot read public key');
}

/** Convert a forge ASN.1 OID node (raw DER bytes) to dotted-decimal string */
function asn1Oid(node: any): string {
  try { return forge.asn1.derToOid(node?.value); } catch { return ''; }
}

function parseDnAsn1(dn: any): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rdn of dn?.value ?? []) {
    for (const atv of rdn?.value ?? []) {
      const oid = asn1Oid(atv?.value?.[0]);
      const valNode = atv?.value?.[1]?.value;
      if (oid && valNode !== undefined) result[DN_OID_MAP[oid] ?? oid] = asn1ValueToString(valNode);
    }
  }
  return result;
}

const EXT_OID_MAP: Record<string, string> = {
  '2.5.29.17': 'Subject Alternative Name',
  '2.5.29.15': 'Key Usage',
  '2.5.29.37': 'Extended Key Usage',
  '2.5.29.19': 'Basic Constraints',
  '2.5.29.14': 'Subject Key Identifier',
  '2.5.29.35': 'Authority Key Identifier',
  '2.5.29.31': 'CRL Distribution Points',
  '2.5.29.32': 'Certificate Policies',
  '1.3.6.1.5.5.7.1.1': 'Authority Information Access',
};

const SIG_ALG_OID_MAP: Record<string, string> = {
  '1.2.840.113549.1.1.5': 'SHA1withRSA',
  '1.2.840.113549.1.1.11': 'SHA256withRSA',
  '1.2.840.113549.1.1.12': 'SHA384withRSA',
  '1.2.840.113549.1.1.13': 'SHA512withRSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.3.2': 'SHA256withECDSA',
  '1.2.840.10045.4.3.3': 'SHA384withECDSA',
  '1.2.840.10045.4.3.4': 'SHA512withECDSA',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
};

/** Map a signature-algorithm OID to a friendly name, falling back to the OID itself */
function friendlySigAlg(oid: string): string {
  return SIG_ALG_OID_MAP[oid] ? `${SIG_ALG_OID_MAP[oid]} (${oid})` : oid;
}

const KEY_USAGE_BITS = ['Digital Signature', 'Non Repudiation', 'Key Encipherment', 'Data Encipherment', 'Key Agreement', 'Certificate Sign', 'CRL Sign', 'Encipher Only', 'Decipher Only'];
const EKU_OID_MAP: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'TLS Web Server Authentication',
  '1.3.6.1.5.5.7.3.2': 'TLS Web Client Authentication',
  '1.3.6.1.5.5.7.3.3': 'Code Signing',
  '1.3.6.1.5.5.7.3.4': 'Email Protection',
  '1.3.6.1.5.5.7.3.8': 'Time Stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP Signing',
};
const ACCESS_METHOD_MAP: Record<string, string> = {
  '1.3.6.1.5.5.7.48.1': 'OCSP',
  '1.3.6.1.5.5.7.48.2': 'CA Issuers',
};

function bytesToColonHex(bytes: string): string {
  return forge.util.bytesToHex(bytes).replace(/../g, (h) => h.toUpperCase() + ':').slice(0, -1);
}

/** Collect GeneralName entries (DNS / IP / URI / etc.) from an ASN.1 sequence */
function collectGeneralNames(seq: any): string[] {
  const out: string[] = [];
  for (const gn of seq?.value ?? []) {
    if (gn.type === 1) out.push(`email: ${asn1ValueToString(gn.value)}`);
    else if (gn.type === 2) out.push(`DNS: ${asn1ValueToString(gn.value)}`);
    else if (gn.type === 6) out.push(`URI: ${asn1ValueToString(gn.value)}`);
    else if (gn.type === 7 && (gn.value as string)?.length === 4) {
      const b = gn.value as string;
      out.push(`IP: ${b.charCodeAt(0)}.${b.charCodeAt(1)}.${b.charCodeAt(2)}.${b.charCodeAt(3)}`);
    }
  }
  return out;
}

/** Decode the human-readable value of a certificate extension from its inner DER bytes */
function decodeExtensionValue(oid: string, der: string, san: string[]): string {
  let inner: any;
  try { inner = forge.asn1.fromDer(der); } catch { return '(present)'; }
  switch (oid) {
    case '2.5.29.17': { // Subject Alternative Name
      const names = collectGeneralNames(inner);
      san.push(...names);
      return names.join(', ') || '(none)';
    }
    case '2.5.29.15': { // Key Usage (BIT STRING)
      const raw = asn1ValueToString(inner.value);
      // first byte is the number of unused bits; remaining bytes hold the flags MSB-first
      const flagBytes = raw.slice(1);
      const used: string[] = [];
      for (let i = 0; i < KEY_USAGE_BITS.length; i++) {
        const byte = flagBytes.charCodeAt(Math.floor(i / 8)) || 0;
        if (byte & (0x80 >> (i % 8))) used.push(KEY_USAGE_BITS[i]);
      }
      return used.join(', ') || '(none)';
    }
    case '2.5.29.37': // Extended Key Usage
      return (inner.value ?? []).map((n: any) => {
        const o = asn1Oid(n);
        return EKU_OID_MAP[o] ?? o;
      }).join(', ') || '(none)';
    case '2.5.29.19': { // Basic Constraints
      const isCa = (inner.value ?? []).some((n: any) => n.type === 0x01 && !!asn1ValueToString(n.value).charCodeAt(0));
      const pathNode = (inner.value ?? []).find((n: any) => n.type === 0x02);
      const pathLen = pathNode ? forge.util.bytesToHex(pathNode.value).replace(/^0+/, '') || '0' : undefined;
      return `CA: ${isCa ? 'TRUE' : 'FALSE'}${pathLen !== undefined ? `, Path Length: ${parseInt(pathLen, 16)}` : ''}`;
    }
    case '2.5.29.14': // Subject Key Identifier (OCTET STRING)
      return bytesToColonHex(asn1ValueToString(inner.value));
    case '2.5.29.35': { // Authority Key Identifier
      const parts: string[] = [];
      for (const n of inner.value ?? []) {
        if (n.tagClass !== 0x80) continue;
        if (n.type === 0 && typeof n.value === 'string') parts.push(`keyid: ${bytesToColonHex(n.value)}`);
        else if (n.type === 2 && typeof n.value === 'string') parts.push(`serial: ${forge.util.bytesToHex(n.value).toUpperCase()}`);
      }
      return parts.join(', ') || '(present)';
    }
    case '2.5.29.31': { // CRL Distribution Points
      const uris: string[] = [];
      const walk = (node: any) => {
        if (!node) return;
        if (node.type === 6 && node.tagClass === 0x80) uris.push(asn1ValueToString(node.value));
        if (Array.isArray(node.value)) node.value.forEach(walk);
      };
      walk(inner);
      return uris.join(', ') || '(present)';
    }
    case '1.3.6.1.5.5.7.1.1': { // Authority Information Access
      const out: string[] = [];
      for (const acc of inner.value ?? []) {
        const method = asn1Oid(acc?.value?.[0]);
        const loc = acc?.value?.[1];
        const name = ACCESS_METHOD_MAP[method] ?? method;
        out.push(`${name}: ${asn1ValueToString(loc?.value)}`);
      }
      return out.join(', ') || '(present)';
    }
    case '2.5.29.32': // Certificate Policies
      return (inner.value ?? []).map((p: any) => asn1Oid(p?.value?.[0])).filter(Boolean).join(', ') || '(present)';
    default:
      return '(present)';
  }
}

/** Coerce an ASN.1 primitive value (string | ByteStringBuffer) to a plain ASCII string */
function asn1ValueToString(v: any): string {
  if (typeof v === 'string') return v;
  if (v && typeof v.bytes === 'function') { try { return v.bytes(); } catch { /* noop */ } }
  if (v && typeof v.data === 'string') return v.data;
  if (v && typeof v.toString === 'function') return v.toString();
  return String(v ?? '');
}

/**
 * Self-contained ASN.1 time parser. Handles UTCTime (0x17) and GeneralizedTime (0x18).
 * Supports trailing 'Z', '+HHMM'/'-HHMM' offsets and fractional seconds.
 * Returns null when the value cannot be parsed into a valid Date.
 */
function parseAsn1Time(t: any): Date | null {
  const raw = asn1ValueToString(t?.value).trim();
  if (!raw) return null;

  // Separate timezone suffix from the core digits
  const tzMatch = raw.match(/(Z|[+-]\d{2}\d{2})$/);
  const tz = tzMatch ? tzMatch[1] : '';
  const core = (tzMatch ? raw.slice(0, -tz.length) : raw).replace(/\.\d+$/, ''); // strip fractional seconds
  const digits = core.replace(/[^0-9]/g, '');

  let year: number, mi: number;
  if (t?.type === 0x17) {
    // UTCTime: YYMMDDHHMM[SS]
    if (digits.length < 10) return null;
    const yy = parseInt(digits.slice(0, 2), 10);
    year = yy >= 50 ? 1900 + yy : 2000 + yy;
    mi = 2;
  } else {
    // GeneralizedTime: YYYYMMDDHHMM[SS]
    if (digits.length < 12) return null;
    year = parseInt(digits.slice(0, 4), 10);
    mi = 4;
  }

  const month = parseInt(digits.slice(mi, mi + 2), 10) - 1;
  const day   = parseInt(digits.slice(mi + 2, mi + 4), 10);
  const hour  = parseInt(digits.slice(mi + 4, mi + 6), 10);
  const min   = parseInt(digits.slice(mi + 6, mi + 8), 10);
  const sec   = parseInt(digits.slice(mi + 8, mi + 10) || '0', 10);

  if ([year, month, day, hour, min, sec].some(Number.isNaN)) return null;

  let ms = Date.UTC(year, month, day, hour, min, sec);
  // Apply numeric timezone offset (Z = UTC = no adjustment)
  if (tz && tz !== 'Z') {
    const sign = tz[0] === '-' ? 1 : -1; // convert local→UTC
    const offMin = parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10);
    ms += sign * offMin * 60000;
  }
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Safe ISO string — returns empty string instead of throwing on invalid dates */
function safeIso(d: Date | null): string {
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : '';
}

interface RawCertInfo {
  subject: Record<string, string>; issuer: Record<string, string>;
  serial: string; notBefore: Date | null; notAfter: Date | null; san: string[];
  md5: string; sha1: string; sha256: string; keyType: string; keyBits: number;
  sigAlgOid: string; version: number;
  extensions: { name: string; critical: boolean; value: string }[];
}

function parseRawCertFromPem(pem: string): RawCertInfo {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const derBytes = forge.util.decode64(b64);
  const asn1 = forge.asn1.fromDer(derBytes) as any;
  const tbs = asn1.value[0];
  const kids: any[] = tbs.value ?? [];

  const UNIVERSAL = 0x00, CONTEXT = 0x80;
  const isSeq  = (n: any) => n?.tagClass === UNIVERSAL && n?.type === 0x10;
  const isTime = (n: any) => n?.tagClass === UNIVERSAL && (n?.type === 0x17 || n?.type === 0x18);

  // Anchor on the Validity node: a SEQUENCE containing exactly two Time nodes.
  const vIdx = kids.findIndex((n) => isSeq(n) && Array.isArray(n.value) &&
    n.value.length === 2 && isTime(n.value[0]) && isTime(n.value[1]));
  const validityAsn1 = vIdx >= 0 ? kids[vIdx] : null;

  // Fields are positioned relative to validity (RFC 5280 TBSCertificate ordering).
  const issuerAsn1  = vIdx > 0 ? kids[vIdx - 1] : null;
  const subjectAsn1 = vIdx >= 0 ? kids[vIdx + 1] : null;
  const spkiAsn1    = vIdx >= 0 ? kids[vIdx + 2] : null;

  // Version: leading context-specific [0]
  let version = 1;
  const verNode = kids.find((n) => n?.tagClass === CONTEXT && n?.type === 0);
  if (verNode) {
    const vRaw = verNode.value?.[0]?.value;
    version = (typeof vRaw === 'string' ? vRaw.charCodeAt(0) : Number(vRaw ?? 0)) + 1;
  }

  // Serial: first universal INTEGER in the TBS
  const serialNode = kids.find((n) => n?.tagClass === UNIVERSAL && n?.type === 0x02);
  const serial = forge.util.bytesToHex(serialNode?.value ?? '').replace(/^0+/, '') || '0';

  const spkiAlgOid   = asn1Oid(spkiAsn1?.value?.[0]?.value?.[0]);
  const spkiParamOid = asn1Oid(spkiAsn1?.value?.[0]?.value?.[1]);
  let keyType = 'Unknown', keyBits = 0;
  if (spkiAlgOid === EC_SPKI_OID)    { keyType = 'EC (ECDSA)'; keyBits = EC_CURVE_BITS[spkiParamOid] ?? 0; }
  else if (ED_KEY_TYPES[spkiAlgOid]) { [keyType, keyBits] = ED_KEY_TYPES[spkiAlgOid]; }
  else if (spkiAlgOid === '1.2.840.113549.1.1.1') { keyType = 'RSA'; }

  const sigAlgOid = asn1Oid(asn1.value[1]?.value?.[0]);

  const sha1   = forge.md.sha1.create().update(derBytes).digest().toHex().replace(/../g, h => h.toUpperCase() + ':').slice(0, -1);
  const sha256 = forge.md.sha256.create().update(derBytes).digest().toHex().replace(/../g, h => h.toUpperCase() + ':').slice(0, -1);
  const md5    = forge.md.md5.create().update(derBytes).digest().toHex().replace(/../g, h => h.toUpperCase() + ':').slice(0, -1);

  const san: string[] = [];
  const extensions: { name: string; critical: boolean; value: string }[] = [];
  // Extensions live in the context-specific [3] node
  const extContainer = kids.find((n) => n?.tagClass === CONTEXT && n?.type === 3);
  for (const ext of (extContainer?.value?.[0]?.value ?? [])) {
    const extOid = asn1Oid(ext?.value?.[0]);
    if (!extOid) continue;
    const critNode = ext?.value?.[1];
    const critical = critNode?.tagClass === UNIVERSAL && critNode?.type === 0x01 &&
      !!asn1ValueToString(critNode.value).charCodeAt(0);
    // The extension's encoded value is the final OCTET STRING in the sequence
    const octet = ext.value[ext.value.length - 1];
    const value = decodeExtensionValue(extOid, asn1ValueToString(octet?.value), san);
    extensions.push({ name: EXT_OID_MAP[extOid] ?? extOid, critical, value });
  }

  return {
    subject: parseDnAsn1(subjectAsn1), issuer: parseDnAsn1(issuerAsn1),
    serial,
    notBefore: validityAsn1 ? parseAsn1Time(validityAsn1.value[0]) : null,
    notAfter: validityAsn1 ? parseAsn1Time(validityAsn1.value[1]) : null,
    san, md5, sha1, sha256, keyType, keyBits, sigAlgOid, version, extensions,
  };
}

/** Extract raw SubjectPublicKeyInfo DER bytes from any PEM cert */
function extractSpkiDer(certPem: string): Uint8Array | null {
  try {
    const b64 = certPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    const asn1 = forge.asn1.fromDer(forge.util.decode64(b64)) as any;
    // SPKI is a SEQUENCE (type 16) of [ AlgorithmIdentifier SEQUENCE (16), subjectPublicKey BIT STRING (3) ]
    for (const child of (asn1.value[0]?.value ?? [])) {
      if (child.type === 0x10 && Array.isArray(child.value) && child.value.length === 2 &&
          child.value[0]?.type === 0x10 && child.value[1]?.type === 0x03) {
        const der = forge.asn1.toDer(child).bytes();
        return Uint8Array.from(der, (c: string) => c.charCodeAt(0));
      }
    }
  } catch { /* ignore */ }
  return null;
}

/** Find the subjectPublicKey BIT STRING bytes inside a SubjectPublicKeyInfo SEQUENCE */
function findSpkiBitString(node: any): string {
  for (const child of (node?.value ?? [])) {
    if (child?.type === 0x10 && Array.isArray(child.value) && child.value.length === 2 &&
        child.value[0]?.type === 0x10 && child.value[1]?.type === 0x03) {
      return typeof child.value[1].value === 'string' ? child.value[1].value : '';
    }
  }
  return '';
}

/** Public key BIT STRING from a PEM cert or CSR (walks the tbs SEQUENCE) */
function publicKeyBitsFromCertOrCsr(pem: string): string {
  try {
    const der = forge.util.decode64(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
    const asn1 = forge.asn1.fromDer(der) as any;
    return findSpkiBitString(asn1.value?.[0]);
  } catch { return ''; }
}

/** Public key BIT STRING embedded in an EC private key PEM (SEC1 or PKCS#8) */
function publicKeyBitsFromPrivateKey(keyPem: string): string {
  try {
    const der = forge.util.decode64(keyPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
    let seq = forge.asn1.fromDer(der) as any;
    // PKCS#8 wraps the SEC1 ECPrivateKey inside an OCTET STRING (type 4)
    const octet = (seq.value ?? []).find((n: any) => n?.tagClass === 0 && n?.type === 0x04 && typeof n.value === 'string');
    if (octet) {
      try { seq = forge.asn1.fromDer(octet.value) as any; } catch { /* not nested, keep seq */ }
    }
    // SEC1 ECPrivateKey: publicKey is an explicit [1] context tag holding a BIT STRING
    const pub = (seq.value ?? []).find((n: any) => n?.tagClass === 0x80 && n?.type === 1);
    if (pub) {
      const bs = Array.isArray(pub.value) ? pub.value[0] : pub;
      return typeof bs?.value === 'string' ? bs.value : '';
    }
  } catch { /* ignore */ }
  return '';
}

const ECDSA_HASH_BY_SIG_OID: Record<string, string> = {
  '1.2.840.10045.4.3.2': 'SHA-256',
  '1.2.840.10045.4.3.3': 'SHA-384',
  '1.2.840.10045.4.3.4': 'SHA-512',
  '1.2.840.10045.4.1': 'SHA-1',
};
const ECDSA_CURVE_BY_PARAM: Record<string, [string, number]> = {
  '1.2.840.10045.3.1.7': ['P-256', 32],
  '1.3.132.0.34': ['P-384', 48],
  '1.3.132.0.35': ['P-521', 66],
};

/** Left-trim leading zero bytes then left-pad to a fixed length (for ECDSA r/s components) */
function ecCoordToFixed(bytesStr: string, len: number): Uint8Array {
  let s = bytesStr;
  while (s.length > len && s.charCodeAt(0) === 0) s = s.slice(1);
  while (s.length < len) s = '\x00' + s;
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Curve OID from a parsed cert's SubjectPublicKeyInfo (EC param) */
function ecCurveOidFromCert(asn1: any): string {
  for (const child of (asn1?.value?.[0]?.value ?? [])) {
    if (child?.type === 0x10 && Array.isArray(child.value) && child.value.length === 2 &&
        child.value[0]?.type === 0x10 && child.value[1]?.type === 0x03) {
      return asn1Oid(child.value[0].value?.[1]);
    }
  }
  return '';
}

/** Verify a non-RSA (ECDSA or EdDSA) certificate signature against its issuer's public key via WebCrypto */
async function verifyEcCertSignature(certPem: string, issuerPem: string): Promise<boolean | null> {
  try {
    const parse = (p: string) => forge.asn1.fromDer(
      forge.util.decode64(p.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
      { decodeBitStrings: false } as any,
    ) as any;
    const certAsn1 = parse(certPem);
    const issuerAsn1 = parse(issuerPem);

    const sigAlgOid = asn1Oid(certAsn1.value[1]?.value?.[0]);

    // Signed data is the DER encoding of TBSCertificate
    const tbsDer = forge.asn1.toDer(certAsn1.value[0]).getBytes();
    const tbsBytes = Uint8Array.from(tbsDer, (c) => c.charCodeAt(0));

    // Ed25519 / Ed448: the signature is a raw EdDSA value (no ECDSA-Sig-Value SEQUENCE)
    const edAlg = ED_SIG_ALG_NAME[sigAlgOid];
    if (edAlg) {
      const edBitStr = certAsn1.value[2];
      const edRaw: string = edBitStr.bitStringContents ?? edBitStr.value;
      if (typeof edRaw !== 'string' || edRaw.length < 2) return null;
      const edSig = Uint8Array.from(edRaw.slice(1), (c) => c.charCodeAt(0));
      const edSpki = extractSpkiDer(issuerPem);
      if (!edSpki) return null;
      const edKey = await crypto.subtle.importKey('spki', edSpki.buffer as ArrayBuffer, { name: edAlg }, false, ['verify']);
      return await crypto.subtle.verify({ name: edAlg }, edKey, edSig.buffer as ArrayBuffer, tbsBytes.buffer as ArrayBuffer);
    }

    const hash = ECDSA_HASH_BY_SIG_OID[sigAlgOid];
    if (!hash) return null;

    // Signature BIT STRING content (skip the leading unused-bits byte) → ECDSA-Sig-Value SEQUENCE { r, s }
    const bitStr = certAsn1.value[2];
    const raw: string = bitStr.bitStringContents ?? bitStr.value;
    if (typeof raw !== 'string' || raw.length < 2) return null;
    const sigAsn1 = forge.asn1.fromDer(raw.slice(1)) as any;

    const curveOid = ecCurveOidFromCert(issuerAsn1);
    // WebCrypto only supports the NIST P-curves; secp256k1 / brainpool cannot be verified here
    const curveInfo = ECDSA_CURVE_BY_PARAM[curveOid];
    if (!curveInfo) return null;
    const [namedCurve, coordLen] = curveInfo;
    const r = ecCoordToFixed(sigAsn1.value[0].value, coordLen);
    const s = ecCoordToFixed(sigAsn1.value[1].value, coordLen);
    const rawSig = new Uint8Array(coordLen * 2);
    rawSig.set(r, 0); rawSig.set(s, coordLen);

    const spki = extractSpkiDer(issuerPem);
    if (!spki) return null;
    const pubKey = await crypto.subtle.importKey('spki', spki.buffer as ArrayBuffer, { name: 'ECDSA', namedCurve }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash }, pubKey, rawSig.buffer as ArrayBuffer, tbsBytes.buffer as ArrayBuffer);
  } catch {
    return null;
  }
}

/** SHA-256 of the SubjectPublicKeyInfo (HPKP-style pin), as colon-hex and base64 */
function spkiSha256FromPem(certPem: string): { hex: string; b64: string } {
  const spki = extractSpkiDer(certPem);
  if (!spki) return { hex: '', b64: '' };
  let bin = '';
  for (let i = 0; i < spki.length; i++) bin += String.fromCharCode(spki[i]);
  const digest = forge.md.sha256.create().update(bin).digest();
  return {
    hex: digest.toHex().replace(/../g, (h) => h.toUpperCase() + ':').slice(0, -1),
    b64: forge.util.encode64(digest.bytes()),
  };
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

// ─── Key algorithm selection (desktop app supports EC / Ed; web is RSA-only) ──

type KeyAlgo = 'rsa' | 'ec' | 'ed25519' | 'ed448';

interface KeyAlgoState {
  algo: KeyAlgo;
  rsaBits: '2048' | '3072' | '4096';
  curve: string;
}

const EC_CURVE_OPTIONS = ['P-256', 'P-384', 'P-521', 'secp256k1', 'brainpoolP256r1', 'brainpoolP384r1', 'brainpoolP512r1'];

/** Translate the UI key state into the native KeySpec shape. */
function toNativeKeySpec(k: KeyAlgoState): NativeKeySpec {
  if (k.algo === 'rsa') return { kind: 'rsa', rsa_bits: parseInt(k.rsaBits) };
  if (k.algo === 'ec') return { kind: 'ec', curve: k.curve };
  return { kind: k.algo };
}

/** Human-readable summary of the selected key algorithm (for CLI hints). */
function keyAlgoLabel(k: KeyAlgoState): string {
  if (k.algo === 'rsa') return `RSA ${k.rsaBits}`;
  if (k.algo === 'ec') return `EC ${k.curve}`;
  return k.algo === 'ed25519' ? 'Ed25519' : 'Ed448';
}

function KeyAlgoSelector({ value, onChange, native }: { value: KeyAlgoState; onChange: (k: KeyAlgoState) => void; native: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key Algorithm</label>
        <select className="input-base text-xs" value={value.algo}
          onChange={(e) => onChange({ ...value, algo: e.target.value as KeyAlgo })}>
          <option value="rsa">RSA</option>
          {native && <option value="ec">EC (ECDSA)</option>}
          {native && <option value="ed25519">Ed25519</option>}
          {native && <option value="ed448">Ed448</option>}
        </select>
        {!native && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>EC / EdDSA generation is available in the desktop app.</p>}
      </div>
      {value.algo === 'rsa' && (
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key Size</label>
          <select className="input-base text-xs" value={value.rsaBits}
            onChange={(e) => onChange({ ...value, rsaBits: e.target.value as KeyAlgoState['rsaBits'] })}>
            <option value="2048">2048 bits</option>
            <option value="3072">3072 bits</option>
            <option value="4096">4096 bits</option>
          </select>
        </div>
      )}
      {value.algo === 'ec' && (
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Curve</label>
          <select className="input-base text-xs" value={value.curve}
            onChange={(e) => onChange({ ...value, curve: e.target.value })}>
            {EC_CURVE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Decode ─────────────────────────────────────────────────────────────

/** Build a readable extension list from a forge-parsed certificate */
function extractForgeExtensions(cert: forge.pki.Certificate, san: string[]): { name: string; critical: boolean; value: string }[] {
  const KU = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign', 'encipherOnly', 'decipherOnly'];
  const KU_LABEL: Record<string, string> = {
    digitalSignature: 'Digital Signature', nonRepudiation: 'Non Repudiation', keyEncipherment: 'Key Encipherment',
    dataEncipherment: 'Data Encipherment', keyAgreement: 'Key Agreement', keyCertSign: 'Certificate Sign',
    cRLSign: 'CRL Sign', encipherOnly: 'Encipher Only', decipherOnly: 'Decipher Only',
  };
  const EKU = ['serverAuth', 'clientAuth', 'codeSigning', 'emailProtection', 'timeStamping', 'ocspSigning'];
  const EKU_LABEL: Record<string, string> = {
    serverAuth: 'TLS Web Server Authentication', clientAuth: 'TLS Web Client Authentication', codeSigning: 'Code Signing',
    emailProtection: 'Email Protection', timeStamping: 'Time Stamping', ocspSigning: 'OCSP Signing',
  };
  return (cert.extensions ?? []).map((ext: any) => {
    const name = EXT_OID_MAP[ext.id] ?? ext.name ?? ext.id;
    let value: string;
    if (ext.name === 'subjectAltName') value = san.join(', ') || '(none)';
    else if (ext.name === 'keyUsage') value = KU.filter((k) => ext[k]).map((k) => KU_LABEL[k]).join(', ') || '(none)';
    else if (ext.name === 'extKeyUsage') value = EKU.filter((k) => ext[k]).map((k) => EKU_LABEL[k]).join(', ') || '(none)';
    else if (ext.name === 'basicConstraints') value = `CA: ${ext.cA ? 'TRUE' : 'FALSE'}${ext.pathLenConstraint !== undefined ? `, Path Length: ${ext.pathLenConstraint}` : ''}`;
    else if (ext.name === 'subjectKeyIdentifier' && ext.subjectKeyIdentifier) value = bytesToColonHex(forge.util.hexToBytes(ext.subjectKeyIdentifier));
    else value = decodeExtensionValue(ext.id, typeof ext.value === 'string' ? ext.value : '', san);
    return { name, critical: !!ext.critical, value };
  });
}

function DecodeTab() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<{
    subject: Record<string, string>; issuer: Record<string, string>;
    serial: string; notBefore: string; notAfter: string; san: string[];
    fingerprints: { md5: string; sha1: string; sha256: string; spkiSha256Hex: string; spkiSha256B64: string };
    publicKey: { type: string; bits: number };
    signatureAlg: string; version: number;
    extensions: { name: string; critical: boolean; value: string }[];
  } | null>(null);

  const parse = () => {
    if (!input.trim()) return;
    try {
      try {
        // RSA path — forge handles everything natively
        const cert = forge.pki.certificateFromPem(input);
        const san: string[] = [];
        const ext = cert.getExtension('subjectAltName') as { altNames?: { type: number; value?: string; ip?: string }[] } | null;
        for (const n of ext?.altNames ?? []) {
          if (n.type === 2 && n.value) san.push(`DNS: ${n.value}`);
          else if (n.type === 7 && n.ip) san.push(`IP: ${n.ip}`);
        }
        const rsaPub = cert.publicKey as forge.pki.rsa.PublicKey;
        const spki = spkiSha256FromPem(input);
        setInfo({
          subject: attrMap(cert.subject.attributes), issuer: attrMap(cert.issuer.attributes),
          serial: cert.serialNumber, notBefore: cert.validity.notBefore.toISOString(),
          notAfter: cert.validity.notAfter.toISOString(), san,
          fingerprints: {
            md5: certFingerprint(cert, 'md5'), sha1: certFingerprint(cert, 'sha1'), sha256: certFingerprint(cert, 'sha256'),
            spkiSha256Hex: spki.hex, spkiSha256B64: spki.b64,
          },
          publicKey: { type: 'RSA', bits: rsaPub.n?.bitLength() ?? 0 },
          signatureAlg: cert.siginfo.algorithmOid, version: cert.version + 1,
          extensions: extractForgeExtensions(cert, san),
        });
      } catch (e) {
        if (!isNonRsaError(e)) throw e;
        // Non-RSA cert (EC, Ed25519, etc.) — parse from raw ASN.1
        const raw = parseRawCertFromPem(input);
        const spki = spkiSha256FromPem(input);
        setInfo({
          subject: raw.subject, issuer: raw.issuer,
          serial: raw.serial, notBefore: safeIso(raw.notBefore),
          notAfter: safeIso(raw.notAfter), san: raw.san,
          fingerprints: {
            md5: raw.md5, sha1: raw.sha1, sha256: raw.sha256,
            spkiSha256Hex: spki.hex, spkiSha256B64: spki.b64,
          },
          publicKey: { type: raw.keyType, bits: raw.keyBits },
          signatureAlg: raw.sigAlgOid, version: raw.version,
          extensions: raw.extensions,
        });
      }
      setError('');
    } catch (e) { setError(String(e)); setInfo(null); }
  };

  const now = new Date();
  const expired = info ? new Date(info.notAfter) < now : false;

  const expiryText = (() => {
    if (!info || !info.notAfter) return '(unparsed)';
    const exp = new Date(info.notAfter);
    if (Number.isNaN(exp.getTime())) return '(unparsed)';
    const days = Math.round((exp.getTime() - now.getTime()) / 86400000);
    const rel = expired ? `expired ${Math.abs(days)} day(s) ago` : `expires in ${days} day(s)`;
    return `${exp.toLocaleString()} (${rel})`;
  })();

  const dnToString = (dn: Record<string, string>) =>
    Object.entries(dn).map(([k, v]) => `${k}=${v}`).join(', ') || '(empty)';

  const detailedText = info
    ? [
        '── Subject ──',
        dnToString(info.subject),
        '',
        '── Issuer ──',
        dnToString(info.issuer),
        '',
        '── Properties ──',
        `Version:            v${info.version}`,
        `Serial Number:      ${info.serial}`,
        `Signature Algorithm:${friendlySigAlg(info.signatureAlg)}`,
        `Public Key:         ${info.publicKey.type}${info.publicKey.bits ? ` (${info.publicKey.bits} bits)` : ''}`,
        `Not Before:         ${info.notBefore ? new Date(info.notBefore).toUTCString() : '(unparsed)'}`,
        `Not After:          ${info.notAfter ? new Date(info.notAfter).toUTCString() : '(unparsed)'}${expired ? '  ⚠ EXPIRED' : ''}`,
        `Expiry:             ${expiryText}`,
        '',
        '── Certificate Extensions ──',
        ...(info.extensions.length
          ? info.extensions.map((e) => `${e.name}${e.critical ? ' (critical)' : ''}: ${e.value}`)
          : ['(none)']),
        ...(info.san.length ? ['', '── Subject Alternative Names ──', ...info.san] : []),
        '',
        '── Certificate Fingerprints ──',
        `MD5:              ${info.fingerprints.md5}`,
        `SHA-1:            ${info.fingerprints.sha1}`,
        `SHA-256:          ${info.fingerprints.sha256}`,
        `SPKI SHA256 Hex:  ${info.fingerprints.spkiSha256Hex}`,
        `SPKI SHA256 B64:  ${info.fingerprints.spkiSha256B64}`,
      ].join('\n')
    : '';

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
          <Section title="Subject">
            {Object.keys(info.subject).length
              ? Object.entries(info.subject).map(([k, v]) => <Field key={k} label={k} value={v} />)
              : <Field label="—" value="(no subject fields)" />}
          </Section>
          <Section title="Issuer">
            {Object.keys(info.issuer).length
              ? Object.entries(info.issuer).map(([k, v]) => <Field key={k} label={k} value={v} />)
              : <Field label="—" value="(no issuer fields)" />}
          </Section>
          <Section title="Properties">
            <Field label="Version" value={`v${info.version}`} />
            <Field label="Serial" value={info.serial} />
            <Field label="Signature Alg" value={friendlySigAlg(info.signatureAlg)} />
            <Field label="Public Key" value={`${info.publicKey.type}${info.publicKey.bits ? ` (${info.publicKey.bits} bits)` : ''}`} />
            <Field label="Not Before" value={info.notBefore ? new Date(info.notBefore).toLocaleString() : '(unparsed)'} />
            <Field label="Not After" value={`${info.notAfter ? new Date(info.notAfter).toLocaleString() : '(unparsed)'}${expired ? '  ⚠ EXPIRED' : ''}`} />
            <Field label="Expiry" value={expiryText} />
          </Section>
          <Section title="Certificate Extensions">
            {info.extensions.length
              ? info.extensions.map((e, i) => <Field key={i} label={`${e.name}${e.critical ? ' *' : ''}`} value={e.value} />)
              : <Field label="—" value="(none)" />}
            {info.san.map((s, i) => <Field key={`san-${i}`} label={i === 0 ? 'Subject Alt Name' : ''} value={s} />)}
          </Section>
          <Section title="Certificate Fingerprints">
            <Field label="MD5" value={info.fingerprints.md5} />
            <Field label="SHA-1" value={info.fingerprints.sha1} />
            <Field label="SHA-256" value={info.fingerprints.sha256} />
            <Field label="SPKI SHA256 Hex" value={info.fingerprints.spkiSha256Hex || '(unavailable)'} />
            <Field label="SPKI SHA256 Base64" value={info.fingerprints.spkiSha256B64 || '(unavailable)'} />
          </Section>
          <Section title="Certificate Detailed Information">
            <div className="py-2 flex justify-end"><CopyBtn text={detailedText} /></div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all pb-3" style={{ color: 'var(--text-primary)' }}>{detailedText}</pre>
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

  const check = async () => {
    setError(''); setResult(null);
    try {
      // Native (desktop) path: OpenSSL compares public keys for ANY algorithm.
      if (isNativeCrypto()) {
        const m = await nativeCert.matchKey(certPem, keyPem);
        // bit size is informational; derive it where the JS parsers can.
        let bits = 0;
        try { bits = (forge.pki.certificateFromPem(certPem).publicKey as forge.pki.rsa.PublicKey).n?.bitLength() ?? 0; }
        catch { try { bits = parseRawCertFromPem(certPem).keyBits; } catch { /* ignore */ } }
        setResult({ match: m.matched, certBits: bits, keyBits: bits, detail: m.detail });
        return;
      }

      let forgeCert: forge.pki.Certificate | null = null;
      let isEc = false;
      let ecBits = 0;
      try {
        forgeCert = forge.pki.certificateFromPem(certPem);
      } catch (e) {
        if (!isNonRsaError(e)) throw e;
        const raw = parseRawCertFromPem(certPem);
        isEc = true;
        ecBits = raw.keyBits;
      }

      if (isEc) {
        // Compare the public key embedded in the cert (SPKI) with the one embedded
        // in the private key. Works for both SEC1 (-----BEGIN EC PRIVATE KEY-----)
        // and PKCS#8 (-----BEGIN PRIVATE KEY-----) without curve guessing.
        const certBits = publicKeyBitsFromCertOrCsr(certPem);
        const keyBits = publicKeyBitsFromPrivateKey(keyPem);
        if (!certBits) throw new Error('Could not extract the public key from the certificate.');
        if (!keyBits) throw new Error('Could not extract a public key from the private key. Ensure it is an EC key in SEC1 (-----BEGIN EC PRIVATE KEY-----) or PKCS#8 (-----BEGIN PRIVATE KEY-----) format.');
        const match = certBits === keyBits;
        setResult({
          match, certBits: ecBits, keyBits: ecBits,
          detail: match ? 'EC public key in the certificate matches the private key.' : 'EC public keys do NOT match — this key did not generate this certificate.',
        });
      } else {
        const privKey = forge.pki.privateKeyFromPem(keyPem);
        const certMod = getRsaModulus(forgeCert!.publicKey);
        const keyMod = getRsaModulus(privKey as unknown as forge.pki.PublicKey);
        const match = certMod.length > 0 && certMod === keyMod;
        const certPub = forgeCert!.publicKey as forge.pki.rsa.PublicKey;
        const keyPriv = privKey as forge.pki.rsa.PrivateKey;
        setResult({
          match,
          certBits: certPub.n?.bitLength() ?? 0,
          keyBits: keyPriv.n?.bitLength() ?? 0,
          detail: match ? 'Public key modulus in certificate matches the private key.' : 'Moduli do NOT match — this key did not generate this certificate.',
        });
      }
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
    (async () => {
    try {
      // Native (desktop) path: OpenSSL compares public keys for ANY algorithm.
      if (isNativeCrypto()) {
        let nativeCertSub: Record<string, string>;
        try { nativeCertSub = attrMap(forge.pki.certificateFromPem(certPem).subject.attributes); }
        catch (e) { if (!isNonRsaError(e)) throw e; nativeCertSub = parseRawCertFromPem(certPem).subject; }
        const nativeCsr = forge.pki.certificationRequestFromPem(csrPem);
        const nativeCsrSub = attrMap(nativeCsr.subject.attributes);
        const m = await nativeCert.matchCsr(certPem, csrPem);
        const cStr = Object.entries(nativeCertSub).map(([k, v]) => `${k}=${v}`).join(', ');
        const rStr = Object.entries(nativeCsrSub).map(([k, v]) => `${k}=${v}`).join(', ');
        setResult({ modulusMatch: m.matched, subjectMatch: cStr === rStr, certSubject: cStr, csrSubject: rStr });
        return;
      }

      // Parse cert — fallback to raw ASN.1 for EC/non-RSA
      let certSub: Record<string, string>;
      let certSpkiBitStr = '';
      let isEc = false;
      let forgeCert: forge.pki.Certificate | null = null;
      try {
        forgeCert = forge.pki.certificateFromPem(certPem);
        certSub = attrMap(forgeCert.subject.attributes);
      } catch (e) {
        if (!isNonRsaError(e)) throw e;
        isEc = true;
        const raw = parseRawCertFromPem(certPem);
        certSub = raw.subject;
        certSpkiBitStr = publicKeyBitsFromCertOrCsr(certPem);
      }

      const csr = forge.pki.certificationRequestFromPem(csrPem);
      let modulusMatch: boolean;

      if (isEc) {
        // Compare raw EC public key bit strings from cert and CSR
        const csrSpkiBitStr = publicKeyBitsFromCertOrCsr(csrPem);
        modulusMatch = certSpkiBitStr.length > 0 && certSpkiBitStr === csrSpkiBitStr;
      } else {
        try { if (!csr.verify()) throw new Error('CSR signature is invalid'); } catch (e) { if (!isNonRsaError(e)) throw e; }
        const certMod = getRsaModulus(forgeCert!.publicKey);
        const csrMod = getRsaModulus(csr.publicKey as forge.pki.PublicKey);
        modulusMatch = certMod.length > 0 && certMod === csrMod;
      }

      const csrSub = attrMap(csr.subject.attributes);
      const certSubStr = Object.entries(certSub).map(([k, v]) => `${k}=${v}`).join(', ');
      const csrSubStr = Object.entries(csrSub).map(([k, v]) => `${k}=${v}`).join(', ');
      setResult({ modulusMatch, subjectMatch: certSubStr === csrSubStr, certSubject: certSubStr, csrSubject: csrSubStr });
    } catch (e) { setError(String(e)); }
    })();
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

  const verify = async () => {
    setError(''); setLinks([]); setOverallOk(null);
    try {
      const pems = splitPemCerts(chainPem);
      if (pems.length === 0) throw new Error('No certificates found. Paste one or more PEM certificates.');

      const now = new Date();

      // Native (desktop) path: OpenSSL verifies ANY curve incl. secp256k1 / brainpool / EdDSA.
      if (isNativeCrypto()) {
        const native = await nativeCert.verifyChain(chainPem);
        const result: ChainLink[] = native.map((l) => ({
          index: l.index, subject: l.subject, issuer: l.issuer,
          notAfter: l.not_after, selfSigned: l.self_signed,
          issuerChainOk: l.issuer_chain_ok, signatureOk: l.signature_ok,
        }));
        setLinks(result);
        setOverallOk(result.every((l) => l.issuerChainOk && l.signatureOk !== false && new Date(l.notAfter) >= now));
        return;
      }

      // Parse each cert — use raw ASN.1 fallback for non-RSA (EC, Ed25519)
      type FlexCert = { subject: Record<string, string>; issuer: Record<string, string>; notAfter: Date; forge: forge.pki.Certificate | null; pem: string };
      const flexCerts: FlexCert[] = pems.map((p) => {
        try {
          const cert = forge.pki.certificateFromPem(p);
          return { subject: attrMap(cert.subject.attributes), issuer: attrMap(cert.issuer.attributes), notAfter: cert.validity.notAfter, forge: cert, pem: p };
        } catch (e) {
          if (!isNonRsaError(e)) throw e;
          const raw = parseRawCertFromPem(p);
          return { subject: raw.subject, issuer: raw.issuer, notAfter: raw.notAfter ?? new Date(NaN), forge: null, pem: p };
        }
      });

      const toStr = (m: Record<string, string>) => Object.entries(m).map(([k, v]) => `${k}=${v}`).join(', ');
      const result: ChainLink[] = await Promise.all(flexCerts.map(async (fc, i) => {
        const selfSigned = toStr(fc.subject) === toStr(fc.issuer);
        let issuerChainOk = selfSigned;
        if (!selfSigned && i + 1 < flexCerts.length) {
          issuerChainOk = toStr(fc.issuer) === toStr(flexCerts[i + 1].subject);
        }
        // Determine the issuing certificate (self for roots, next in chain otherwise)
        const issuer = selfSigned ? fc : (i + 1 < flexCerts.length ? flexCerts[i + 1] : null);
        let signatureOk: boolean | null = null;
        if (issuer) {
          if (fc.forge && issuer.forge) {
            // RSA path via forge
            try { signatureOk = issuer.forge.verify(fc.forge); } catch { signatureOk = null; }
          } else {
            // EC / non-RSA path via WebCrypto
            signatureOk = await verifyEcCertSignature(fc.pem, issuer.pem);
          }
        }
        return {
          index: i, subject: toStr(fc.subject), issuer: toStr(fc.issuer),
          notAfter: safeIso(fc.notAfter), selfSigned,
          issuerChainOk, signatureOk,
        };
      }));
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
  const native = isNativeCrypto();
  const [keyAlgo, setKeyAlgo] = useState<KeyAlgoState>({ algo: 'rsa', rsaBits: '2048', curve: 'P-256' });
  const [csrPem, setCsrPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!cn.trim()) { setError('Common Name is required.'); return; }
    setError(''); setLoading(true); setCsrPem(''); setKeyPem('');
    try {
      const sanList = san.split(',').map((s) => s.trim()).filter(Boolean);

      // Native (desktop) path: generate CSR with any algorithm (RSA / EC / Ed).
      if (native) {
        const subject: NativeSubject = {
          common_name: cn.trim(), organization: org.trim(), org_unit: ou.trim(),
          country: country.trim(), state: state.trim(), locality: locality.trim(), san: sanList,
        };
        const out = await nativeCert.generateCsr(subject, toNativeKeySpec(keyAlgo));
        setCsrPem(out.csr_pem); setKeyPem(out.key_pem);
        setLoading(false);
        return;
      }

      const kp = await generateRsaKeyPair(parseInt(keyAlgo.rsaBits));
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
        <div className="col-span-2">
          <KeyAlgoSelector value={keyAlgo} onChange={setKeyAlgo} native={native} />
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
          const keyGen = keyAlgo.algo === 'rsa'
            ? `openssl genrsa -out private.key ${keyAlgo.rsaBits}`
            : keyAlgo.algo === 'ec'
              ? `openssl ecparam -name ${keyAlgo.curve} -genkey -noout -out private.key`
              : `openssl genpkey -algorithm ${keyAlgo.algo} -out private.key`;
          return `# Generate private key (${keyAlgoLabel(keyAlgo)})\n${keyGen}\n\n# Create CSR\nopenssl req -new \\\n  -key private.key \\\n  -subj "${subjStr}"${addExt} \\\n  -out request.csr\n\n# Verify CSR\nopenssl req -in request.csr -noout -text`;
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
  const native = isNativeCrypto();
  const [keyAlgo, setKeyAlgo] = useState<KeyAlgoState>({ algo: 'rsa', rsaBits: '2048', curve: 'P-256' });
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
      // Native (desktop) path: generate certs with any algorithm (RSA / EC / Ed).
      if (native) {
        const sanList = san.split(',').map((s) => s.trim()).filter(Boolean);
        const subject: NativeSubject = {
          common_name: cn.trim(), organization: org.trim(), org_unit: ou.trim(),
          country: country.trim(), state: state.trim(), locality: locality.trim(), san: sanList,
        };
        const out = await nativeCert.generate({
          cert_type: certType,
          subject: certType === 'ca-signed' ? undefined : subject,
          key: toNativeKeySpec(keyAlgo),
          valid_days: days,
          ca_cert_pem: caPem,
          ca_key_pem: caKeyPem,
          csr_pem: csrPem,
        });
        setCertOut(out.cert_pem); setKeyOut(out.key_pem);
        setLoading(false);
        return;
      }

      if (certType === 'self-signed') {
        const kp = await generateRsaKeyPair(parseInt(keyAlgo.rsaBits));
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
        const kp = await generateRsaKeyPair(parseInt(keyAlgo.rsaBits));
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
        const kp = await generateRsaKeyPair(parseInt(keyAlgo.rsaBits));
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
          <div className="col-span-2">
            <KeyAlgoSelector value={keyAlgo} onChange={setKeyAlgo} native={native} />
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
          const newkey = keyAlgo.algo === 'rsa'
            ? `rsa:${keyAlgo.rsaBits}`
            : keyAlgo.algo === 'ec'
              ? `ec -pkeyopt ec_paramgen_curve:${keyAlgo.curve}`
              : keyAlgo.algo;
          if (certType === 'self-signed') {
            return `openssl req -x509 \\\n  -newkey ${newkey} \\\n  -keyout private.key \\\n  -out certificate.crt \\\n  -days ${d} \\\n  -nodes \\${addSan}\n  -subj "${subjStr}"\n\n# Verify:\nopenssl x509 -in certificate.crt -noout -text`;
          }
          if (certType === 'root-ca') {
            return `openssl req -x509 \\\n  -newkey ${newkey} \\\n  -keyout ca.key \\\n  -out ca.crt \\\n  -days ${d} \\\n  -nodes \\\n  -subj "${subjStr}" \\\n  -addext "basicConstraints=critical,CA:TRUE" \\\n  -addext "keyUsage=critical,keyCertSign,cRLSign"\n\n# Verify:\nopenssl x509 -in ca.crt -noout -text`;
          }
          if (certType === 'intermediate-ca') {
            return `# Step 1: Generate intermediate key and CSR\nopenssl req -newkey ${newkey} \\\n  -keyout intermediate.key \\\n  -out intermediate.csr \\\n  -nodes \\\n  -subj "${subjStr}"\n\n# Step 2: Sign with Root CA\nopenssl x509 -req \\\n  -in intermediate.csr \\\n  -CA root-ca.crt \\\n  -CAkey root-ca.key \\\n  -CAcreateserial \\\n  -out intermediate.crt \\\n  -days ${d} \\\n  -sha256 \\\n  -extfile <(printf "basicConstraints=critical,CA:TRUE,pathlen:0\\nkeyUsage=critical,keyCertSign,cRLSign")`;
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
    (async () => {
    try {
      if (!certPem.trim()) { setError('Certificate is required.'); return; }
      if (!keyPem.trim()) { setError('Private key is required.'); return; }

      // Native (desktop) path: OpenSSL bundles cert + key of ANY algorithm (EC/Ed).
      if (isNativeCrypto()) {
        const b64 = await nativeCert.toPkcs12(certPem, keyPem, chainPem, password, friendlyName.trim());
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        setPfxBytes(bytes);
        setReady(true);
        return;
      }

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
    })();
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
