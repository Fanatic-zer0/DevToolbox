# DevToolbox

A fast, offline-first developer utility app with 48+ tools. Runs entirely in the browser — no data ever leaves your machine. Available as a **web app** or a native **desktop app** (macOS, Windows, Linux) via Tauri.

---

## Features

- **Offline-first** — everything runs locally, no internet required after first load
- **Dark / light theme** — persists across sessions
- **Pinned tools & recents** — quick access to your most-used tools
- **Global search** — fuzzy-search across all 48+ tools
- **Native desktop app** — Tauri build produces a ~5 MB binary (no Chromium)
- **50+ keyboard-friendly UIs** — CodeMirror editors, resizable panels, copy/download buttons throughout

---

## Tool Categories

### Generators & Encoders (10 tools)
| Tool | Description |
|------|-------------|
| UUID / ULID Generator | Generate RFC-4122 UUIDs (v1/v4/v5) and ULIDs |
| Hash Generator | MD5, SHA-1, SHA-256, SHA-512, HMAC |
| Base64 String | Encode / decode Base64 strings |
| Base64 Image | Encode images to Base64 data URIs |
| URL Encode / Decode | Percent-encode and decode URLs |
| HTML Entity Encoder | Encode / decode HTML entities |
| Backslash Escape | Escape and unescape backslash sequences |
| Lorem Ipsum | Generate placeholder text |
| QR Code | Generate QR codes from any text or URL |
| Random String | Generate cryptographically-random strings with custom alphabets |

### Converters & Parsers (13 tools)
| Tool | Description |
|------|-------------|
| YAML ↔ JSON | Convert between YAML and JSON |
| JSON → Code | Generate TypeScript, Python, Go, Rust types from JSON |
| JSON ↔ CSV | Convert between JSON arrays and CSV |
| cURL to Fetch | Convert cURL commands to JavaScript `fetch()` |
| Unix Timestamp | Convert between Unix timestamps and human-readable dates |
| URL Parser | Parse and inspect URL components |
| Number Base | Convert between binary, octal, decimal, and hex |
| String Case | Convert between camelCase, snake_case, PascalCase, kebab-case, etc. |
| HTML → JSX | Convert raw HTML to JSX-compatible markup |
| SVG to CSS | Convert SVG to CSS `background-image` data URI |
| Hex ↔ ASCII | Convert between hexadecimal and ASCII text |
| PHP Serialized → JSON | Parse PHP serialized strings to JSON |
| Line Sort / Dedupe | Sort, deduplicate, reverse, and shuffle lines |

### Inspect & Preview (10 tools)
| Tool | Description |
|------|-------------|
| Certificate Tools | Decode X.509 certs; verify cert↔key, cert↔CSR, and chain; generate CSR/cert (self-signed, Root CA, Intermediate CA, CA-signed); export to PFX/P12 |
| JWT Decoder | Decode and verify JSON Web Tokens |
| PGP / GPG Tool | Generate keys, encrypt, decrypt, sign, and verify PGP messages |
| Diff Viewer | Side-by-side text diff with unified output |
| RegExp Tester | Test regular expressions with live match highlighting |
| Cron Expression | Parse and describe cron schedules (human-readable) |
| Markdown Preview | Live Markdown-to-HTML preview |
| HTML Preview | Sandboxed live HTML/CSS/JS preview |
| Color Picker | Convert between HEX, RGB, HSL, and HSV |
| String Inspector | Count characters, bytes, words; detect encoding |

### Format & Beautify (9 tools)
| Tool | Description |
|------|-------------|
| JSON Format | Format, validate, minify, and sort-keys JSON |
| HTML Beautify / Minify | Prettier-powered HTML formatter |
| CSS Beautify / Minify | Prettier-powered CSS formatter |
| JavaScript / TypeScript | Prettier-powered JS/TS formatter |
| SQL Formatter | Format SQL with configurable dialect |
| XML Formatter | Indent and validate XML |
| SCSS Formatter | Prettier-powered SCSS formatter |
| Less Formatter | Prettier-powered Less formatter |
| ERB Formatter | Format Ruby ERB templates |

### DevOps & Infrastructure (3 tools)
| Tool | Description |
|------|-------------|
| K8s Manifest Validator | Lint Kubernetes YAML for required fields and best-practice checks (resources, probes, labels, `:latest` tags) — supports 10+ resource kinds |
| K8s YAML Generator | Generate production-ready boilerplate for Deployments, Services, Ingress, HPA, CronJob, PVC, ServiceAccount, Namespace, and more |
| kubectl Command Builder | Interactively build kubectl commands — `get`, `describe`, `logs`, `exec`, `scale`, `rollout`, `port-forward`, `drain`, `taint`, and more |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS v3 (CSS variables for theming) |
| State | Zustand 4 + `persist` middleware |
| Routing | React Router v6 (HashRouter) |
| Code Editors | CodeMirror 6 |
| Icons | Lucide React |
| Desktop | Tauri 2 (Rust backend, OS webview) |
| Crypto / Certs | node-forge |
| PGP | openpgp.js 5 |
| YAML | js-yaml 4 |
| Formatting | Prettier 3 |

---

## Getting Started

### Prerequisites
- Node.js 18+
- (Desktop only) Rust via [rustup](https://rustup.rs) or Homebrew (`brew install rust`)

### Web app (browser)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173

# Production build (output: dist/)
npm run build

# Preview production build
npm run preview
```

### Desktop app (Tauri)

```bash
# Dev mode — opens a native window with hot reload
npm run tauri:dev

# Build distributable
npm run tauri:build
```

After `tauri:build`:
- **macOS** → `src-tauri/target/release/bundle/macos/DevToolbox.app` + `.dmg`
- **Windows** → `src-tauri/target/release/bundle/msi/DevToolbox_1.0.0_x64.msi`
- **Linux** → `src-tauri/target/release/bundle/deb/` or `.AppImage`

> First `tauri:dev` or `tauri:build` downloads and compiles Rust dependencies (~2–3 min). Subsequent runs are fast (~10 s) thanks to incremental compilation.

---

## Project Structure

```
devtoolbox/
├── src/
│   ├── components/
│   │   └── layout/          # Sidebar, TopBar, shell components
│   ├── pages/
│   │   ├── HomePage.tsx     # Tool grid landing page
│   │   └── ToolPage.tsx     # Individual tool wrapper
│   ├── tools/
│   │   ├── registry.ts      # Central tool registry (lazy imports)
│   │   ├── types.ts         # ToolDefinition, ToolCategory types
│   │   ├── generators/      # 10 generator tools
│   │   ├── converters/      # 13 converter tools
│   │   ├── inspect/         # 10 inspect/preview tools
│   │   ├── formatters/      # 9 formatter tools
│   │   └── devops/          # 3 DevOps tools
│   ├── store/               # Zustand stores (app, toolPrefs, pgpKeys)
│   └── lib/                 # Utilities (cn, etc.)
├── src-tauri/               # Tauri desktop app (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   └── tauri.conf.json
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |
| `npm run tauri:dev` | Launch native desktop app with hot reload |
| `npm run tauri:build` | Build distributable desktop installers |

---

## Privacy

All processing happens **entirely in your browser or desktop process**. No telemetry, no analytics, no external requests. Sensitive data (private keys, JWTs, secrets) never leaves your device.
