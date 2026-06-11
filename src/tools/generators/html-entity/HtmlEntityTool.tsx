import TwoColTool from '../../../components/ui/TwoColTool';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  '\u00A9': '&copy;', '\u00AE': '&reg;', '\u2122': '&trade;', '\u20AC': '&euro;',
  '\u00A3': '&pound;', '\u00A5': '&yen;', '\u00A2': '&cent;', '\u00B0': '&deg;',
  '\u00B1': '&plusmn;', '\u00D7': '&times;', '\u00F7': '&divide;', '\u2192': '&rarr;',
  '\u2190': '&larr;', '\u2191': '&uarr;', '\u2193': '&darr;', '\u2194': '&harr;',
  '\u2026': '&hellip;', '\u2014': '&mdash;', '\u2013': '&ndash;', '\u201C': '&ldquo;',
  '\u201D': '&rdquo;', '\u2018': '&lsquo;', '\u2019': '&rsquo;',
};

const ENTITY_MAP = Object.fromEntries(Object.entries(HTML_ENTITIES).map(([k, v]) => [v, k]));

function encodeEntities(input: string): string {
  return input.replace(/[&<>"'\u00A9\u00AE\u2122\u20AC\u00A3\u00A5\u00A2\u00B0\u00B1\u00D7\u00F7\u2192\u2190\u2191\u2193\u2194\u2026\u2014\u2013\u201C\u201D\u2018\u2019]/g, (c) => HTML_ENTITIES[c] ?? c);
}

function decodeEntities(input: string): string {
  return input
    .replace(/&[a-zA-Z]+;/g, (e) => ENTITY_MAP[e] ?? e)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export default function HtmlEntityTool() {
  return (
    <TwoColTool
      title="HTML Entity Encode / Decode"
      description="Encode special characters to HTML entities or decode them back"
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
      ]}
      transform={(input, opts) => {
        if (!input) return { output: '' };
        return { output: opts.mode === 'encode' ? encodeEntities(input) : decodeEntities(input) };
      }}
    />
  );
}
