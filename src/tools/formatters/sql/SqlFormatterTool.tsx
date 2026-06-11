import TwoColTool from '../../../components/ui/TwoColTool';
import { format } from 'sql-formatter';

const DIALECTS = ['sql', 'mysql', 'postgresql', 'sqlite', 'transactsql', 'mariadb', 'bigquery', 'redshift', 'snowflake'] as const;
type Dialect = typeof DIALECTS[number];

export default function SqlFormatterTool() {
  return (
    <TwoColTool
      title="SQL Formatter"
      description="Format SQL queries with dialect-specific syntax"
      inputLang="sql"
      outputLang="sql"
      outputFilename="query.sql"
      options={[
        {
          id: 'dialect',
          label: 'Dialect',
          type: 'select',
          default: 'sql',
          options: DIALECTS.map((d) => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: d })),
        },
        { id: 'tabWidth', label: 'Tab width', type: 'select', default: '2', options: [{ label: '2', value: '2' }, { label: '4', value: '4' }] },
        { id: 'keywordCase', label: 'Keywords', type: 'select', default: 'upper', options: [{ label: 'UPPER', value: 'upper' }, { label: 'lower', value: 'lower' }, { label: 'preserve', value: 'preserve' }] },
      ]}
      transform={(input, opts) => {
        if (!input.trim()) return { output: '' };
        try {
          const output = format(input, {
            language: String(opts.dialect) as Dialect,
            tabWidth: parseInt(String(opts.tabWidth)),
            keywordCase: String(opts.keywordCase) as 'upper' | 'lower' | 'preserve',
          });
          return { output };
        } catch (e) {
          return { output: '', error: String(e) };
        }
      }}
    />
  );
}
