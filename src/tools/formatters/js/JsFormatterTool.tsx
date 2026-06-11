import TwoColTool from '../../../components/ui/TwoColTool';
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/plugins/babel';
import parserTypescript from 'prettier/plugins/typescript';
import parserEstree from 'prettier/plugins/estree';

export default function JsFormatterTool() {
  return (
    <TwoColTool
      title="JS / TS Formatter"
      description="Format JavaScript and TypeScript using Prettier"
      inputLang="javascript"
      outputLang="javascript"
      outputFilename="output.js"
      options={[
        { id: 'parser', label: 'Parser', type: 'select', default: 'babel', options: [{ label: 'JavaScript', value: 'babel' }, { label: 'TypeScript', value: 'typescript' }] },
        { id: 'singleQuote', label: 'Single quotes', type: 'toggle', default: true },
        { id: 'semi', label: 'Semicolons', type: 'toggle', default: true },
        { id: 'trailingComma', label: 'Trailing comma', type: 'select', default: 'all', options: [{ label: 'None', value: 'none' }, { label: 'ES5', value: 'es5' }, { label: 'All', value: 'all' }] },
      ]}
      transformAsync={async (input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const output = await prettier.format(input, {
            parser: String(opts.parser),
            plugins: [parserBabel, parserTypescript, parserEstree],
            singleQuote: Boolean(opts.singleQuote),
            semi: Boolean(opts.semi),
            trailingComma: opts.trailingComma as 'none' | 'es5' | 'all',
          });
          return { output };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
