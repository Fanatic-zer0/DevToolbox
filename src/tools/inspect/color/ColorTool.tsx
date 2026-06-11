import { useState } from 'react';

interface ColorValues {
  hex: string;
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  a: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16),
    a: m[4] ? parseInt(m[4], 16) / 255 : 1,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function parseColor(input: string): ColorValues | null {
  const s = input.trim();
  // hex
  const rgb = hexToRgb(s);
  if (rgb) {
    const { r, g, b, a } = rgb;
    const hsl = rgbToHsl(r, g, b);
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    return { hex, r, g, b, a, ...hsl };
  }
  // rgb/rgba
  const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(s);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]), g = parseInt(rgbMatch[2]), b = parseInt(rgbMatch[3]);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    const hsl = rgbToHsl(r, g, b);
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    return { hex, r, g, b, a, ...hsl };
  }
  // hsl/hsla
  const hslMatch = /hsla?\((\d+),\s*(\d+)%?,\s*(\d+)%?(?:,\s*([\d.]+))?\)/.exec(s);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]), sl = parseInt(hslMatch[2]), l = parseInt(hslMatch[3]);
    const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
    // hsl to rgb
    const c = (1 - Math.abs(2 * l / 100 - 1)) * sl / 100;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m2 = l / 100 - c / 2;
    let r2 = 0, g2 = 0, b2 = 0;
    if (h < 60) { r2 = c; g2 = x; }
    else if (h < 120) { r2 = x; g2 = c; }
    else if (h < 180) { g2 = c; b2 = x; }
    else if (h < 240) { g2 = x; b2 = c; }
    else if (h < 300) { r2 = x; b2 = c; }
    else { r2 = c; b2 = x; }
    const r = Math.round((r2 + m2) * 255), g = Math.round((g2 + m2) * 255), b = Math.round((b2 + m2) * 255);
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    return { hex, r, g, b, a, h, s: sl, l };
  }
  return null;
}

export default function ColorTool() {
  const [input, setInput] = useState('#6366f1');
  const color = parseColor(input);

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Color Converter</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Convert between HEX, RGB, and HSL color formats</p>
      </div>
      <div className="flex-1 overflow-auto p-4 max-w-lg space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Color</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              className="rounded border cursor-pointer"
              style={{ width: 40, height: 40, padding: 2, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
              value={color?.hex ?? '#6366f1'}
              onChange={(e) => setInput(e.target.value)}
            />
            <input
              className="input-base font-mono flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="#rrggbb or rgb() or hsl()"
            />
          </div>
        </div>

        {color && (
          <>
            <div
              className="w-full rounded-xl shadow-inner"
              style={{ height: 100, background: `hsl(${color.h}, ${color.s}%, ${color.l}%)`, border: '1px solid var(--border)' }}
            />
            <div className="space-y-2">
              {[
                { label: 'HEX', value: color.hex.toUpperCase() },
                { label: 'RGB', value: `rgb(${color.r}, ${color.g}, ${color.b})` },
                { label: 'RGBA', value: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a.toFixed(2)})` },
                { label: 'HSL', value: `hsl(${color.h}, ${color.s}%, ${color.l}%)` },
                { label: 'HSLA', value: `hsla(${color.h}, ${color.s}%, ${color.l}%, ${color.a.toFixed(2)})` },
                { label: 'CSS variable', value: `--color: ${color.hex};` },
                { label: 'Tailwind-like', value: `hsl(${color.h} ${color.s}% ${color.l}%)` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{label}</span>
                  <span className="font-mono text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(value)}>Copy</button>
                </div>
              ))}
            </div>
          </>
        )}
        {!color && input && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>Cannot parse color. Try #rrggbb, rgb(r,g,b), or hsl(h,s%,l%)</p>
        )}
      </div>
    </div>
  );
}
