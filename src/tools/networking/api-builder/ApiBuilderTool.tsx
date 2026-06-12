import { useState, useMemo } from 'react';
import { Plus, Trash2, Copy, ChevronDown, Terminal } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE';
type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'digest';
type BodyType = 'none' | 'json' | 'yaml' | 'xml' | 'form' | 'multipart' | 'raw' | 'soap' | 'graphql';
type CodeLang = 'curl' | 'fetch' | 'axios' | 'python' | 'wget' | 'httpie' | 'powershell' | 'php' | 'go';

interface KVPair { id: number; key: string; value: string; enabled: boolean; }

interface AuthState {
  token: string;
  username: string;
  password: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
}

// ─── Templates ───────────────────────────────────────────────────────────────

const BODY_TEMPLATES: Partial<Record<BodyType, string>> = {
  json: `{\n  "key": "value"\n}`,
  yaml: `key: value\nname: example\nitems:\n  - one\n  - two`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <element>value</element>\n</root>`,
  raw: `Hello World`,
  soap: `<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope\n  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"\n  xmlns:tns="http://your-namespace.com/">\n  <soap:Header/>\n  <soap:Body>\n    <tns:YourOperation>\n      <tns:Parameter>value</tns:Parameter>\n    </tns:YourOperation>\n  </soap:Body>\n</soap:Envelope>`,
  graphql: `{\n  "query": "query GetUser($id: ID!) {\\n  user(id: $id) {\\n    id\\n    name\\n    email\\n  }\\n}",\n  "variables": {\n    "id": "1"\n  }\n}`,
};

const CONTENT_TYPES: Partial<Record<BodyType, string>> = {
  json: 'application/json',
  yaml: 'application/x-yaml',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
  soap: 'text/xml; charset=utf-8',
  graphql: 'application/json',
  raw: 'text/plain',
};

