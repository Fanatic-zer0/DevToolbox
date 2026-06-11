import yaml from 'js-yaml';
import TwoColTool from '../../../components/ui/TwoColTool';

export default function YamlJsonTool() {
  return (
    <TwoColTool
      title="YAML ↔ JSON"
      description="Convert between YAML and JSON formats"
      inputLang="text"
      outputLang="json"
      options={[
        {
          id: 'direction',
          label: 'Direction',
          type: 'select',
          default: 'yaml-to-json',
          options: [
            { label: 'YAML → JSON', value: 'yaml-to-json' },
            { label: 'JSON → YAML', value: 'json-to-yaml' },
          ],
        },
        { id: 'indent', label: 'Indent', type: 'number', default: 2 },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const indent = Number(opts.indent) || 2;
          if (opts.direction === 'yaml-to-json') {
            const data = yaml.load(input);
            return { output: JSON.stringify(data, null, indent) };
          } else {
            const data = JSON.parse(input);
            return { output: yaml.dump(data, { indent }) };
          }
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
