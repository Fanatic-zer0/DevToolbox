import TwoColTool from '../../../components/ui/TwoColTool';

/** Naive ERB formatter: beautify HTML while preserving ERB tags */
function formatErb(input: string, indent: number): string {
  // Replace ERB tags with placeholders
  const erbTags: string[] = [];
  let src = input.replace(/<%[\s\S]*?%>/g, (tag) => {
    erbTags.push(tag);
    return `__ERB_${erbTags.length - 1}__`;
  });

  // Minimal HTML indent
  const pad = ' '.repeat(indent);
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  let depth = 0;
  const result: string[] = [];
  for (const line of lines) {
    // Decrease depth for closing tags
    if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
    result.push(pad.repeat(depth) + line);
    // Increase depth after opening tags (not self-closing)
    if (/^<[a-zA-Z][^>]*>$/.test(line) && !/\/>$/.test(line) && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i.test(line)) {
      depth++;
    }
  }

  // Restore ERB tags
  return result.join('\n').replace(/__ERB_(\d+)__/g, (_, i) => erbTags[parseInt(i)]);
}

function minifyErb(input: string): string {
  return input.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
}

export default function ErbFormatterTool() {
  return (
    <TwoColTool
      title="ERB Formatter"
      description="Beautify or minify ERB (Embedded Ruby) templates"
      inputLang="html"
      outputLang="html"
      outputFilename="template.html.erb"
      options={[
        { id: 'indent', label: 'Indent', type: 'select', default: '2', options: [{ label: '2 spaces', value: '2' }, { label: '4 spaces', value: '4' }] },
        { id: 'minify', label: 'Minify', type: 'toggle', default: false },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          if (opts.minify) return { output: minifyErb(input) };
          return { output: formatErb(input, parseInt(String(opts.indent))) };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