const COMMON_HEADERS = [
  'Accept', 'Accept-Encoding', 'Accept-Language', 'Cache-Control',
  'Content-Type', 'X-Request-ID', 'X-Correlation-ID', 'X-Forwarded-For',
  'User-Agent', 'Origin', 'Referer',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _id = 0;
const newKV = (key = '', value = ''): KVPair => ({ id: ++_id, key, value, enabled: true });

function buildHeaders(
  customHeaders: KVPair[],
  authType: AuthType,
  auth: AuthState,
  bodyType: BodyType,
): Record<string, string> {
  const h: Record<string, string> = {};
  const ct = CONTENT_TYPES[bodyType];
  // Don't auto-set Content-Type for multipart — browser/curl handles boundary
  if (ct && bodyType !== 'multipart') h['Content-Type'] = ct;
  if (bodyType === 'soap') h['SOAPAction'] = '""';

  if (authType === 'bearer' || authType === 'oauth2') {
    h['Authorization'] = `Bearer ${auth.token || '<your-token>'}`;
  } else if (authType === 'basic') {
    const encoded = auth.username || auth.password
      ? btoa(`${auth.username}:${auth.password}`)
      : '<base64(user:pass)>';
    h['Authorization'] = `Basic ${encoded}`;
  } else if (authType === 'apikey' && auth.apiKeyIn === 'header') {
    h[auth.apiKeyName || 'X-API-Key'] = auth.apiKeyValue || '<your-api-key>';
  } else if (authType === 'digest') {
    h['Authorization'] = `Digest username="${auth.username || 'user'}", realm="realm", nonce="<nonce>", uri="<uri>", response="<hash>"`;
  }

  for (const row of customHeaders) {
    if (row.enabled && row.key.trim()) h[row.key.trim()] = row.value;
  }
  return h;
}

function buildUrl(base: string, params: KVPair[], authType: AuthType, auth: AuthState): string {
  const effectiveBase = base.trim() || 'https://api.example.com/endpoint';
  const allParams = [...params.filter(p => p.enabled && p.key.trim())];
  if (authType === 'apikey' && auth.apiKeyIn === 'query') {
    allParams.push({ id: 0, key: auth.apiKeyName || 'api_key', value: auth.apiKeyValue || '<key>', enabled: true });
  }
  if (!allParams.length) return effectiveBase;
  const qs = allParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return effectiveBase.includes('?') ? `${effectiveBase}&${qs}` : `${effectiveBase}?${qs}`;
}

function getBody(bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  if (bodyType === 'form') {
    return formFields.filter(f => f.enabled && f.key).map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`).join('&');
  }
  if (bodyType === 'none') return '';
  return bodyText;
}

// ─── Code generators ─────────────────────────────────────────────────────────

function genCurl(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const lines: string[] = [`curl -X ${method} \\`, `  '${url}' \\`];
  for (const [k, v] of Object.entries(headers)) lines.push(`  -H '${k}: ${v}' \\`);

  if (bodyType === 'form') {
    const body = getBody('form', '', formFields);
    if (body) lines.push(`  --data '${body}' \\`);
  } else if (bodyType === 'multipart') {
    for (const f of formFields.filter(f => f.enabled && f.key)) {
      lines.push(`  -F '${f.key}=${f.value}' \\`);
    }
  } else if (bodyText && bodyType !== 'none') {
    const escaped = bodyText.replace(/'/g, `'\\''`);
    lines.push(`  --data-raw '${escaped}' \\`);
  }

  // Remove trailing backslash from last line
  const last = lines[lines.length - 1];
  lines[lines.length - 1] = last.endsWith(' \\') ? last.slice(0, -2) : last;
  return lines.join('\n');
}

function genFetch(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const opts: string[] = [`  method: '${method}'`];
  if (Object.keys(headers).length) {
    opts.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}`);
  }
  if (bodyType === 'multipart') {
    const fields = formFields.filter(f => f.enabled && f.key);
    const appends = fields.map(f => `formData.append('${f.key}', '${f.value}');`).join('\n');
    return `const formData = new FormData();\n${appends}\n\nconst response = await fetch('${url}', {\n${opts.join(',\n')},\n  body: formData,\n});\nconst data = await response.json();`;
  }
  const body = getBody(bodyType, bodyText, formFields);
  if (body) opts.push(`  body: \`${body.replace(/`/g, '\\`')}\``);
  return `const response = await fetch('${url}', {\n${opts.join(',\n')},\n});\nconst data = await response.json();`;
}

function genAxios(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const m = method.toLowerCase();
  const hasBody = ['post', 'put', 'patch'].includes(m) && bodyType !== 'none';

  if (bodyType === 'multipart') {
    const fields = formFields.filter(f => f.enabled && f.key);
    const appends = fields.map(f => `formData.append('${f.key}', '${f.value}');`).join('\n');
    const hdrs = JSON.stringify({ ...headers, 'Content-Type': 'multipart/form-data' }, null, 2);
    return `const formData = new FormData();\n${appends}\n\nconst { data } = await axios.${m}('${url}', formData, {\n  headers: ${hdrs.replace(/\n/g, '\n  ')},\n});`;
  }

  const body = getBody(bodyType, bodyText, formFields);
  const cfg: string[] = [];
  if (Object.keys(headers).length) cfg.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}`);
  const cfgStr = cfg.length ? `, {\n${cfg.join(',\n')}\n}` : '';

  if (hasBody && body) {
    const bodyArg = bodyType === 'json' ? body.trim() : `\`${body.replace(/`/g, '\\`')}\``;
    return `const { data } = await axios.${m}('${url}', ${bodyArg}${cfgStr});`;
  }
  return `const { data } = await axios.${m}('${url}'${cfgStr});`;
}

