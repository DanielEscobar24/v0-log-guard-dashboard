// Types
export interface LogEntry {
  id: string
  flow_id: string
  timestamp: string
  src_ip: string
  dst_ip: string
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTPS'
  flow_duration: number
  label: 'Benign' | 'DDoS' | 'PortScan' | 'Bot' | 'Botnet' | 'Infiltration' | 'Suspicious'
  length?: number
  flags?: string
  payload?: string
  prediction_confidence?: number
}

export interface Alert {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  time: string
  src_ip: string
  attack_type: string
  description: string
  status: 'Unassigned' | 'Triage' | 'Open' | 'Resolved'
}

export interface Microservice {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latency: number
}

export interface User {
  id: string
  name: string
  email: string
  role: 'Super Admin' | 'Admin' | 'Analyst' | 'Viewer'
  lastActive: string
  avatar?: string
}

export interface DataNode {
  id: string
  name: string
  ip: string
  status: 'Active' | 'Inactive' | 'Maintenance'
}

// Mock microservices
export const microservices: Microservice[] = [
  { id: '1', name: 'Ingestion-Service', status: 'healthy', latency: 12 },
  { id: '2', name: 'Processing-Service', status: 'healthy', latency: 45 },
  { id: '3', name: 'Storage-DB', status: 'healthy', latency: 8 },
  { id: '4', name: 'Query-API', status: 'healthy', latency: 23 },
  { id: '5', name: 'Alert-Engine', status: 'healthy', latency: 15 },
]

// Generate random IP
const randomIP = () => {
  const ranges = [
    () => `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    () => `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    () => `172.16.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    () => `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
  ]
  return ranges[Math.floor(Math.random() * ranges.length)]()
}

const uniqueId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Generate mock log entries
export const generateLogs = (count: number): LogEntry[] => {
  const protocols: LogEntry['protocol'][] = ['TCP', 'UDP', 'ICMP', 'HTTPS']
  const labels: LogEntry['label'][] = ['Benign', 'Benign', 'Benign', 'Benign', 'DDoS', 'PortScan', 'Bot', 'Botnet', 'Suspicious']
  
  return Array.from({ length: count }, (_, i) => {
    const label = labels[Math.floor(Math.random() * labels.length)]
    const now = new Date()
    now.setSeconds(now.getSeconds() - i * 2)
    
    return {
      id: uniqueId('log'),
      flow_id: `FL-${Math.floor(Math.random() * 100000)}`,
      timestamp: now.toISOString(),
      src_ip: randomIP(),
      dst_ip: randomIP(),
      protocol: protocols[Math.floor(Math.random() * protocols.length)],
      flow_duration: Math.random() * 3000,
      label,
      length: Math.floor(Math.random() * 1500) + 64,
      flags: '0x02',
      payload: '48 65 6c 6c 6f 20 57 6f 72 6c 64 21 ...',
      prediction_confidence: label === 'Benign' ? 0.1 + Math.random() * 0.2 : 0.7 + Math.random() * 0.29,
    }
  })
}

// Generate mock alerts
export const generateAlerts = (count: number): Alert[] => {
  const severities: Alert['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const attackTypes = ['DDoS Attack', 'PortScan', 'Anomalous Login', 'Exfiltration', 'SQL Injection', 'Brute Force', 'Botnet']
  const descriptions = [
    'High volume of SYN requests originating...',
    'Sequential scanning of TCP ports 1-102...',
    'Repeated failed SSH attempts for user ...',
    'Outbound data transfer to unrecognize...',
    'Suspicious query patterns detected...',
    'Multiple authentication failures...',
    'C2 communication pattern detected...',
  ]
  const statuses: Alert['status'][] = ['Unassigned', 'Triage', 'Open', 'Resolved']
  
  return Array.from({ length: count }, (_, i) => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - i * 3)
    
    return {
      id: `alert-${i}`,
      severity: severities[Math.floor(Math.random() * severities.length)],
      time: now.toTimeString().split(' ')[0].slice(0, 12),
      src_ip: randomIP(),
      attack_type: attackTypes[Math.floor(Math.random() * attackTypes.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
    }
  })
}

// Mock users
export const users: User[] = [
  { id: '1', name: 'Jane Doe', email: 'jane.doe@logguard.com', role: 'Super Admin', lastActive: '2 mins ago' },
  { id: '2', name: 'Marcus Kane', email: 'm.kane@logguard.com', role: 'Analyst', lastActive: '5 hours ago' },
  { id: '3', name: 'Sarah Chen', email: 's.chen@logguard.com', role: 'Admin', lastActive: '1 day ago' },
]

// Mock data nodes
export const dataNodes: DataNode[] = [
  { id: '1', name: 'Primary-Firewall-NY', ip: '192.168.1.104', status: 'Active' },
  { id: '2', name: 'AWS-Oregon-Cluster', ip: 'arn:aws:logs:us-west-2', status: 'Active' },
]

// Traffic data for charts
export const trafficData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  benign: Math.floor(Math.random() * 50000) + 30000,
  attacks: Math.floor(Math.random() * 300) + 50,
}))

