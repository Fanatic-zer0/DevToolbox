import type { DetectionInput, DetectionResult, DetectionSignal, ToolDefinition } from '../tools/types';

type Detector = {
  toolId: string;
  detect: (input: DetectionInput) => DetectionSignal;
};

const detectors: Detector[] = [
  {
    toolId: 'jwt-debugger',
    detect: ({ text }) => {
      const trimmed = text.trim();
      const parts = trimmed.split('.');
      if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9\-_]+$/.test(p))) {
        try {
          JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
          return { confidence: 0.95, reason: 'Looks like a JWT (three Base64URL segments)' };
        } catch {
          /* fall through */
        }
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'pgp-tool',
    detect: ({ text }) => {
      const t = text.trim();
      if (t.startsWith('-----BEGIN PGP')) return { confidence: 0.99, reason: 'PGP armored block detected' };
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'certificate-decoder',
    detect: ({ text }) => {
      const t = text.trim();
      if (t.startsWith('-----BEGIN CERTIFICATE-----')) return { confidence: 0.97, reason: 'PEM certificate detected' };
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'json-format',
    detect: ({ text }) => {
      const trimmed = text.trim();
      if (!trimmed) return { confidence: 0, reason: '' };
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed);
          return { confidence: 0.85, reason: 'Valid JSON detected' };
        } catch {
          return { confidence: 0.4, reason: 'Looks like JSON but has errors' };
        }
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'yaml-json',
    detect: ({ text }) => {
      const t = text.trim();
      if (/^[a-zA-Z_]\w*:\s/m.test(t) && !t.startsWith('{')) {
        return { confidence: 0.6, reason: 'Looks like YAML' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'url-parser',
    detect: ({ text }) => {
      const t = text.trim();
      try {
        const u = new URL(t);
        if (u.search) return { confidence: 0.9, reason: 'URL with query parameters' };
        return { confidence: 0.6, reason: 'Valid URL' };
      } catch {
        return { confidence: 0, reason: '' };
      }
    },
  },
  {
    toolId: 'url-encode',
    detect: ({ text }) => {
      const t = text.trim();
      if (/%[0-9A-Fa-f]{2}/.test(t)) return { confidence: 0.8, reason: 'URL-encoded string detected' };
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'base64-string',
    detect: ({ text }) => {
      const t = text.trim().replace(/\s/g, '');
      if (/^[A-Za-z0-9+/]+=*$/.test(t) && t.length % 4 === 0 && t.length > 8) {
        return { confidence: 0.65, reason: 'Looks like Base64' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'hex-ascii',
    detect: ({ text }) => {
      const t = text.trim().replace(/\s/g, '');
      if (/^[0-9A-Fa-f]+$/.test(t) && t.length % 2 === 0 && t.length > 4) {
        return { confidence: 0.7, reason: 'Even-length hexadecimal string' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'unix-time',
    detect: ({ text }) => {
      const t = text.trim();
      if (/^\d{10}$/.test(t) || /^\d{13}$/.test(t)) {
        const n = parseInt(t, 10);
        const ms = t.length === 13 ? n : n * 1000;
        const d = new Date(ms);
        if (d.getFullYear() >= 2000 && d.getFullYear() <= 2099) {
          return { confidence: 0.85, reason: 'Unix timestamp in plausible range' };
        }
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'color-converter',
    detect: ({ text }) => {
      const t = text.trim();
      if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(t)) {
        return { confidence: 0.9, reason: 'Hex color code' };
      }
      if (/^rgb(a)?\(/.test(t) || /^hsl(a)?\(/.test(t)) {
        return { confidence: 0.85, reason: 'CSS color function' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'cron-parser',
    detect: ({ text }) => {
      const parts = text.trim().split(/\s+/);
      if (parts.length === 5 || parts.length === 6) {
        const cronChars = /^[0-9*,\-/LWHM#?]+$/i;
        if (parts.every((p) => cronChars.test(p))) {
          return { confidence: 0.7, reason: 'Looks like a cron expression' };
        }
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'uuid-ulid',
    detect: ({ text }) => {
      const t = text.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
        return { confidence: 0.95, reason: 'UUID detected' };
      }
      if (/^[0-9A-Z]{26}$/.test(t)) {
        return { confidence: 0.85, reason: 'ULID detected' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'html-preview',
    detect: ({ text }) => {
      const t = text.trim();
      if (/<(!DOCTYPE|html|head|body|div|span|p|h[1-6])/i.test(t)) {
        return { confidence: 0.75, reason: 'HTML markup detected' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'xml-format',
    detect: ({ text }) => {
      const t = text.trim();
      if (t.startsWith('<') && t.endsWith('>') && !/<(!DOCTYPE|html)/i.test(t)) {
        return { confidence: 0.7, reason: 'Looks like XML' };
      }
      return { confidence: 0, reason: '' };
    },
  },
  {
    toolId: 'markdown-preview',
    detect: ({ text }) => {
      const t = text.trim();
      if (/^#{1,6}\s|^\*{1,2}[^*]+\*{1,2}|^\s*[-*+]\s|^```/.test(t)) {
        return { confidence: 0.65, reason: 'Markdown formatting detected' };
      }
      return { confidence: 0, reason: '' };
    },
  },
];

export function detectTools(
  input: DetectionInput,
  registry: Map<string, ToolDefinition>,
  recentToolIds: string[] = []
): DetectionResult[] {
  const candidates: DetectionResult[] = [];

  for (const detector of detectors) {
    const tool = registry.get(detector.toolId);
    if (!tool) continue;
    try {
      const signal = detector.detect(input);
      if (signal.confidence > 0) {
        const recentBoost = recentToolIds.includes(detector.toolId) ? 0.05 : 0;
        candidates.push({
          toolId: detector.toolId,
          tool,
          confidence: Math.min(1, signal.confidence + recentBoost),
          reason: signal.reason,
        });
      }
    } catch {
      continue;
    }
  }

  return candidates
    .filter((r) => r.confidence >= 0.35)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}