function genPython(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const lines = ['import requests', ''];
  if (Object.keys(headers).length) lines.push(`headers = ${JSON.stringify(headers, null, 4)}`, '');

  const headerArg = Object.keys(headers).length ? ', headers=headers' : '';
  let bodyArg = '';

  if (bodyType === 'json') {
    lines.push(`payload = ${bodyText || '{}'}`, '');
    bodyArg = ', json=payload';
  } else if (bodyType === 'form') {
    const fields = Object.fromEntries(formFields.filter(f => f.enabled && f.key).map(f => [f.key, f.value]));
    lines.push(`data = ${JSON.stringify(fields, null, 4)}`, '');
    bodyArg = ', data=data';
  } else if (bodyType === 'multipart') {
    const files = formFields.filter(f => f.enabled && f.key).map(f => `    '${f.key}': (None, '${f.value}')`).join(',\n');
    lines.push(`files = {\n${files}\n}`, '');
    bodyArg = ', files=files';
  } else if (bodyText && bodyType !== 'none') {
    lines.push(`body = """${bodyText}"""`, '');
    bodyArg = ', data=body';
  }

  lines.push(`response = requests.${method.toLowerCase()}('${url}'${headerArg}${bodyArg})`);
  lines.push('print(response.status_code)');
  lines.push('print(response.text)');
  return lines.join('\n');
}

function genGo(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const body = getBody(bodyType, bodyText, formFields);
  const hasBody = !!(body && bodyType !== 'none');
  const imports = ['"fmt"', '"io"', '"net/http"', hasBody ? '"strings"' : ''].filter(Boolean);
  const lines = [
    'package main', '',
    'import (', ...imports.map(i => `\t${i}`), ')', '',
    'func main() {',
  ];
  if (hasBody) {
    lines.push(`\tbody := strings.NewReader(\`${body.replace(/`/g, '` + "`" + `')}\`)`);
    lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", body)`);
  } else {
    lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", nil)`);
  }
  for (const [k, v] of Object.entries(headers)) lines.push(`\treq.Header.Set("${k}", "${v}")`);
  lines.push('\tclient := &http.Client{}');
  lines.push('\tresp, _ := client.Do(req)');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('\tb, _ := io.ReadAll(resp.Body)');
  lines.push('\tfmt.Println(string(b))');
  lines.push('}');
  return lines.join('\n');
}

function genHttpie(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  if (bodyType === 'form' || bodyType === 'multipart') {
    const flag = bodyType === 'form' ? '--form' : '--multipart';
    const fields = formFields.filter(f => f.enabled && f.key).map(f => `${f.key}='${f.value}'`).join(' ');
    const hdrStr = Object.entries(headers).filter(([k]) => k !== 'Content-Type').map(([k, v]) => `'${k}:${v}'`).join(' ');
    return `http ${flag} ${method} '${url}' ${hdrStr} ${fields}`.trim();
  }
  const body = getBody(bodyType, bodyText, formFields);
  const hdrStr = Object.entries(headers).map(([k, v]) => `'${k}:${v}'`).join(' ');
  if (body) return `echo '${body.replace(/'/g, `'\\''`)}' | http ${method} '${url}' ${hdrStr}`.trim();
  return `http ${method} '${url}' ${hdrStr}`.trim();
}

function genWget(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const body = getBody(bodyType, bodyText, formFields);
  const lines = [`wget \\`, `  --method=${method} \\`];
  for (const [k, v] of Object.entries(headers)) lines.push(`  --header='${k}: ${v}' \\`);
  if (body) lines.push(`  --body-data='${body.replace(/'/g, `'\\''`)}' \\`);
  lines.push(`  --output-document=- \\`, `  '${url}'`);
  const last = lines[lines.length - 2];
  lines[lines.length - 2] = last.endsWith(' \\') ? last.slice(0, -2) : last;
  return lines.join('\n');
}

function genPowerShell(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const body = getBody(bodyType, bodyText, formFields);
  const lines: string[] = [];
  if (Object.keys(headers).length) {
    lines.push('$headers = @{');
    for (const [k, v] of Object.entries(headers)) lines.push(`  '${k}' = '${v}'`);
    lines.push('}', '');
  }
  const hdrPart = Object.keys(headers).length ? ' -Headers $headers' : '';
  if (body) {
    lines.push(`$body = @'`, body, `'@`, '');
    lines.push(`Invoke-RestMethod -Method ${method} -Uri '${url}'${hdrPart} -Body $body`);
  } else {
    lines.push(`Invoke-RestMethod -Method ${method} -Uri '${url}'${hdrPart}`);
  }
  return lines.join('\n');
}

