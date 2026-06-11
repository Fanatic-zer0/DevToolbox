import TwoColTool from '../../../components/ui/TwoColTool';

function htmlToJsx(html: string): string {
  return html
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/tabindex=/g, 'tabIndex=')
    .replace(/readonly/g, 'readOnly')
    .replace(/maxlength=/g, 'maxLength=')
    .replace(/cellspacing=/g, 'cellSpacing=')
    .replace(/cellpadding=/g, 'cellPadding=')
    .replace(/rowspan=/g, 'rowSpan=')
    .replace(/colspan=/g, 'colSpan=')
    .replace(/usemap=/g, 'useMap=')
    .replace(/frameborder=/g, 'frameBorder=')
    .replace(/contenteditable=/g, 'contentEditable=')
    .replace(/crossorigin=/g, 'crossOrigin=')
    .replace(/autofocus/g, 'autoFocus')
    .replace(/novalidate/g, 'noValidate')
    .replace(/enctype=/g, 'encType=')
    .replace(/autocomplete=/g, 'autoComplete=')
    .replace(/<!--([\s\S]*?)-->/g, (_, c) => `{/*${c}*/}`)
    // Self-close void elements
    .replace(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([^>]*?)(?<!\/)>/gi,
      (_, tag, attrs) => `<${tag}${attrs} />`);
}

export default function HtmlJsxTool() {
  return (
    <TwoColTool
      title="HTML → JSX"
      description="Convert HTML markup to valid JSX for React"
      inputLang="html"
      outputLang="javascript"
      outputFilename="component.jsx"
      transform={(input) => {
        if (!input.trim()) return { output: '' };
        return { output: htmlToJsx(input) };
      }}
    />
  );
}
