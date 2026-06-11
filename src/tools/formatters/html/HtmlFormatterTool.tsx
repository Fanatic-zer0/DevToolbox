import TwoColTool from '../../../components/ui/TwoColTool';
import prettier from 'prettier/standalone';
import parserHtml from 'prettier/plugins/html';

export default function HtmlFormatterTool() {
  return (
    <TwoColTool
      title="HTML Formatter"
      description="Format and minify HTML using Prettier"
      inputLang="html"
      outputLang="html"
      outputFilename="output.html"
      options={[
        { id: 'printWidth', label: 'Print width', type: 'number', default: 80, min: 40, max: 200 },
        { id: 'tabWidth', label: 'Tab width', type: 'select', default: '2', options: [{ label: '2', value: '2' }, { label: '4', value: '4' }] },
      ]}
      transformAsync={async (input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const output = await prettier.format(input, {
            parser: 'html',
            plugins: [parserHtml],
            printWidth: Number(opts.printWidth),
            tabWidth: Number(opts.tabWidth),
          });
          return { output };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