function genPhp(method: HttpMethod, url: string, headers: Record<string, string>, bodyType: BodyType, bodyText: string, formFields: KVPair[]): string {
  const body = getBody(bodyType, bodyText, formFields);
  const lines = ['<?php', "require 'vendor/autoload.php';", '', 'use GuzzleHttp\\Client;', '', '$client = new Client();', ''];
  const opts: string[] = [];
  if (Object.keys(headers).length) {
    const hdrLines = Object.entries(headers).map(([k, v]) => `    '${k}' => '${v}'`).join(",\n");
    opts.push(`'headers' => [\n${hdrLines}\n  ]`);
  }
  if (body && bodyType !== 'none') {
    if (bodyType === 'json') opts.push(`'json' => json_decode('${body.replace(/'/g, "\\'")}', true)`);
    else if (bodyType === 'form') opts.push(`'form_params' => json_decode('${JSON.stringify(Object.fromEntries(formFields.filter(f => f.enabled && f.key).map(f => [f.key, f.value])))}', true)`);
    else opts.push(`'body' => '${body.replace(/'/g, "\\'")}'`);
  }
  const optsStr = opts.length ? `[\n  ${opts.join(',\n  ')}\n]` : '[]';
  lines.push(`$response = $client->request('${method}', '${url}', ${optsStr});`);
  lines.push('', 'echo $response->getBody();');
  return lines.join('\n');
}

