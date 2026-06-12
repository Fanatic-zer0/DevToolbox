import type { ToolDefinition } from './types';

const tools: ToolDefinition[] = [
  // ─── GENERATORS ──────────────────────────────────────────────
  {
    id: 'uuid-ulid', title: 'UUID / ULID Generator', description: 'Generate and decode UUID v1/v4/v7 and ULID identifiers',
    category: 'generators', keywords: ['uuid', 'ulid', 'guid', 'id', 'generate'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { type: 'uuid4', count: 1 },
    load: () => import('./generators/uuid/UuidTool'),
  },
  {
    id: 'hash-generator', title: 'Hash Generator', description: 'Compute MD5, SHA-1, SHA-256, SHA-512 and Keccak-256 hashes',
    category: 'generators', keywords: ['hash', 'md5', 'sha1', 'sha256', 'sha512', 'keccak', 'checksum'],
    inputKind: 'mixed', outputKind: 'text', defaultOptions: { algorithm: 'sha256' },
    load: () => import('./generators/hash/HashTool'),
  },
  {
    id: 'base64-string', title: 'Base64 String Encode / Decode', description: 'Encode or decode Base64 strings',
    category: 'generators', keywords: ['base64', 'encode', 'decode', 'b64'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'encode', urlSafe: false },
    detect: ({ text }) => {
      const t = text.trim().replace(/\s/g, '');
      if (/^[A-Za-z0-9+/]+=*$/.test(t) && t.length % 4 === 0 && t.length > 8)
        return { confidence: 0.65, reason: 'Looks like Base64' };
      return { confidence: 0, reason: '' };
    },
    load: () => import('./generators/base64/Base64StringTool'),
  },
  {
    id: 'base64-image', title: 'Base64 Image Encode / Decode', description: 'Encode images to Base64 data URLs or decode them',
    category: 'generators', keywords: ['base64', 'image', 'encode', 'decode', 'data url', 'img'],
    inputKind: 'image', outputKind: 'mixed', defaultOptions: { mode: 'encode' },
    load: () => import('./generators/base64-image/Base64ImageTool'),
  },
  {
    id: 'url-encode', title: 'URL Encode / Decode', description: 'Percent-encode or decode URL components',
    category: 'generators', keywords: ['url', 'encode', 'decode', 'percent', 'uri'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'encode', full: false },
    load: () => import('./generators/url-encode/UrlEncodeTool'),
  },
  {
    id: 'html-entity', title: 'HTML Entity Encode / Decode', description: 'Encode or decode HTML entities',
    category: 'generators', keywords: ['html', 'entity', 'encode', 'decode', 'escape', 'unescape', '&amp;'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'encode' },
    load: () => import('./generators/html-entity/HtmlEntityTool'),
  },
  {
    id: 'backslash-escape', title: 'Backslash Escape / Unescape', description: 'Escape or unescape backslash sequences in strings',
    category: 'generators', keywords: ['backslash', 'escape', 'unescape', 'string', '\\n', '\\t'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'escape' },
    load: () => import('./generators/backslash/BackslashTool'),
  },
  {
    id: 'random-string', title: 'Random String Generator', description: 'Generate random strings, passwords, and tokens',
    category: 'generators', keywords: ['random', 'string', 'password', 'token', 'generate'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { length: 32, charset: 'alphanumeric', count: 1 },
    load: () => import('./generators/random/RandomStringTool'),
  },
  {
    id: 'lorem-ipsum', title: 'Lorem Ipsum Generator', description: 'Generate placeholder Lorem Ipsum text',
    category: 'generators', keywords: ['lorem', 'ipsum', 'placeholder', 'text', 'dummy'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { type: 'paragraphs', count: 3 },
    load: () => import('./generators/lorem/LoremTool'),
  },
  {
    id: 'qr-code', title: 'QR Code Reader / Generator', description: 'Generate QR codes or scan them from images',
    category: 'generators', keywords: ['qr', 'qrcode', 'barcode', 'scan', 'generate'],
    inputKind: 'mixed', outputKind: 'image', defaultOptions: { mode: 'generate', errorCorrection: 'M' },
    load: () => import('./generators/qr/QrTool'),
  },

  // ─── CONVERTERS ──────────────────────────────────────────────
  {
    id: 'unix-time', title: 'Unix Time Converter', description: 'Convert Unix timestamps to dates and vice versa',
    category: 'converters', keywords: ['unix', 'timestamp', 'epoch', 'date', 'time', 'convert'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { timezone: 'local' },
    load: () => import('./converters/unix-time/UnixTimeTool'),
  },
  {
    id: 'url-parser', title: 'URL Parser', description: 'Parse a URL into its components: scheme, host, path, query, hash',
    category: 'converters', keywords: ['url', 'parse', 'query', 'path', 'host', 'href'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./converters/url-parser/UrlParserTool'),
  },
  {
    id: 'yaml-json', title: 'YAML ↔ JSON', description: 'Convert between YAML and JSON formats',
    category: 'converters', keywords: ['yaml', 'json', 'convert', 'transform'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { direction: 'yaml-to-json', indent: 2 },
    load: () => import('./converters/yaml-json/YamlJsonTool'),
  },
  {
    id: 'json-csv', title: 'JSON ↔ CSV', description: 'Convert between JSON arrays and CSV tables',
    category: 'converters', keywords: ['json', 'csv', 'table', 'convert', 'spreadsheet'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { direction: 'json-to-csv', delimiter: ',' },
    load: () => import('./converters/json-csv/JsonCsvTool'),
  },
  {
    id: 'number-base', title: 'Number Base Converter', description: 'Convert numbers between binary, octal, decimal, and hex',
    category: 'converters', keywords: ['binary', 'octal', 'decimal', 'hex', 'hexadecimal', 'base', 'convert'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { fromBase: 10 },
    load: () => import('./converters/number-base/NumberBaseTool'),
  },
  {
    id: 'string-case', title: 'String Case Converter', description: 'Convert string between camelCase, snake_case, PascalCase, kebab-case etc.',
    category: 'converters', keywords: ['case', 'camel', 'snake', 'pascal', 'kebab', 'upper', 'lower', 'convert'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./converters/string-case/StringCaseTool'),
  },
  {
    id: 'html-jsx', title: 'HTML → JSX', description: 'Convert HTML markup to valid JSX for React',
    category: 'converters', keywords: ['html', 'jsx', 'react', 'convert', 'className'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./converters/html-jsx/HtmlJsxTool'),
  },
  {
    id: 'hex-ascii', title: 'Hex ↔ ASCII / Text', description: 'Convert between hexadecimal and ASCII text',
    category: 'converters', keywords: ['hex', 'ascii', 'text', 'convert', 'binary'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { direction: 'hex-to-ascii' },
    load: () => import('./converters/hex-ascii/HexAsciiTool'),
  },
  {
    id: 'line-sort', title: 'Line Sort / Deduplicate', description: 'Sort lines alphabetically and remove duplicates',
    category: 'converters', keywords: ['sort', 'dedupe', 'deduplicate', 'lines', 'unique', 'filter'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { sort: true, dedupe: false, reverse: false, trim: true },
    load: () => import('./converters/line-sort/LineSortTool'),
  },
  {
    id: 'svg-css', title: 'SVG → CSS', description: 'Convert SVG to a CSS background-image data URL',
    category: 'converters', keywords: ['svg', 'css', 'background', 'data url', 'convert'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./converters/svg-css/SvgCssTool'),
  },
  {
    id: 'curl-to-code', title: 'cURL to Code', description: 'Convert cURL commands to fetch, axios, Python requests, and more',
    category: 'converters', keywords: ['curl', 'fetch', 'axios', 'python', 'requests', 'convert', 'http'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { target: 'fetch' },
    load: () => import('./converters/curl/CurlTool'),
  },
  {
    id: 'json-to-code', title: 'JSON to Code', description: 'Generate TypeScript, Python, Go, and Rust types/structs from JSON',
    category: 'converters', keywords: ['json', 'typescript', 'python', 'go', 'rust', 'type', 'struct', 'codegen'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { target: 'typescript' },
    load: () => import('./converters/json-to-code/JsonToCodeTool'),
  },
  {
    id: 'php-json', title: 'PHP ↔ JSON', description: 'Convert between PHP serialized format and JSON',
    category: 'converters', keywords: ['php', 'json', 'serialize', 'unserialize', 'convert'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { direction: 'php-to-json' },
    load: () => import('./converters/php/PhpJsonTool'),
  },

  // ─── INSPECT / PREVIEW ───────────────────────────────────────
  {
    id: 'jwt-debugger', title: 'JWT Debugger', description: 'Decode and inspect JSON Web Tokens',
    category: 'inspect', keywords: ['jwt', 'token', 'auth', 'json', 'bearer', 'decode', 'debug'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./inspect/jwt/JwtTool'),
  },
  {
    id: 'regexp-tester', title: 'RegExp Tester', description: 'Test regular expressions with live match highlighting',
    category: 'inspect', keywords: ['regex', 'regexp', 'regular expression', 'test', 'pattern', 'match'],
    inputKind: 'text', outputKind: 'preview', defaultOptions: { flags: 'g' },
    load: () => import('./inspect/regexp/RegExpTool'),
  },
  {
    id: 'html-preview', title: 'HTML Preview', description: 'Render HTML in a sandboxed iframe',
    category: 'inspect', keywords: ['html', 'preview', 'render', 'browser'],
    inputKind: 'text', outputKind: 'preview', defaultOptions: {},
    load: () => import('./inspect/html-preview/HtmlPreviewTool'),
  },
  {
    id: 'text-diff', title: 'Text Diff Checker', description: 'Compare two blocks of text and highlight differences',
    category: 'inspect', keywords: ['diff', 'compare', 'text', 'difference', 'patch'],
    inputKind: 'text', outputKind: 'preview', defaultOptions: { mode: 'chars' },
    load: () => import('./inspect/diff/DiffTool'),
  },
  {
    id: 'string-inspector', title: 'String Inspector', description: 'Inspect string length, byte count, character codes, and encoding info',
    category: 'inspect', keywords: ['string', 'inspect', 'length', 'bytes', 'chars', 'unicode'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./inspect/string-inspector/StringInspectorTool'),
  },
  {
    id: 'markdown-preview', title: 'Markdown Preview', description: 'Render Markdown as HTML with live preview',
    category: 'inspect', keywords: ['markdown', 'md', 'preview', 'render'],
    inputKind: 'text', outputKind: 'preview', defaultOptions: {},
    load: () => import('./inspect/markdown/MarkdownTool'),
  },
  {
    id: 'cron-parser', title: 'Cron Job Parser', description: 'Parse and explain cron expressions with next run times',
    category: 'inspect', keywords: ['cron', 'schedule', 'job', 'expression', 'parse'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./inspect/cron/CronTool'),
  },
  {
    id: 'color-converter', title: 'Color Converter', description: 'Convert colors between HEX, RGB, HSL, HSV, HWB and named colors',
    category: 'inspect', keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'convert', 'palette'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./inspect/color/ColorTool'),
  },
  {
    id: 'certificate-decoder', title: 'Certificate Tools', description: 'Decode X.509 certs, verify cert↔key/CSR match, and validate certificate chains',
    category: 'inspect', keywords: ['certificate', 'cert', 'x509', 'tls', 'ssl', 'pem', 'x.509', 'csr', 'private key', 'chain'],
    inputKind: 'text', outputKind: 'mixed', sensitive: true, defaultOptions: {},
    load: () => import('./inspect/certificate/CertificateTool'),
  },
  {
    id: 'pgp-tool', title: 'PGP / GPG Tool', description: 'Generate keys, encrypt, decrypt, sign and verify PGP messages',
    category: 'inspect', keywords: ['pgp', 'gpg', 'encrypt', 'decrypt', 'sign', 'verify', 'key', 'openpgp'],
    inputKind: 'text', outputKind: 'text', sensitive: true, defaultOptions: {},
    load: () => import('./inspect/pgp/PgpTool'),
  },

  // ─── DEVOPS & INFRASTRUCTURE ─────────────────────────────────
  {
    id: 'helm-values', title: 'Helm Values Helper', description: 'Inspect and diff Helm values.yaml files — flatten keys, inspect types, compare releases',
    category: 'devops', keywords: ['helm', 'values', 'yaml', 'kubernetes', 'k8s', 'chart', 'diff', 'inspect'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./devops/helm-values/HelmValuesToool'),
  },
  {
    id: 'k8s-validator', title: 'K8s Manifest Validator', description: 'Lint Kubernetes YAML manifests for required fields and best practices',
    category: 'devops', keywords: ['kubernetes', 'k8s', 'yaml', 'manifest', 'lint', 'validate', 'deployment', 'pod'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./devops/k8s-validator/K8sValidatorTool'),
  },
  {
    id: 'k8s-generator', title: 'K8s YAML Generator', description: 'Generate production-ready boilerplate YAML for Deployments, Services, Ingress, HPA, and more',
    category: 'devops', keywords: ['kubernetes', 'k8s', 'yaml', 'generate', 'boilerplate', 'deployment', 'service', 'ingress'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./devops/k8s-generator/K8sGeneratorTool'),
  },
  {
    id: 'kubectl-builder', title: 'kubectl Command Builder', description: 'Interactively build kubectl commands — get, logs, exec, scale, rollout, port-forward, and more',
    category: 'devops', keywords: ['kubectl', 'kubernetes', 'k8s', 'command', 'cli', 'builder', 'logs', 'exec'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./devops/kubectl-builder/KubectlBuilderTool'),
  },

  // ─── NETWORKING ──────────────────────────────────────────────
  {
    id: 'api-builder', title: 'API Request Builder',
    description: 'Build REST, SOAP & GraphQL requests with headers, auth, and body — generates curl, fetch, axios, Python, Go and more',
    category: 'networking',
    keywords: ['api', 'rest', 'soap', 'graphql', 'curl', 'http', 'request', 'builder', 'fetch', 'axios', 'postman', 'headers', 'auth', 'bearer', 'token', 'json', 'xml'],
    inputKind: 'text', outputKind: 'text', defaultOptions: {},
    load: () => import('./networking/api-builder/ApiBuilderTool'),
  },
  {
    id: 'cidr-calculator', title: 'CIDR / Subnet Calculator', description: 'Calculate network address, broadcast, usable range, host count and subnetting for IPv4 and IPv6',
    category: 'networking', keywords: ['cidr', 'subnet', 'network', 'ip', 'ipv4', 'ipv6', 'mask', 'broadcast', 'subnetting'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/cidr/CidrTool'),
  },
  {
    id: 'ip-inspector', title: 'IP Address Inspector', description: 'Classify any IPv4 or IPv6 address — scope, RFC category, binary and hex representations',
    category: 'networking', keywords: ['ip', 'ipv4', 'ipv6', 'address', 'inspect', 'private', 'public', 'rfc', 'classify', 'loopback'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/ip-inspector/IpInspectorTool'),
  },
  {
    id: 'dns-lookup', title: 'DNS Record Lookup', description: 'Query DNS records via Cloudflare DoH — A, AAAA, MX, TXT, CNAME, NS, SOA and more',
    category: 'networking', keywords: ['dns', 'lookup', 'domain', 'record', 'a', 'aaaa', 'mx', 'txt', 'cname', 'ns', 'soa'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/dns-lookup/DnsLookupTool'),
  },
  {
    id: 'http-headers', title: 'HTTP Header Inspector', description: 'Fetch and inspect HTTP response headers — security grading, cache, CORS, and server info',
    category: 'networking', keywords: ['http', 'headers', 'inspect', 'security', 'hsts', 'csp', 'cors', 'cache', 'response'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/http-headers/HttpHeadersTool'),
  },
  {
    id: 'port-reference', title: 'Port Reference', description: 'Well-known and commonly used TCP/UDP port numbers — search by port number or service name',
    category: 'networking', keywords: ['port', 'tcp', 'udp', 'service', 'well-known', 'reference', 'database', 'lookup'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/port-reference/PortReferenceTool'),
  },
  {
    id: 'ping-latency', title: 'Ping / Latency Test', description: 'Measure HTTP round-trip latency to any URL — min, avg, max, jitter and packet loss',
    category: 'networking', keywords: ['ping', 'latency', 'rtt', 'http', 'test', 'measure', 'jitter', 'loss'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/ping/PingTool'),
  },
  {
    id: 'tcp-tester', title: 'TCP Connection Tester', description: 'Test if a host:port is reachable — replaces nc -zv host port or telnet host port',
    category: 'networking', keywords: ['tcp', 'port', 'connection', 'test', 'reachable', 'nc', 'telnet', 'firewall'],
    inputKind: 'text', outputKind: 'mixed', defaultOptions: {},
    load: () => import('./networking/tcp-test/TcpTestTool'),
  },

  // ─── FORMATTERS ──────────────────────────────────────────────
  {
    id: 'json-format', title: 'JSON Format / Validate', description: 'Format, validate, minify and sort-keys JSON',
    category: 'formatters', keywords: ['json', 'format', 'validate', 'beautify', 'minify', 'lint'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { indent: 2, sortKeys: false, mode: 'beautify' },
    load: () => import('./formatters/json/JsonFormatterTool'),
  },
  {
    id: 'html-format', title: 'HTML Beautify / Minify', description: 'Beautify or minify HTML markup',
    category: 'formatters', keywords: ['html', 'format', 'beautify', 'minify'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify', indent: 2 },
    load: () => import('./formatters/html/HtmlFormatterTool'),
  },
  {
    id: 'css-format', title: 'CSS Beautify / Minify', description: 'Beautify or minify CSS stylesheets',
    category: 'formatters', keywords: ['css', 'format', 'beautify', 'minify'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify' },
    load: () => import('./formatters/css/CssFormatterTool'),
  },
  {
    id: 'js-format', title: 'JavaScript Beautify / Minify', description: 'Format or minify JavaScript and TypeScript code',
    category: 'formatters', keywords: ['js', 'javascript', 'typescript', 'ts', 'format', 'beautify', 'minify'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify', semi: true, singleQuote: true },
    load: () => import('./formatters/js/JsFormatterTool'),
  },
  {
    id: 'xml-format', title: 'XML Beautify / Minify', description: 'Format or minify XML documents',
    category: 'formatters', keywords: ['xml', 'format', 'beautify', 'minify', 'xslt'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify', indent: 2 },
    load: () => import('./formatters/xml/XmlFormatterTool'),
  },
  {
    id: 'sql-format', title: 'SQL Formatter', description: 'Format SQL queries with configurable style',
    category: 'formatters', keywords: ['sql', 'query', 'format', 'beautify', 'database'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { dialect: 'sql', indent: 2 },
    load: () => import('./formatters/sql/SqlFormatterTool'),
  },
  {
    id: 'less-format', title: 'LESS Beautify / Minify', description: 'Format or minify LESS stylesheets',
    category: 'formatters', keywords: ['less', 'css', 'format', 'beautify', 'minify'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify' },
    load: () => import('./formatters/less/LessFormatterTool'),
  },
  {
    id: 'scss-format', title: 'SCSS Beautify / Minify', description: 'Format or minify SCSS/Sass stylesheets',
    category: 'formatters', keywords: ['scss', 'sass', 'css', 'format', 'beautify', 'minify'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify' },
    load: () => import('./formatters/scss/ScssFormatterTool'),
  },
  {
    id: 'erb-format', title: 'ERB Beautify / Minify', description: 'Format or minify ERB (Embedded Ruby) templates',
    category: 'formatters', keywords: ['erb', 'ruby', 'rails', 'format', 'beautify', 'minify', 'template'],
    inputKind: 'text', outputKind: 'text', defaultOptions: { mode: 'beautify' },
    load: () => import('./formatters/erb/ErbFormatterTool'),
  },
];

export const toolRegistry = new Map(tools.map((t) => [t.id, t]));

export const toolsByCategory = tools.reduce(
  (acc, tool) => {
    (acc[tool.category] ??= []).push(tool);
    return acc;
  },
  {} as Record<string, ToolDefinition[]>
);

export const categoryMeta: Record<string, { label: string; icon: string }> = {
  generators:  { label: 'Generators & Encoders',   icon: 'Zap' },
  converters:  { label: 'Converters & Parsers',    icon: 'ArrowLeftRight' },
  inspect:     { label: 'Inspect & Preview',        icon: 'Search' },
  formatters:  { label: 'Format & Beautify',        icon: 'Code2' },
  devops:      { label: 'DevOps & Infrastructure',  icon: 'Server' },
  networking:  { label: 'Networking & Security',    icon: 'Network' },
};
