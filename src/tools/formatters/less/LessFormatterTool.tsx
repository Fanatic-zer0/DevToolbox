import TwoColTool from '../../../components/ui/TwoColTool';
import prettier from 'prettier/standalone';
import parserCss from 'prettier/plugins/postcss';

export default function LessFormatterTool() {
  return (
    <TwoColTool
      title="Less Formatter"
      description="Format Less stylesheets using Prettier"
      inputLang="css"
      outputLang="css"
      outputFilename="output.less"
      options={[
        { id: 'singleQuote', label: 'Single quotes', type: 'toggle', default: false },
        { id: 'printWidth', label: 'Print width', type: 'number', default: 80, min: 40, max: 200 },
      ]}
      transformAsync={async (input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const output = await prettier.format(input, {
            parser: 'less',
            plugins: [parserCss],
            singleQuote: Boolean(opts.singleQuote),
            printWidth: Number(opts.printWidth),
          });
          return { output };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
