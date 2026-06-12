import { useState, useMemo } from 'react';
import { Copy } from 'lucide-react';

interface PortEntry {
  port: number;
  protocol: 'TCP' | 'UDP' | 'TCP/UDP';
  service: string;
  description: string;
  category: string;
}

// Well-known and commonly used ports database
const PORTS: PortEntry[] = [
  // Web
  { port: 80,    protocol: 'TCP',     service: 'HTTP',        description: 'Hypertext Transfer Protocol — unencrypted web traffic',         category: 'Web' },
  { port: 443,   protocol: 'TCP',     service: 'HTTPS',       description: 'HTTP Secure — TLS-encrypted web traffic',                        category: 'Web' },
  { port: 8080,  protocol: 'TCP',     service: 'HTTP-Alt',    description: 'Common alternative HTTP port — dev servers, proxies',            category: 'Web' },
  { port: 8443,  protocol: 'TCP',     service: 'HTTPS-Alt',   description: 'Common alternative HTTPS port',                                  category: 'Web' },
  { port: 8000,  protocol: 'TCP',     service: 'HTTP-Dev',    description: 'Development HTTP servers (Django, Python http.server)',           category: 'Web' },
  { port: 3000,  protocol: 'TCP',     service: 'Dev-Server',  description: 'Common dev server port (Node.js, React, Rails)',                  category: 'Web' },
  { port: 5000,  protocol: 'TCP',     service: 'Dev-Server',  description: 'Common dev server (Flask, .NET Kestrel)',                         category: 'Web' },
  { port: 4200,  protocol: 'TCP',     service: 'Angular-Dev', description: 'Angular CLI development server',                                  category: 'Web' },
  { port: 5173,  protocol: 'TCP',     service: 'Vite-Dev',    description: 'Vite development server default port',                            category: 'Web' },
  // Email
  { port: 25,    protocol: 'TCP',     service: 'SMTP',        description: 'Simple Mail Transfer Protocol — sending email between servers',   category: 'Email' },
  { port: 110,   protocol: 'TCP',     service: 'POP3',        description: 'Post Office Protocol v3 — retrieving email',                      category: 'Email' },
  { port: 143,   protocol: 'TCP',     service: 'IMAP',        description: 'Internet Message Access Protocol — email retrieval',              category: 'Email' },
  { port: 465,   protocol: 'TCP',     service: 'SMTPS',       description: 'SMTP over SSL/TLS',                                               category: 'Email' },
  { port: 587,   protocol: 'TCP',     service: 'SMTP-Sub',    description: 'SMTP submission port (email clients → mail servers)',              category: 'Email' },
  { port: 993,   protocol: 'TCP',     service: 'IMAPS',       description: 'IMAP over SSL/TLS',                                               category: 'Email' },
  { port: 995,   protocol: 'TCP',     service: 'POP3S',       description: 'POP3 over SSL/TLS',                                               category: 'Email' },
  // DNS / Network
  { port: 53,    protocol: 'TCP/UDP', service: 'DNS',         description: 'Domain Name System — hostname to IP resolution',                  category: 'Network' },
  { port: 67,    protocol: 'UDP',     service: 'DHCP-Server', description: 'DHCP server — IP address assignment',                             category: 'Network' },
  { port: 68,    protocol: 'UDP',     service: 'DHCP-Client', description: 'DHCP client — receiving IP configuration',                        category: 'Network' },
  { port: 123,   protocol: 'UDP',     service: 'NTP',         description: 'Network Time Protocol — clock synchronization',                   category: 'Network' },
  { port: 161,   protocol: 'UDP',     service: 'SNMP',        description: 'Simple Network Management Protocol — device monitoring',          category: 'Network' },
  { port: 162,   protocol: 'UDP',     service: 'SNMP-Trap',   description: 'SNMP trap notifications',                                         category: 'Network' },
  { port: 179,   protocol: 'TCP',     service: 'BGP',         description: 'Border Gateway Protocol — inter-domain routing',                  category: 'Network' },
  { port: 520,   protocol: 'UDP',     service: 'RIP',         description: 'Routing Information Protocol',                                    category: 'Network' },
  // Remote Access
  { port: 22,    protocol: 'TCP',     service: 'SSH',         description: 'Secure Shell — encrypted remote terminal and SFTP',               category: 'Remote' },
  { port: 23,    protocol: 'TCP',     service: 'Telnet',      description: 'Telnet — unencrypted remote terminal (legacy/insecure)',           category: 'Remote' },
  { port: 3389,  protocol: 'TCP',     service: 'RDP',         description: 'Remote Desktop Protocol — Windows remote access',                  category: 'Remote' },
  { port: 5900,  protocol: 'TCP',     service: 'VNC',         description: 'Virtual Network Computing — remote desktop',                      category: 'Remote' },
  { port: 5901,  protocol: 'TCP',     service: 'VNC-1',       description: 'VNC display :1',                                                  category: 'Remote' },
  { port: 2222,  protocol: 'TCP',     service: 'SSH-Alt',     description: 'Alternate SSH port (used when 22 is blocked)',                    category: 'Remote' },
  // File Transfer
  { port: 20,    protocol: 'TCP',     service: 'FTP-Data',    description: 'FTP data transfer',                                               category: 'Files' },
  { port: 21,    protocol: 'TCP',     service: 'FTP',         description: 'File Transfer Protocol — control connection',                     category: 'Files' },
  { port: 69,    protocol: 'UDP',     service: 'TFTP',        description: 'Trivial File Transfer Protocol',                                  category: 'Files' },
  { port: 445,   protocol: 'TCP',     service: 'SMB',         description: 'Server Message Block — Windows file sharing / Samba',             category: 'Files' },
  { port: 139,   protocol: 'TCP',     service: 'NetBIOS',     description: 'NetBIOS Session Service — legacy Windows networking',             category: 'Files' },
  { port: 2049,  protocol: 'TCP/UDP', service: 'NFS',         description: 'Network File System',                                             category: 'Files' },
  { port: 990,   protocol: 'TCP',     service: 'FTPS',        description: 'FTP over SSL/TLS (implicit)',                                     category: 'Files' },
  // Databases
  { port: 1433,  protocol: 'TCP',     service: 'MSSQL',       description: 'Microsoft SQL Server',                                            category: 'Database' },
  { port: 1521,  protocol: 'TCP',     service: 'Oracle',      description: 'Oracle Database',                                                 category: 'Database' },
  { port: 3306,  protocol: 'TCP',     service: 'MySQL',       description: 'MySQL / MariaDB relational database',                             category: 'Database' },
  { port: 5432,  protocol: 'TCP',     service: 'PostgreSQL',  description: 'PostgreSQL relational database',                                  category: 'Database' },
  { port: 5984,  protocol: 'TCP',     service: 'CouchDB',     description: 'Apache CouchDB document database',                                category: 'Database' },
  { port: 6379,  protocol: 'TCP',     service: 'Redis',       description: 'Redis in-memory data store / cache',                              category: 'Database' },
  { port: 7474,  protocol: 'TCP',     service: 'Neo4j',       description: 'Neo4j graph database HTTP API',                                   category: 'Database' },
  { port: 8529,  protocol: 'TCP',     service: 'ArangoDB',    description: 'ArangoDB multi-model database',                                   category: 'Database' },
  { port: 9042,  protocol: 'TCP',     service: 'Cassandra',   description: 'Apache Cassandra CQL native transport',                           category: 'Database' },
  { port: 27017, protocol: 'TCP',     service: 'MongoDB',     description: 'MongoDB document database',                                       category: 'Database' },
  { port: 28015, protocol: 'TCP',     service: 'RethinkDB',   description: 'RethinkDB driver port',                                           category: 'Database' },
  { port: 50000, protocol: 'TCP',     service: 'DB2',         description: 'IBM DB2 database',                                                category: 'Database' },
  // Messaging / Streaming
  { port: 1883,  protocol: 'TCP',     service: 'MQTT',        description: 'MQTT message broker — IoT messaging',                             category: 'Messaging' },
  { port: 4222,  protocol: 'TCP',     service: 'NATS',        description: 'NATS messaging system',                                           category: 'Messaging' },
  { port: 5222,  protocol: 'TCP',     service: 'XMPP',        description: 'Extensible Messaging and Presence Protocol (Jabber)',              category: 'Messaging' },
  { port: 5269,  protocol: 'TCP',     service: 'XMPP-S2S',    description: 'XMPP server-to-server federation',                                category: 'Messaging' },
  { port: 5671,  protocol: 'TCP',     service: 'AMQPS',       description: 'AMQP over TLS — RabbitMQ (secure)',                               category: 'Messaging' },
  { port: 5672,  protocol: 'TCP',     service: 'AMQP',        description: 'Advanced Message Queuing Protocol — RabbitMQ',                    category: 'Messaging' },
  { port: 6667,  protocol: 'TCP',     service: 'IRC',         description: 'Internet Relay Chat',                                             category: 'Messaging' },
  { port: 9092,  protocol: 'TCP',     service: 'Kafka',       description: 'Apache Kafka distributed event streaming',                        category: 'Messaging' },
  { port: 15672, protocol: 'TCP',     service: 'RabbitMQ-UI', description: 'RabbitMQ management console',                                     category: 'Messaging' },
  // DevOps / Infra
  { port: 2376,  protocol: 'TCP',     service: 'Docker-TLS',  description: 'Docker daemon TLS (remote API)',                                  category: 'DevOps' },
  { port: 2377,  protocol: 'TCP',     service: 'Docker-Swarm', description: 'Docker Swarm manager port',                                     category: 'DevOps' },
  { port: 2379,  protocol: 'TCP',     service: 'etcd-Client', description: 'etcd client requests (used by Kubernetes)',                       category: 'DevOps' },
  { port: 2380,  protocol: 'TCP',     service: 'etcd-Peer',   description: 'etcd peer communication',                                        category: 'DevOps' },
  { port: 6443,  protocol: 'TCP',     service: 'K8s-API',     description: 'Kubernetes API server',                                           category: 'DevOps' },
  { port: 8472,  protocol: 'UDP',     service: 'Flannel',     description: 'Flannel VXLAN overlay network (Kubernetes CNI)',                  category: 'DevOps' },
  { port: 10250, protocol: 'TCP',     service: 'Kubelet',     description: 'Kubernetes kubelet API',                                          category: 'DevOps' },
  { port: 10251, protocol: 'TCP',     service: 'Kube-Sched',  description: 'Kubernetes scheduler',                                            category: 'DevOps' },
  { port: 10252, protocol: 'TCP',     service: 'Kube-CM',     description: 'Kubernetes controller-manager',                                   category: 'DevOps' },
  { port: 30000, protocol: 'TCP',     service: 'K8s-NodePort', description: 'Kubernetes NodePort range start (30000–32767)',                  category: 'DevOps' },
  { port: 9090,  protocol: 'TCP',     service: 'Prometheus',  description: 'Prometheus monitoring server',                                    category: 'DevOps' },
  { port: 9091,  protocol: 'TCP',     service: 'Pushgateway', description: 'Prometheus Pushgateway',                                          category: 'DevOps' },
  { port: 9093,  protocol: 'TCP',     service: 'Alertmanager', description: 'Prometheus Alertmanager',                                        category: 'DevOps' },
  { port: 9100,  protocol: 'TCP',     service: 'Node-Exporter', description: 'Prometheus Node Exporter',                                     category: 'DevOps' },
  { port: 3100,  protocol: 'TCP',     service: 'Loki',        description: 'Grafana Loki log aggregation',                                    category: 'DevOps' },
  { port: 3200,  protocol: 'TCP',     service: 'Tempo',       description: 'Grafana Tempo distributed tracing',                               category: 'DevOps' },
  { port: 4317,  protocol: 'TCP',     service: 'OTLP-gRPC',   description: 'OpenTelemetry gRPC collector',                                   category: 'DevOps' },
  { port: 4318,  protocol: 'TCP',     service: 'OTLP-HTTP',   description: 'OpenTelemetry HTTP collector',                                   category: 'DevOps' },
  { port: 8125,  protocol: 'UDP',     service: 'StatsD',      description: 'StatsD metrics aggregation',                                      category: 'DevOps' },
  { port: 8500,  protocol: 'TCP',     service: 'Consul',      description: 'HashiCorp Consul HTTP API',                                       category: 'DevOps' },
  { port: 8600,  protocol: 'TCP/UDP', service: 'Consul-DNS',  description: 'Consul DNS interface',                                            category: 'DevOps' },
  { port: 8200,  protocol: 'TCP',     service: 'Vault',       description: 'HashiCorp Vault API',                                             category: 'DevOps' },
  { port: 8300,  protocol: 'TCP',     service: 'Consul-RPC',  description: 'Consul server RPC',                                               category: 'DevOps' },
  { port: 4646,  protocol: 'TCP',     service: 'Nomad-HTTP',  description: 'HashiCorp Nomad HTTP API',                                        category: 'DevOps' },
  { port: 9200,  protocol: 'TCP',     service: 'Elasticsearch', description: 'Elasticsearch REST API',                                       category: 'DevOps' },
  { port: 9300,  protocol: 'TCP',     service: 'ES-Transport', description: 'Elasticsearch node transport',                                  category: 'DevOps' },
  { port: 5601,  protocol: 'TCP',     service: 'Kibana',      description: 'Kibana web interface (ELK stack)',                                category: 'DevOps' },
  { port: 3000,  protocol: 'TCP',     service: 'Grafana',     description: 'Grafana observability dashboard',                                 category: 'DevOps' },
  // VPN / Tunneling
  { port: 500,   protocol: 'UDP',     service: 'IKE',         description: 'IPsec IKE — VPN key exchange',                                   category: 'VPN' },
  { port: 1194,  protocol: 'UDP',     service: 'OpenVPN',     description: 'OpenVPN default port',                                            category: 'VPN' },
  { port: 1723,  protocol: 'TCP',     service: 'PPTP',        description: 'Point-to-Point Tunneling Protocol',                               category: 'VPN' },
  { port: 4500,  protocol: 'UDP',     service: 'IPsec-NAT',   description: 'IPsec NAT traversal',                                             category: 'VPN' },
  { port: 51820, protocol: 'UDP',     service: 'WireGuard',   description: 'WireGuard VPN default port',                                      category: 'VPN' },
  // Proxy / Load Balancer
  { port: 1080,  protocol: 'TCP',     service: 'SOCKS',       description: 'SOCKS proxy',                                                     category: 'Proxy' },
  { port: 3128,  protocol: 'TCP',     service: 'Squid',       description: 'Squid HTTP proxy',                                                category: 'Proxy' },
  { port: 8888,  protocol: 'TCP',     service: 'HTTP-Proxy',  description: 'Common HTTP proxy port',                                          category: 'Proxy' },
  { port: 9999,  protocol: 'TCP',     service: 'HAProxy-Stat', description: 'HAProxy stats page (common config)',                             category: 'Proxy' },
];