// Attack distribution data
export const attackDistribution = [
  { name: 'DDoS Attempts', value: 64, color: '#00b4ff' },
  { name: 'SQL Injection', value: 24, color: '#f59e0b' },
  { name: 'XSS Threats', value: 12, color: '#14b8a6' },
]

// Protocol data
export const protocolData = [
  { name: 'HTTPS (443)', value: 12.4, unit: 'TB' },
  { name: 'DNS (53)', value: 4.1, unit: 'TB' },
  { name: 'SSH (22)', value: 1.2, unit: 'TB' },
  { name: 'ICMP', value: 0.4, unit: 'TB' },
]

// Top attack types
export const topAttackTypes = [
  { name: 'PortScan', percentage: 42, color: '#f97316' },
  { name: 'DDoS', percentage: 35, color: '#ef4444' },
  { name: 'Brute Force', percentage: 23, color: '#00b4ff' },
]

// Top source IPs
export const topSourceIPs = [
  { ip: '192.168.1.105', flows: '8.4k' },
  { ip: '45.23.112.8', flows: '5.2k' },
  { ip: '203.0.113.14', flows: '3.1k' },
]

// KPI data
export const kpiData = {
  totalFlows: { value: '1.2M', change: '+8.4%', trend: 'up' as const },
  attacks: { value: '4.5k', change: '+12%', trend: 'up' as const },
  benign: { value: '1.1M', change: '-2.1%', trend: 'down' as const },
  activeThreats: { value: 128, status: 'CRITICAL' as const },
}

// Alert stats
export const alertStats = {
  totalActive: 1284,
  critical: 24,
  highSeverity: 142,
  inProgress: 31,
}

// Top attack vectors for alerts page
export const topAttackVectors = [
  { name: 'DDoS Flux', percentage: 42 },
  { name: 'SQL Injection', percentage: 28 },
  { name: 'Auth Brute Force', percentage: 18 },
  { name: 'Others', percentage: 12 },
]

// Threat locations for map
export const threatLocations = [
  { id: '1', lat: 39.9042, lng: 116.4074, type: 'attack', intensity: 'high', city: 'Beijing' },
  { id: '2', lat: 51.5074, lng: -0.1278, type: 'safe', intensity: 'low', city: 'London' },
  { id: '3', lat: -23.5505, lng: -46.6333, type: 'attack', intensity: 'medium', city: 'São Paulo' },
  { id: '4', lat: 35.6762, lng: 139.6503, type: 'safe', intensity: 'low', city: 'Tokyo' },
  { id: '5', lat: -33.8688, lng: 151.2093, type: 'safe', intensity: 'low', city: 'Sydney' },
]

// Port concentration data
export const portConcentration = [
  { port: 443, status: 'active' },
  { port: 80, status: 'active' },
  { port: 53, status: 'critical' },
  { port: 22, status: 'active' },
  { port: 8080, status: 'idle' },
  { port: 3389, status: 'critical' },
  { port: 5432, status: 'idle' },
]

// Flow duration histogram data
export const flowDurationData = [
  { range: '0MS', count: 120 },
  { range: '100MS', count: 180 },
  { range: '250MS', count: 280 },
  { range: '500MS', count: 150 },
  { range: '1000MS+', count: 90 },
]
