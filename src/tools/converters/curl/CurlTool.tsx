import TwoColTool from '../../../components/ui/TwoColTool';

interface CurlCommand {
  method: string;
  url: string;
  headers: Record<string, string>;
  data: string | null;
  json: boolean;
}

function parseCurl(input: string): CurlCommand {
  const cmd = input.trim().replace(/\\\n/g, ' ');
  const method = /-X\s+(\w+)/.exec(cmd)?.[1]?.toUpperCase() ?? (cmd.includes('-d') || cmd.includes('--data') ? 'POST' : 'GET');
  const urlMatch = /curl\s+(?:(?:-[^\s]+\s+[^\s]+\s+)*)'?([^'\s]+)'?/.exec(cmd) ??
    /'(https?:\/\/[^']+)'/.exec(cmd) ??
    /"(https?:\/\/[^"]+)"/.exec(cmd);
  const url = urlMatch?.[1] ?? '';
  const headers: Record<string, string> = {};
  const headerRe = /-H\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(cmd)) !== null) {
    const [k, ...v] = m[1].split(':');
    headers[k.trim()] = v.join(':').trim();
  }
  const dataMatch = /(?:-d|--data|--data-raw)\s+['"]([^'"]+)['"]/.exec(cmd);
  const data = dataMatch?.[1] ?? null;
  const json = !!(headers['Content-Type']?.includes('json') || (data && data.trim().startsWith('{')));
  return { method, url, headers, data, json };
}

function toFetch({ method, url, headers, data }: CurlCommand): string {
  const opts: string[] = [`method: '${method}'`];
  if (Object.keys(headers).length) opts.push(`headers: ${JSON.stringify(headers, null, 2)}`);
  if (data) opts.push(`body: \`${data}\``);
  return `const response = await fetch('${url}', {\n  ${opts.join(',\n  ')}\n});\nconst data = await response.json();`;
}

function toAxios({ method, url, headers, data }: CurlCommand): string {
  const m = method.toLowerCase();
  const cfg: string[] = [];
  if (Object.keys(headers).length) cfg.push(`  headers: ${JSON.stringify(headers, null, 4)}`);
  const bodyParam = data ? `, ${data}` : '';
  if (cfg.length) {
    return `const { data } = await axios.${m}('${url}'${bodyParam}, {\n${cfg.join(',\n')}\n});`;
  }
  return `const { data } = await axios.${m}('${url}'${bodyParam});`;
}

function toPython({ method, url, headers, data }: CurlCommand): string {
  const headerStr = JSON.stringify(headers, null, 4);
  const payload = data ? `\ndata = ${data}` : '';
  const dataArg = data ? ', data=data' : '';
  return `import requests\n\nheaders = ${headerStr}${payload}\nresponse = requests.${method.toLowerCase()}('${url}', headers=headers${dataArg})\nprint(response.json())`;
}

function toHTTP({ method, url, headers, data }: CurlCommand): string {
  const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  const body = data ? `\n\n${data}` : '';
  return `${method} ${url.replace(/^https?:\/\/[^/]+/, '')} HTTP/1.1\nHost: ${new URL(url).host}\n${headerLines}${body}`;
}

const TARGETS: Record<string, (c: CurlCommand) => string> = {
  fetch: toFetch,
  axios: toAxios,
  python: toPython,
  http: toHTTP,
};

export default function CurlTool() {
  return (
    <TwoColTool
      title="cURL to Code"
      description="Convert cURL commands to fetch, axios, Python requests, and raw HTTP"
      inputLang="text"
      outputLang="javascript"
      outputFilename="request.js"
      options={[
        {
          id: 'target',
          label: 'Target',
          type: 'select',
          default: 'fetch',
          options: [
            { label: 'fetch (JS)', value: 'fetch' },
            { label: 'axios (JS)', value: 'axios' },
            { label: 'Python requests', value: 'python' },
            { label: 'Raw HTTP', value: 'http' },
          ],
        },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        if (!input.trim().startsWith('curl')) return { output: '', error: 'Input should start with "curl"' };
        try {
          const parsed = parseCurl(input);
          const fn = TARGETS[String(opts.target)] ?? toFetch;
          return { output: fn(parsed) };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