const ALL_CATEGORIES = ['All', ...Array.from(new Set(PORTS.map((p) => p.category))).sort()];

const PROTO_COLORS: Record<string, string> = {
  TCP: 'var(--accent)',
  UDP: '#f59e0b',
  'TCP/UDP': '#a78bfa',
};

export default function PortReferenceTool() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [copied, setCopied] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PORTS.filter((p) => {
      const catMatch = category === 'All' || p.category === category;
      if (!q) return catMatch;
      return catMatch && (
        String(p.port).includes(q) ||
        p.service.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [search, category]);

  function copyPort(port: number) {
    navigator.clipboard.writeText(String(port));
    setCopied(port);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Port Reference</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Well-known and commonly used TCP/UDP port numbers — search by port number or service name
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Search */}
        <input
          className="input-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search port number, service, or description…"
          autoFocus
        />

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
              style={category === cat
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} of {PORTS.length} ports
        </div>

        {/* Table */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="grid text-xs font-semibold px-3 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', gridTemplateColumns: '80px 90px 140px 1fr 80px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Port</span>
            <span style={{ color: 'var(--text-secondary)' }}>Protocol</span>
            <span style={{ color: 'var(--text-secondary)' }}>Service</span>
            <span style={{ color: 'var(--text-secondary)' }}>Description</span>
            <span style={{ color: 'var(--text-secondary)' }}>Category</span>
          </div>
          <div className="divide-y">
            {filtered.map((p) => (
              <div
                key={`${p.port}-${p.protocol}`}
                className="grid items-center px-3 py-2 hover:bg-opacity-50 transition-colors text-xs"
                style={{ gridTemplateColumns: '80px 90px 140px 1fr 80px', background: 'transparent' }}
              >
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{p.port}</span>
                  <button
                    className="btn btn-ghost p-0.5 opacity-0 hover:opacity-100 transition-opacity"
                    onClick={() => copyPort(p.port)}
                    title="Copy port number"
                    style={{ opacity: copied === p.port ? 1 : undefined }}
                  >
                    <Copy size={10} color={copied === p.port ? '#34d399' : undefined} />
                  </button>
                </div>
                <span className="font-mono text-xs font-medium" style={{ color: PROTO_COLORS[p.protocol] }}>{p.protocol}</span>
                <span className="font-mono font-medium truncate" style={{ color: 'var(--accent)' }}>{p.service}</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.description}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.category}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No ports matching "{search}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
