import { useState } from 'react';
import { Copy } from 'lucide-react';

type Verb = 'get' | 'describe' | 'apply' | 'delete' | 'logs' | 'exec' | 'scale' | 'rollout' | 'port-forward' | 'top' | 'label' | 'annotate' | 'cordon' | 'uncordon' | 'drain' | 'taint';
type ResourceType = 'pod' | 'deployment' | 'service' | 'node' | 'namespace' | 'configmap' | 'secret' | 'ingress' | 'pvc' | 'statefulset' | 'daemonset' | 'job' | 'cronjob' | 'hpa' | 'replicaset';

interface CmdConfig {
  verb: Verb;
  resource: ResourceType;
  name: string;
  namespace: string;
  allNamespaces: boolean;
  output: string;
  // logs
  container: string;
  follow: boolean;
  tail: string;
  since: string;
  // exec
  execCmd: string;
  // scale
  scaleReplicas: string;
  // rollout sub
  rolloutAction: string;
  // port-forward
  localPort: string;
  remotePort: string;
  // label/annotate
  keyValue: string;
  // drain
  drainForce: boolean;
  drainIgnoreDaemonsets: boolean;
  // selector
  selector: string;
  // dry-run
  dryRun: boolean;
}

function buildCmd(c: CmdConfig): string {
  const parts = ['kubectl'];

  // Special verbs
  if (c.verb === 'rollout') {
    parts.push('rollout', c.rolloutAction || 'status', `deployment/${c.name || '<name>'}`);
    if (c.namespace) parts.push('-n', c.namespace);
    return parts.join(' ');
  }
  if (c.verb === 'top') {
    parts.push('top', c.resource);
    if (c.name) parts.push(c.name);
    if (c.namespace) parts.push('-n', c.namespace);
    else if (c.allNamespaces) parts.push('-A');
    return parts.join(' ');
  }
  if (c.verb === 'exec') {
    parts.push('exec', '-it', c.name || '<pod-name>');
    if (c.namespace) parts.push('-n', c.namespace);
    if (c.container) parts.push('-c', c.container);
    parts.push('--', c.execCmd || 'sh');
    return parts.join(' ');
  }
  if (c.verb === 'logs') {
    parts.push('logs', c.name || '<pod-name>');
    if (c.container) parts.push('-c', c.container);
    if (c.namespace) parts.push('-n', c.namespace);
    if (c.follow) parts.push('-f');
    if (c.tail) parts.push('--tail', c.tail);
    if (c.since) parts.push('--since', c.since);
    if (c.selector) parts.push('-l', c.selector);
    return parts.join(' ');
  }
  if (c.verb === 'scale') {
    parts.push('scale', `${c.resource}/${c.name || '<name>'}`, `--replicas=${c.scaleReplicas || '2'}`);
    if (c.namespace) parts.push('-n', c.namespace);
    return parts.join(' ');
  }
  if (c.verb === 'port-forward') {
    parts.push('port-forward', `${c.resource}/${c.name || '<name>'}`, `${c.localPort || '8080'}:${c.remotePort || '8080'}`);
    if (c.namespace) parts.push('-n', c.namespace);
    return parts.join(' ');
  }
  if (c.verb === 'label') {
    parts.push('label', c.resource, c.name || '<name>', c.keyValue || 'key=value');
    if (c.namespace) parts.push('-n', c.namespace);
    return parts.join(' ');
  }
  if (c.verb === 'annotate') {
    parts.push('annotate', c.resource, c.name || '<name>', c.keyValue || 'key=value');
    if (c.namespace) parts.push('-n', c.namespace);
    return parts.join(' ');
  }
  if (c.verb === 'cordon' || c.verb === 'uncordon') {
    parts.push(c.verb, c.name || '<node-name>');
    return parts.join(' ');
  }
  if (c.verb === 'drain') {
    parts.push('drain', c.name || '<node-name>');
    if (c.drainForce) parts.push('--force');
    if (c.drainIgnoreDaemonsets) parts.push('--ignore-daemonsets');
    parts.push('--delete-emptydir-data');
    return parts.join(' ');
  }
  if (c.verb === 'taint') {
    parts.push('taint', 'node', c.name || '<node-name>', c.keyValue || 'key=value:NoSchedule');
    return parts.join(' ');
  }

  // Standard verbs: get / describe / apply / delete
  parts.push(c.verb);
  if (c.verb !== 'apply') {
    if (c.name) parts.push(`${c.resource}/${c.name}`);
    else parts.push(c.resource);
  }
  if (c.selector) parts.push('-l', c.selector);
  if (c.allNamespaces) parts.push('-A');
  else if (c.namespace) parts.push('-n', c.namespace);
  if (c.verb === 'apply') parts.push('-f', '<manifest.yaml>');
  if (c.output && c.verb !== 'delete' && c.verb !== 'apply') parts.push('-o', c.output);
  if (c.dryRun && (c.verb === 'apply' || c.verb === 'delete')) parts.push('--dry-run=client');
  return parts.join(' ');
}

