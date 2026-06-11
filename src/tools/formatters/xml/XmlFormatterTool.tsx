import TwoColTool from '../../../components/ui/TwoColTool';

function formatXml(input: string, indent: number | string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(err.textContent ?? 'XML parse error');

  const pad = typeof indent === 'number' ? ' '.repeat(indent) : '\t';

  function serialize(node: Node, depth: number): string {
    const pfx = pad.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim() ?? '';
      return t ? pfx + t : '';
    }
    if (node.nodeType === Node.COMMENT_NODE) return `${pfx}<!--${node.textContent}-->`;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = el.tagName;
    const attrs = Array.from(el.attributes).map((a) => ` ${a.name}="${a.value}"`).join('');
    const children = Array.from(el.childNodes)
      .map((c) => serialize(c, depth + 1))
      .filter(Boolean);

    if (children.length === 0) return `${pfx}<${tag}${attrs} />`;
    if (children.length === 1 && !children[0].includes('\n')) {
      return `${pfx}<${tag}${attrs}>${children[0].trim()}</${tag}>`;
    }
    return `${pfx}<${tag}${attrs}>\n${children.join('\n')}\n${pfx}</${tag}>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(doc.documentElement, 0)}`;
}

export default function XmlFormatterTool() {
  return (
    <TwoColTool
      title="XML Formatter"
      description="Pretty-print and minify XML"
      inputLang="xml"
      outputLang="xml"
      outputFilename="output.xml"
      options={[
        { id: 'indent', label: 'Indent', type: 'select', default: '2', options: [{ label: '2 spaces', value: '2' }, { label: '4 spaces', value: '4' }, { label: 'Tab', value: 'tab' }] },
        { id: 'minify', label: 'Minify', type: 'toggle', default: false },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          if (opts.minify) {
            return { output: input.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim() };
          }
          const indentVal = opts.indent === 'tab' ? '\t' : parseInt(String(opts.indent));
          return { output: formatXml(input, indentVal) };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
