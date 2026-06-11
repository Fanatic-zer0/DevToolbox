import TwoColTool from '../../../components/ui/TwoColTool';

function svgToCss(svg: string): string {
  const trimmed = svg.trim();
  const encoded = encodeURIComponent(trimmed).replace(/'/g, '%27').replace(/"/g, '%22');
  const dataUrl = `data:image/svg+xml,${encoded}`;
  return `.icon {\n  background-image: url("${dataUrl}");\n  background-repeat: no-repeat;\n  background-size: contain;\n}`;
}

export default function SvgCssTool() {
  return (
    <TwoColTool
      title="SVG → CSS"
      description="Embed SVG as a CSS background-image data URL"
      inputLang="xml"
      outputLang="css"
      outputFilename="svg-background.css"
      transform={(input) => {
        if (!input.trim()) return { output: '' };
        if (!input.trim().includes('<svg')) return { output: '', error: 'Input does not look like an SVG element' };
        return { output: svgToCss(input) };
      }}
    />
  );
}