const VERBS: { id: Verb; label: string }[] = [
  { id: 'get', label: 'get' },
  { id: 'describe', label: 'describe' },
  { id: 'apply', label: 'apply' },
  { id: 'delete', label: 'delete' },
  { id: 'logs', label: 'logs' },
  { id: 'exec', label: 'exec' },
  { id: 'scale', label: 'scale' },
  { id: 'rollout', label: 'rollout' },
  { id: 'port-forward', label: 'port-forward' },
  { id: 'top', label: 'top' },
  { id: 'label', label: 'label' },
  { id: 'annotate', label: 'annotate' },
  { id: 'cordon', label: 'cordon' },
  { id: 'uncordon', label: 'uncordon' },
  { id: 'drain', label: 'drain' },
  { id: 'taint', label: 'taint' },
];

const RESOURCE_TYPES: ResourceType[] = ['pod', 'deployment', 'service', 'node', 'namespace', 'configmap', 'secret', 'ingress', 'pvc', 'statefulset', 'daemonset', 'job', 'cronjob', 'hpa', 'replicaset'];

export default function KubectlBuilderTool() {
  const [cfg, setCfg] = useState<CmdConfig>({
    verb: 'get', resource: 'pod', name: '', namespace: '', allNamespaces: false,
    output: '', container: '', follow: false, tail: '100', since: '',
    execCmd: 'sh', scaleReplicas: '2', rolloutAction: 'status',
    localPort: '8080', remotePort: '8080', keyValue: '', drainForce: false,
    drainIgnoreDaemonsets: true, selector: '', dryRun: false,
  });

  const set = (k: keyof CmdConfig, v: unknown) => setCfg((prev) => ({ ...prev, [k]: v }));
  const cmd = buildCmd(cfg);
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const needsName = !['logs'].includes(cfg.verb) || !!cfg.name;
  const isNodeOp = ['cordon', 'drain', 'taint'].includes(cfg.verb);
  const isLogOp = cfg.verb === 'logs';
  const isExecOp = cfg.verb === 'exec';
  const isScaleOp = cfg.verb === 'scale';
  const isRollout = cfg.verb === 'rollout';
  const isPf = cfg.verb === 'port-forward';
  const isLabelAnn = cfg.verb === 'label' || cfg.verb === 'annotate' || cfg.verb === 'taint';
  const isDrain = cfg.verb === 'drain';
  const isStandard = ['get', 'describe', 'apply', 'delete'].includes(cfg.verb);

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>kubectl Builder</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Interactively build kubectl commands with options</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 max-w-2xl space-y-4">
        {/* Verb selector */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Command</label>
          <div className="flex flex-wrap gap-1.5">
            {VERBS.map(({ id, label }) => (
              <button key={id}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors font-mono"
                style={{
                  background: cfg.verb === id ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: cfg.verb === id ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${cfg.verb === id ? 'var(--accent)' : 'var(--border)'}`,
                }}
                onClick={() => set('verb', id)}>{label}</button>
            ))}
          </div>
        </div>

        {/* Resource type */}
        {!isNodeOp && !isRollout && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Resource Type</label>
            <select className="input-base font-mono text-xs" style={{ width: 160 }}
              value={cfg.resource} onChange={(e) => set('resource', e.target.value)}>
              {RESOURCE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Name */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              {isNodeOp ? 'Node Name' : 'Resource Name'} {cfg.verb === 'apply' ? '(unused)' : ''}
            </label>
            <input className="input-base font-mono text-xs" value={cfg.name}
              onChange={(e) => set('name', e.target.value)} placeholder="(all)" />
          </div>
          {/* Namespace */}
          {!isNodeOp && (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Namespace</label>
              <div className="flex gap-2 items-center">
                <input className="input-base font-mono text-xs flex-1" value={cfg.namespace}
                  onChange={(e) => set('namespace', e.target.value)} placeholder="default" disabled={cfg.allNamespaces} />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={cfg.allNamespaces} onChange={(e) => set('allNamespaces', e.target.checked)} /> All
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Output format */}
        {isStandard && cfg.verb !== 'apply' && cfg.verb !== 'delete' && (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Output Format</label>
            <select className="input-base text-xs" style={{ width: 160 }} value={cfg.output} onChange={(e) => set('output', e.target.value)}>
              <option value="">default</option>
              <option value="wide">wide</option>
              <option value="json">json</option>
              <option value="yaml">yaml</option>
              <option value="name">name</option>
              <option value="jsonpath='{.items[*].metadata.name}'">jsonpath (names)</option>
            </select>
          </div>
        )}

        {/* Selector */}
        {(isStandard || isLogOp) && (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Label Selector (-l)</label>
            <input className="input-base font-mono text-xs" value={cfg.selector}
              onChange={(e) => set('selector', e.target.value)} placeholder="app=my-app" />
          </div>
        )}

        {/* Logs options */}
        {isLogOp && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Container (-c)</label>
              <input className="input-base font-mono text-xs" value={cfg.container} onChange={(e) => set('container', e.target.value)} placeholder="(main)" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Tail lines</label>
              <input className="input-base text-xs" type="number" value={cfg.tail} onChange={(e) => set('tail', e.target.value)} style={{ width: 80 }} /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Since</label>
              <input className="input-base text-xs font-mono" value={cfg.since} onChange={(e) => set('since', e.target.value)} placeholder="5m, 1h, 2006-01-02" /></div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={cfg.follow} onChange={(e) => set('follow', e.target.checked)} /> Follow (-f)
              </label>
            </div>
          </div>
        )}

        {/* Exec options */}
        {isExecOp && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Container (-c)</label>
              <input className="input-base font-mono text-xs" value={cfg.container} onChange={(e) => set('container', e.target.value)} placeholder="(main)" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Command</label>
              <input className="input-base font-mono text-xs" value={cfg.execCmd} onChange={(e) => set('execCmd', e.target.value)} placeholder="sh" /></div>
          </div>
        )}

        {/* Scale */}
        {isScaleOp && (
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Replicas</label>
            <input className="input-base" type="number" value={cfg.scaleReplicas} onChange={(e) => set('scaleReplicas', e.target.value)} style={{ width: 80 }} /></div>
        )}

        {/* Rollout */}
        {isRollout && (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Action</label>
            <select className="input-base text-xs" style={{ width: 160 }} value={cfg.rolloutAction} onChange={(e) => set('rolloutAction', e.target.value)}>
              <option value="status">status</option>
              <option value="history">history</option>
              <option value="undo">undo</option>
              <option value="restart">restart</option>
              <option value="pause">pause</option>
              <option value="resume">resume</option>
            </select>
          </div>
        )}

        {/* Port-forward */}
        {isPf && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Local Port</label>
              <input className="input-base" type="number" value={cfg.localPort} onChange={(e) => set('localPort', e.target.value)} /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Remote Port</label>
              <input className="input-base" type="number" value={cfg.remotePort} onChange={(e) => set('remotePort', e.target.value)} /></div>
          </div>
        )}

        {/* Label/Annotate/Taint */}
        {isLabelAnn && (
          <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            {cfg.verb === 'taint' ? 'Taint (key=value:Effect)' : 'Key=Value'}
          </label>
            <input className="input-base font-mono text-xs" value={cfg.keyValue} onChange={(e) => set('keyValue', e.target.value)}
              placeholder={cfg.verb === 'taint' ? 'key=value:NoSchedule' : 'key=value'} /></div>
        )}

        {/* Drain options */}
        {isDrain && (
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={cfg.drainForce} onChange={(e) => set('drainForce', e.target.checked)} /> --force
            </label>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={cfg.drainIgnoreDaemonsets} onChange={(e) => set('drainIgnoreDaemonsets', e.target.checked)} /> --ignore-daemonsets
            </label>
          </div>
        )}

        {/* Dry-run */}
        {(cfg.verb === 'apply' || cfg.verb === 'delete') && (
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={cfg.dryRun} onChange={(e) => set('dryRun', e.target.checked)} /> Dry run (--dry-run=client)
          </label>
        )}

        {/* Output */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>Generated Command</span>
            <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={copy}>
              <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="px-4 py-3 font-mono text-sm whitespace-pre-wrap break-all" style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
            {cmd}
          </pre>
        </div>
      </div>
    </div>
  );
}
