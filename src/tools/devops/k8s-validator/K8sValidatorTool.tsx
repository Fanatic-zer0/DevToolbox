import { useState } from 'react';
import * as yaml from 'js-yaml';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface LintResult {
  kind: string;
  apiVersion: string;
  name: string;
  issues: { level: 'error' | 'warn'; message: string }[];
}

// Required fields per kind
const REQUIRED: Record<string, { path: string; level: 'error' | 'warn' }[]> = {
  '*': [
    { path: 'apiVersion', level: 'error' },
    { path: 'kind', level: 'error' },
    { path: 'metadata.name', level: 'error' },
  ],
  Deployment: [
    { path: 'spec.replicas', level: 'warn' },
    { path: 'spec.selector.matchLabels', level: 'error' },
    { path: 'spec.template.metadata.labels', level: 'error' },
    { path: 'spec.template.spec.containers', level: 'error' },
  ],
  Service: [
    { path: 'spec.selector', level: 'warn' },
    { path: 'spec.ports', level: 'error' },
  ],
  ConfigMap: [{ path: 'data', level: 'warn' }],
  Secret: [
    { path: 'type', level: 'warn' },
    { path: 'data', level: 'warn' },
  ],
  Ingress: [
    { path: 'spec.rules', level: 'error' },
  ],
  StatefulSet: [
    { path: 'spec.selector.matchLabels', level: 'error' },
    { path: 'spec.serviceName', level: 'error' },
    { path: 'spec.template.spec.containers', level: 'error' },
  ],
  DaemonSet: [
    { path: 'spec.selector.matchLabels', level: 'error' },
    { path: 'spec.template.spec.containers', level: 'error' },
  ],
  CronJob: [
    { path: 'spec.schedule', level: 'error' },
    { path: 'spec.jobTemplate', level: 'error' },
  ],
  PersistentVolumeClaim: [
    { path: 'spec.accessModes', level: 'error' },
    { path: 'spec.resources.requests.storage', level: 'error' },
  ],
  HorizontalPodAutoscaler: [
    { path: 'spec.scaleTargetRef', level: 'error' },
    { path: 'spec.maxReplicas', level: 'error' },
  ],
};

// Best practice checks per kind
const BEST_PRACTICE: Record<string, (doc: Record<string, unknown>) => string[]> = {
  Deployment: (doc) => {
    const w: string[] = [];
    const containers = getPath(doc, 'spec.template.spec.containers') as unknown[] | undefined;
    if (Array.isArray(containers)) {
      for (const c of containers as Record<string, unknown>[]) {
        if (!c.resources) w.push(`Container "${c.name ?? '?'}" has no resource requests/limits`);
        if (!c.livenessProbe) w.push(`Container "${c.name ?? '?'}" has no livenessProbe`);
        if (!c.readinessProbe) w.push(`Container "${c.name ?? '?'}" has no readinessProbe`);
        if (c.image && String(c.image).endsWith(':latest')) w.push(`Container "${c.name ?? '?'}" uses :latest tag`);
      }
    }
    if (!getPath(doc, 'metadata.namespace')) w.push('No namespace specified');
    return w;
  },
  '*': (doc) => {
    const w: string[] = [];
    if (!getPath(doc, 'metadata.labels')) w.push('No metadata.labels defined');
    return w;
  },
};

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function lintDoc(doc: Record<string, unknown>): LintResult {
  const kind = String(doc.kind ?? 'Unknown');
  const apiVersion = String(doc.apiVersion ?? '');
  const name = String(getPath(doc, 'metadata.name') ?? '(no name)');
  const issues: { level: 'error' | 'warn'; message: string }[] = [];

  // Required field checks
  const checks = [...(REQUIRED['*'] ?? []), ...(REQUIRED[kind] ?? [])];
  for (const { path, level } of checks) {
    if (getPath(doc, path) === undefined) {
      issues.push({ level, message: `Missing required field: ${path}` });
    }
  }

  // Best practice checks
  const bpFn = BEST_PRACTICE[kind] ?? BEST_PRACTICE['*'];
  for (const msg of bpFn(doc)) issues.push({ level: 'warn', message: msg });

  return { kind, apiVersion, name, issues };
}

function splitYamlDocs(text: string): Record<string, unknown>[] {
  const docs: Record<string, unknown>[] = [];
  for (const part of text.split(/^---$/m)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const parsed = yaml.load(trimmed);
      if (parsed && typeof parsed === 'object') docs.push(parsed as Record<string, unknown>);
    } catch { /* skip */ }
  }
  return docs;
}

const EXAMPLE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:1.0.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi`;

export default function K8sValidatorTool() {
  const [input, setInput] = useState(EXAMPLE);
  const results = (() => {
    if (!input.trim()) return [];
    try { return splitYamlDocs(input).map(lintDoc); } catch { return []; }
  })();

  const totalErrors = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'error').length, 0);
  const totalWarns = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'warn').length, 0);

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>K8s Manifest Validator</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Lint Kubernetes YAML manifests for required fields and best practices</p>
        </div>
        {results.length > 0 && (
          <div className="flex gap-2">
            {totalErrors > 0 && <span className="badge badge-danger">{totalErrors} error{totalErrors > 1 ? 's' : ''}</span>}
            {totalWarns > 0 && <span className="badge badge-warning">{totalWarns} warning{totalWarns > 1 ? 's' : ''}</span>}
            {totalErrors === 0 && totalWarns === 0 && <span className="badge badge-success">All checks passed</span>}
          </div>
        )}
      </div>
      <div className="tool-body">
        <div className="pane">
          <div className="pane-label">YAML Manifest (supports multi-doc with ---)</div>
          <div className="editor-fill">
            <textarea
              className="w-full h-full font-mono text-xs p-3 resize-none outline-none"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: 'none' }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
        <div className="pane-divider" />
        <div className="pane overflow-auto">
          <div className="pane-label">Lint Results</div>
          <div className="flex-1 overflow-auto p-3 space-y-4">
            {results.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paste a Kubernetes YAML manifest to validate.</p>
            )}
            {results.map((r, i) => (
              <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>{r.kind}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.apiVersion}</span>
                  <div className="ml-auto">
                    {r.issues.length === 0
                      ? <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                      : r.issues.some((i) => i.level === 'error')
                        ? <XCircle size={14} style={{ color: 'var(--danger)' }} />
                        : <AlertTriangle size={14} style={{ color: 'var(--warning, #f59e0b)' }} />
                    }
                  </div>
                </div>
                {r.issues.length === 0 ? (
                  <div className="px-3 py-2 text-xs flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                    <CheckCircle size={11} /> No issues found
                  </div>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {r.issues.map((issue, j) => (
                      <li key={j} className="flex items-start gap-2 px-3 py-2">
                        {issue.level === 'error'
                          ? <XCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                          : <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                        }
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