// ─── UI Components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      style={{ background: 'rgba(255,255,255,0.08)', color: '#8b949e' }}
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      <Copy size={10} />{copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function KVTable({ rows, onChange, placeholder = ['Key', 'Value'] }: {
  rows: KVPair[];
  onChange: (rows: KVPair[]) => void;
  placeholder?: [string, string];
}) {
  const update = (id: number, field: keyof KVPair, val: string | boolean) =>
    onChange(rows.map(r => r.id === id ? { ...r, [field]: val } : r));

  return (
    <div className="space-y-1">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={e => update(row.id, 'enabled', e.target.checked)}
            className="flex-shrink-0 accent-indigo-500"
          />
          <input
            className="input-base text-xs flex-1 min-w-0"
            placeholder={placeholder[0]}
            value={row.key}
            onChange={e => update(row.id, 'key', e.target.value)}
            list={`kv-header-list-${row.id}`}
          />
          <input
            className="input-base text-xs flex-1 min-w-0"
            placeholder={placeholder[1]}
            value={row.value}
            onChange={e => update(row.id, 'value', e.target.value)}
          />
          <button
            className="btn btn-ghost btn-sm text-red-400 flex-shrink-0 px-1"
            onClick={() => onChange(rows.filter(r => r.id !== row.id))}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm flex items-center gap-1 text-xs"
        style={{ color: 'var(--accent)' }}
        onClick={() => onChange([...rows, newKV()])}
      >
        <Plus size={12} />Add row
      </button>
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#161b22' }}>
        <span className="text-xs font-mono" style={{ color: '#8b949e' }}>{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre
        className="p-4 text-xs font-mono overflow-x-auto"
        style={{ background: '#0d1117', color: '#e6edf3', margin: 0, lineHeight: 1.7, maxHeight: 380 }}
      >
        {code}
      </pre>
    </div>
  );
}

// ─── Main tool ───────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:     '#61afef',
  POST:    '#98c379',
  PUT:     '#e5c07b',
  PATCH:   '#c678dd',
  DELETE:  '#e06c75',
  HEAD:    '#56b6c2',
  OPTIONS: '#abb2bf',
  TRACE:   '#abb2bf',
};

const TABS = ['Request', 'Headers', 'Auth', 'Body', 'Code'] as const;
type Tab = typeof TABS[number];

const LANG_LABELS: Record<CodeLang, string> = {
  curl: 'cURL', fetch: 'Fetch (JS)', axios: 'Axios', python: 'Python',
  go: 'Go', httpie: 'HTTPie', wget: 'wget', powershell: 'PowerShell', php: 'PHP (Guzzle)',
};

export default function ApiBuilderTool() {
  const [tab, setTab] = useState<Tab>('Request');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('https://api.example.com/v1/users');
  const [queryParams, setQueryParams] = useState<KVPair[]>([newKV('limit', '10'), newKV('page', '1')]);
  const [headers, setHeaders] = useState<KVPair[]>([newKV('Accept', 'application/json')]);
  const [authType, setAuthType] = useState<AuthType>('none');
  const [auth, setAuth] = useState<AuthState>({ token: '', username: '', password: '', apiKeyName: 'X-API-Key', apiKeyValue: '', apiKeyIn: 'header' });
  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyText, setBodyText] = useState('');
  const [formFields, setFormFields] = useState<KVPair[]>([newKV()]);
  const [rawContentType, setRawContentType] = useState('text/plain');
  const [codeLang, setCodeLang] = useState<CodeLang>('curl');

  const updateAuth = (k: keyof AuthState, v: string) => setAuth(prev => ({ ...prev, [k]: v }));

  const effectiveHeaders = useMemo(
    () => buildHeaders(headers, authType, auth, bodyType),
    [headers, authType, auth, bodyType],
  );
  const effectiveUrl = useMemo(
    () => buildUrl(url, queryParams, authType, auth),
    [url, queryParams, authType, auth],
  );
  const effectiveBodyText = useMemo(
    () => bodyType === 'raw' ? (bodyText || BODY_TEMPLATES.raw!) : (bodyText || BODY_TEMPLATES[bodyType] || ''),
    [bodyType, bodyText],
  );

  const code = useMemo(() => {
    const args: [HttpMethod, string, Record<string, string>, BodyType, string, KVPair[]] =
      [method, effectiveUrl, effectiveHeaders, bodyType, effectiveBodyText, formFields];
    switch (codeLang) {
      case 'curl':       return genCurl(...args);
      case 'fetch':      return genFetch(...args);
      case 'axios':      return genAxios(...args);
      case 'python':     return genPython(...args);
      case 'go':         return genGo(...args);
      case 'httpie':     return genHttpie(...args);
      case 'wget':       return genWget(...args);
      case 'powershell': return genPowerShell(...args);
      case 'php':        return genPhp(...args);
    }
  }, [method, effectiveUrl, effectiveHeaders, bodyType, effectiveBodyText, formFields, codeLang]);

  // Switch body template when bodyType changes (only if body is empty or was a template)
  const handleBodyTypeChange = (bt: BodyType) => {
    setBodyType(bt);
    if (!bodyText || Object.values(BODY_TEMPLATES).includes(bodyText)) {
      setBodyText(BODY_TEMPLATES[bt] || '');
    }
  };

  return (
    <div className="tool-panel flex flex-col h-full">
      {/* Header */}
      <div className="tool-header flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API Request Builder</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Build REST, SOAP & GraphQL requests — generates curl, fetch, axios, Python, Go and more
          </p>
        </div>
      </div>

      {/* Method + URL bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 pb-3 pt-1">
        <div className="relative">
          <select
            className="input-base font-bold text-xs pr-7 appearance-none"
            style={{ color: METHOD_COLORS[method], background: 'var(--bg-secondary)', minWidth: 96 }}
            value={method}
            onChange={e => setMethod(e.target.value as HttpMethod)}
          >
            {(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','TRACE'] as HttpMethod[]).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
        <input
          className="input-base flex-1 text-sm font-mono"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b gap-0 px-4" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t}
            className="px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
            style={{ borderBottomColor: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-muted)' }}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Headers' && (headers.filter(h => h.enabled && h.key).length + Object.keys(effectiveHeaders).filter(k => !headers.some(h => h.key === k)).length) > 0 && (
              <span className="ml-1 rounded-full px-1 text-xs" style={{ background: 'var(--accent)', color: 'white', fontSize: 9 }}>
                {Object.keys(effectiveHeaders).length}
              </span>
            )}
            {t === 'Auth' && authType !== 'none' && (
              <span className="ml-1 rounded-full px-1 text-xs" style={{ background: 'var(--success)', color: 'white', fontSize: 9 }}>●</span>
            )}
            {t === 'Body' && bodyType !== 'none' && (
              <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: 9 }}>({bodyType})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">

        {/* ── Request tab ── */}
        {tab === 'Request' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Query Parameters</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {queryParams.filter(p => p.enabled && p.key).length} active
                </span>
              </div>
              <KVTable rows={queryParams} onChange={setQueryParams} placeholder={['Parameter', 'Value']} />
            </div>

            {/* Effective URL preview */}
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Effective URL</p>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <span className="text-xs font-mono break-all flex-1" style={{ color: 'var(--accent)' }}>{effectiveUrl}</span>
                <button className="flex-shrink-0" onClick={() => navigator.clipboard.writeText(effectiveUrl)}>
                  <Copy size={11} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Headers tab ── */}
        {tab === 'Headers' && (
          <div className="space-y-5 max-w-2xl">
            <datalist id="common-header-list">
              {COMMON_HEADERS.map(h => <option key={h} value={h} />)}
            </datalist>
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Custom Headers</p>
              <KVTable rows={headers} onChange={setHeaders} placeholder={['Header name', 'Value']} />
            </div>

            {/* Effective headers preview */}
            {Object.keys(effectiveHeaders).length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>All headers (including auto-set)</p>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {Object.entries(effectiveHeaders).map(([k, v]) => (
                    <div key={k} className="flex gap-3 px-3 py-1.5 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-mono font-medium w-48 flex-shrink-0" style={{ color: 'var(--accent)' }}>{k}</span>
                      <span className="font-mono break-all" style={{ color: 'var(--text-primary)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Auth tab ── */}
        {tab === 'Auth' && (
          <div className="space-y-4 max-w-xl">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Authentication Type</p>
              <div className="grid grid-cols-3 gap-2">
                {(['none','bearer','basic','apikey','oauth2','digest'] as AuthType[]).map(a => (
                  <button
                    key={a}
                    className="py-2 px-3 rounded-lg border text-xs font-medium transition-colors text-left"
                    style={{
                      borderColor: authType === a ? 'var(--accent)' : 'var(--border)',
                      background: authType === a ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                      color: authType === a ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                    onClick={() => setAuthType(a)}
                  >
                    {{ none: 'No Auth', bearer: 'Bearer Token', basic: 'Basic Auth', apikey: 'API Key', oauth2: 'OAuth 2.0', digest: 'Digest' }[a]}
                  </button>
                ))}
              </div>
            </div>

            {authType === 'bearer' || authType === 'oauth2' ? (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Token</label>
                <input className="input-base font-mono text-xs" type="password" autoComplete="off"
                  value={auth.token} onChange={e => updateAuth('token', e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Added as: <code className="font-mono" style={{ color: 'var(--accent)' }}>Authorization: Bearer &lt;token&gt;</code>
                </p>
              </div>
            ) : authType === 'basic' || authType === 'digest' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
                  <input className="input-base text-xs" value={auth.username} onChange={e => updateAuth('username', e.target.value)} placeholder="user" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
                  <input className="input-base text-xs" type="password" autoComplete="off" value={auth.password} onChange={e => updateAuth('password', e.target.value)} placeholder="••••••••" />
                </div>
                {authType === 'basic' && auth.username && (
                  <div className="col-span-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Encoded: <span className="font-mono" style={{ color: 'var(--accent)' }}>{btoa(`${auth.username}:${auth.password}`)}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : authType === 'apikey' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key Name</label>
                    <input className="input-base text-xs" value={auth.apiKeyName} onChange={e => updateAuth('apiKeyName', e.target.value)} placeholder="X-API-Key" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Key Value</label>
                    <input className="input-base text-xs" type="password" autoComplete="off" value={auth.apiKeyValue} onChange={e => updateAuth('apiKeyValue', e.target.value)} placeholder="sk-••••••••" />
                  </div>
                </div>
                <div>
                  <p className="text-xs mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>Add key in</p>
                  <div className="flex gap-2">
                    {(['header', 'query'] as const).map(loc => (
                      <label key={loc} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                        <input type="radio" checked={auth.apiKeyIn === loc} onChange={() => setAuth(p => ({ ...p, apiKeyIn: loc }))} />
                        {loc === 'header' ? 'Request Header' : 'Query Parameter'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Body tab ── */}
        {tab === 'Body' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Body Type</p>
              <div className="flex flex-wrap gap-2">
                {(['none','json','yaml','xml','form','multipart','raw','soap','graphql'] as BodyType[]).map(bt => (
                  <button
                    key={bt}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                    style={{
                      borderColor: bodyType === bt ? 'var(--accent)' : 'var(--border)',
                      background: bodyType === bt ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                      color: bodyType === bt ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                    onClick={() => handleBodyTypeChange(bt)}
                  >
                    {bt === 'none' ? 'None' : bt === 'graphql' ? 'GraphQL' : bt === 'soap' ? 'SOAP/XML' : bt === 'form' ? 'Form URL-encoded' : bt === 'multipart' ? 'Multipart' : bt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {bodyType === 'none' && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No body will be sent with this request.</p>
            )}

            {(bodyType === 'form' || bodyType === 'multipart') && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {bodyType === 'form' ? 'Form Fields (URL-encoded)' : 'Form Fields (multipart)'}
                </p>
                <KVTable rows={formFields} onChange={setFormFields} placeholder={['Field name', 'Value']} />
              </div>
            )}

            {bodyType === 'raw' && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Content-Type</label>
                  <input className="input-base text-xs flex-1" value={rawContentType} onChange={e => setRawContentType(e.target.value)} placeholder="text/plain" />
                </div>
              </div>
            )}

            {(bodyType === 'json' || bodyType === 'yaml' || bodyType === 'xml' || bodyType === 'raw' || bodyType === 'soap' || bodyType === 'graphql') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {bodyType === 'graphql' ? 'Query + Variables (JSON)' : `Body (${bodyType.toUpperCase()})`}
                  </label>
                  <button
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => setBodyText(BODY_TEMPLATES[bodyType] || '')}
                  >
                    Reset template
                  </button>
                </div>
                <textarea
                  className="input-base font-mono text-xs resize-none"
                  rows={12}
                  value={bodyText || BODY_TEMPLATES[bodyType] || ''}
                  onChange={e => setBodyText(e.target.value)}
                  spellCheck={false}
                />
                {bodyType === 'soap' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    SOAP requests auto-set <code className="font-mono">Content-Type: text/xml</code> and <code className="font-mono">SOAPAction: ""</code>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Code tab ── */}
        {tab === 'Code' && (
          <div className="space-y-4">
            {/* Language selector */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LANG_LABELS) as CodeLang[]).map(lang => (
                <button
                  key={lang}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                  style={{
                    borderColor: codeLang === lang ? 'var(--accent)' : 'var(--border)',
                    background: codeLang === lang ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                    color: codeLang === lang ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                  onClick={() => setCodeLang(lang)}
                >
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>

            <CodeBlock code={code} lang={LANG_LABELS[codeLang]} />

            {/* Request summary */}
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Terminal size={11} className="inline mr-1.5" />Request summary
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Method</span>
                <span className="font-bold font-mono" style={{ color: METHOD_COLORS[method] }}>{method}</span>
                <span style={{ color: 'var(--text-muted)' }}>Auth</span>
                <span style={{ color: 'var(--text-primary)' }}>{{ none: 'None', bearer: 'Bearer', basic: 'Basic', apikey: 'API Key', oauth2: 'OAuth 2.0', digest: 'Digest' }[authType]}</span>
                <span style={{ color: 'var(--text-muted)' }}>Body</span>
                <span style={{ color: 'var(--text-primary)' }}>{bodyType === 'none' ? 'None' : bodyType.toUpperCase()}</span>
                <span style={{ color: 'var(--text-muted)' }}>Headers</span>
                <span style={{ color: 'var(--text-primary)' }}>{Object.keys(effectiveHeaders).length} total</span>
                <span style={{ color: 'var(--text-muted)' }}>Query params</span>
                <span style={{ color: 'var(--text-primary)' }}>{queryParams.filter(p => p.enabled && p.key).length} active</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
