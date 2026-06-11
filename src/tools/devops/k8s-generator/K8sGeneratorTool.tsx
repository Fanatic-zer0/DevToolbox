import { useState } from 'react';
import { Copy } from 'lucide-react';

type ResourceKind = 'Deployment' | 'Service' | 'ConfigMap' | 'Secret' | 'Ingress' | 'HPA' | 'CronJob' | 'PVC' | 'ServiceAccount' | 'Namespace';

interface ResourceConfig {
  kind: ResourceKind;
  name: string;
  namespace: string;
  // kind-specific
  image?: string;
  replicas?: number;
  port?: number;
  serviceType?: string;
  schedule?: string;
  storageSize?: string;
  targetDeployment?: string;
  minReplicas?: number;
  maxReplicas?: number;
  ingressHost?: string;
  ingressPath?: string;
}

function generateYaml(cfg: ResourceConfig): string {
  const { kind, name, namespace } = cfg;
  const ns = namespace || 'default';

  switch (kind) {
    case 'Deployment':
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
spec:
  replicas: ${cfg.replicas ?? 2}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${cfg.image ?? `${name}:latest`}
          ports:
            - containerPort: ${cfg.port ?? 8080}
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: ${cfg.port ?? 8080}
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /readyz
              port: ${cfg.port ?? 8080}
            initialDelaySeconds: 5
            periodSeconds: 10`;

    case 'Service':
      return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
spec:
  type: ${cfg.serviceType ?? 'ClusterIP'}
  selector:
    app: ${name}
  ports:
    - name: http
      port: 80
      targetPort: ${cfg.port ?? 8080}
      protocol: TCP`;

    case 'ConfigMap':
      return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
data:
  KEY_ONE: value-one
  KEY_TWO: value-two
  config.yaml: |
    setting: value`;

    case 'Secret':
      return `apiVersion: v1
kind: Secret
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
type: Opaque
data:
  # Values must be base64-encoded: echo -n 'value' | base64
  USERNAME: dXNlcm5hbWU=
  PASSWORD: cGFzc3dvcmQ=`;

    case 'Ingress':
      return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${ns}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: ${cfg.ingressHost ?? `${name}.example.com`}
      http:
        paths:
          - path: ${cfg.ingressPath ?? '/'}
            pathType: Prefix
            backend:
              service:
                name: ${name}
                port:
                  number: 80`;

    case 'HPA':
      return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${name}-hpa
  namespace: ${ns}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${cfg.targetDeployment ?? name}
  minReplicas: ${cfg.minReplicas ?? 2}
  maxReplicas: ${cfg.maxReplicas ?? 10}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80`;

    case 'CronJob':
      return `apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
spec:
  schedule: "${cfg.schedule ?? '0 * * * *'}"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: ${name}
        spec:
          restartPolicy: OnFailure
          containers:
            - name: ${name}
              image: ${cfg.image ?? `${name}:latest`}
              resources:
                requests:
                  cpu: 100m
                  memory: 64Mi`;

    case 'PVC':
      return `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: ${cfg.storageSize ?? '10Gi'}
  storageClassName: standard`;

    case 'ServiceAccount':
      return `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${name}
  namespace: ${ns}
  labels:
    app: ${name}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${name}-role
  namespace: ${ns}
rules:
  - apiGroups: [""]
    resources: ["pods", "configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${name}-rolebinding
  namespace: ${ns}
subjects:
  - kind: ServiceAccount
    name: ${name}
    namespace: ${ns}
roleRef:
  kind: Role
  name: ${name}-role
  apiGroup: rbac.authorization.k8s.io`;

    case 'Namespace':
      return `apiVersion: v1
kind: Namespace
metadata:
  name: ${name}
  labels:
    name: ${name}`;

    default:
      return '';
  }
}

const KINDS: ResourceKind[] = ['Deployment', 'Service', 'ConfigMap', 'Secret', 'Ingress', 'HPA', 'CronJob', 'PVC', 'ServiceAccount', 'Namespace'];

export default function K8sGeneratorTool() {
  const [kind, setKind] = useState<ResourceKind>('Deployment');
  const [name, setName] = useState('my-app');
  const [namespace, setNamespace] = useState('default');
  const [image, setImage] = useState('');
  const [replicas, setReplicas] = useState('2');
  const [port, setPort] = useState('8080');
  const [serviceType, setServiceType] = useState('ClusterIP');
  const [schedule, setSchedule] = useState('0 * * * *');
  const [storageSize, setStorageSize] = useState('10Gi');
  const [minReplicas, setMinReplicas] = useState('2');
  const [maxReplicas, setMaxReplicas] = useState('10');
  const [ingressHost, setIngressHost] = useState('');
  const [copied, setCopied] = useState(false);

  const cfg: ResourceConfig = {
    kind, name, namespace,
    image: image || undefined,
    replicas: parseInt(replicas) || 2,
    port: parseInt(port) || 8080,
    serviceType, schedule, storageSize,
    minReplicas: parseInt(minReplicas) || 2,
    maxReplicas: parseInt(maxReplicas) || 10,
    targetDeployment: name,
    ingressHost: ingressHost || undefined,
  };

  const output = generateYaml(cfg);

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>K8s YAML Generator</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Generate production-ready Kubernetes YAML boilerplate</p>
        </div>
      </div>
      <div className="tool-body">
        {/* Config pane */}
        <div className="pane overflow-auto">
          <div className="pane-label">Configuration</div>
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {/* Resource kind selector */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Resource Kind</label>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button key={k}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                    style={{
                      background: kind === k ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: kind === k ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${kind === k ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                    onClick={() => setKind(k)}>{k}</button>
                ))}
              </div>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" />
              </div>
              {kind !== 'Namespace' && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Namespace</label>
                  <input className="input-base" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="default" />
                </div>
              )}
            </div>

            {/* Kind-specific fields */}
            {(kind === 'Deployment' || kind === 'CronJob') && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Container Image</label>
                  <input className="input-base font-mono text-xs" value={image} onChange={(e) => setImage(e.target.value)} placeholder={`${name}:1.0.0`} />
                </div>
                {kind === 'Deployment' && (
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Port</label>
                    <input className="input-base" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
                  </div>
                )}
                {kind === 'CronJob' && (
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Schedule</label>
                    <input className="input-base font-mono text-xs" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 * * * *" />
                  </div>
                )}
              </div>
            )}
            {kind === 'Deployment' && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Replicas</label>
                <input className="input-base" type="number" value={replicas} onChange={(e) => setReplicas(e.target.value)} style={{ width: 80 }} />
              </div>
            )}
            {kind === 'Service' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Target Port</label>
                  <input className="input-base" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Service Type</label>
                  <select className="input-base" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                    <option>ClusterIP</option><option>NodePort</option><option>LoadBalancer</option>
                  </select>
                </div>
              </div>
            )}
            {kind === 'HPA' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Min Replicas</label>
                  <input className="input-base" type="number" value={minReplicas} onChange={(e) => setMinReplicas(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max Replicas</label>
                  <input className="input-base" type="number" value={maxReplicas} onChange={(e) => setMaxReplicas(e.target.value)} />
                </div>
              </div>
            )}
            {kind === 'PVC' && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Storage Size</label>
                <input className="input-base" value={storageSize} onChange={(e) => setStorageSize(e.target.value)} placeholder="10Gi" style={{ width: 100 }} />
              </div>
            )}
            {kind === 'Ingress' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Host</label>
                  <input className="input-base" value={ingressHost} onChange={(e) => setIngressHost(e.target.value)} placeholder={`${name}.example.com`} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pane-divider" />

        {/* Output pane */}
        <div className="pane">
          <div className="pane-label flex items-center justify-between pr-3">
            <span>Generated YAML</span>
            <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={copy}>
              <Copy size={11} />{copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
}
