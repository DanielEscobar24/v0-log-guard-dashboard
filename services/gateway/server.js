/**
 * API Gateway & WebSocket Server
 * ==============================
 * 
 * Provides REST API endpoints and Socket.io WebSocket server
 * for the LogGuard frontend to consume processed network logs.
 * 
 * Features:
 * - REST API for fetching logs, alerts, and analytics
 * - WebSocket for real-time log streaming (new_log events)
 * - Consumes from RabbitMQ processed_logs queue
 * - Queries MongoDB for historical data
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import amqp from 'amqplib';
import { MongoClient } from 'mongodb';
import cors from 'cors';

// Configuration from environment
const PORT = process.env.PORT || 3001;
const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || 5672;
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'admin';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'logguard_secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:logguard_secret@localhost:27017/logguard?authSource=admin';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const PROCESSED_QUEUE = 'processed_logs';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Configure Socket.io with CORS
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN.split(','),
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true
}));
app.use(express.json());

// MongoDB connection
let db;
let mongoClient;

async function connectToMongoDB() {
  const maxRetries = 10;
  const retryDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      db = mongoClient.db('logguard');
      console.log('Connected to MongoDB');
      return;
    } catch (error) {
      console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
}

// RabbitMQ connection and consumer
async function connectToRabbitMQ() {
  const maxRetries = 10;
  const retryDelay = 5000;
  const connectionUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await amqp.connect(connectionUrl);
      const channel = await connection.createChannel();
      
      await channel.assertQueue(PROCESSED_QUEUE, { durable: true });
      console.log(`Connected to RabbitMQ, consuming from ${PROCESSED_QUEUE}`);
      
      // Consume messages and broadcast via WebSocket
      channel.consume(PROCESSED_QUEUE, (msg) => {
        if (msg) {
          try {
            const logData = JSON.parse(msg.content.toString());
            
            // Remove internal metadata before broadcasting
            delete logData._meta;
            delete logData._id;
            
            // Broadcast to all connected clients
            io.emit('new_log', logData);
            
            // Also emit specific events based on label
            if (logData.label !== 'Benign') {
              io.emit('new_alert', {
                id: `alert-${logData.id}`,
                severity: getSeverity(logData.label),
                time: new Date(logData.timestamp).toLocaleTimeString(),
                src_ip: logData.src_ip,
                attack_type: logData.label,
                description: `${logData.label} detected from ${logData.src_ip}`,
                status: 'Unassigned'
              });
            }
            
            channel.ack(msg);
          } catch (error) {
            console.error('Error processing message:', error);
            channel.nack(msg, false, false);
          }
        }
      });
      
      return;
    } catch (error) {
      console.warn(`RabbitMQ connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
}

// Helper function to determine alert severity based on attack label
function getSeverity(label) {
  const severityMap = {
    'DDoS': 'CRITICAL',
    'Botnet': 'CRITICAL',
    'Bot': 'HIGH',
    'PortScan': 'MEDIUM',
    'Infiltration': 'HIGH',
    'Suspicious': 'LOW'
  };
  return severityMap[label] || 'MEDIUM';
}

// ============================================
// REST API Endpoints
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: db ? 'connected' : 'disconnected',
      rabbitmq: 'connected'
    }
  });
});

// Get recent logs with pagination
app.get('/api/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const label = req.query.label;
    const skip = (page - 1) * limit;

    const query = {};
    if (label && label !== 'all') {
      query.label = label;
    }

    const logs = await db.collection('logs')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .project({ _meta: 0 })
      .toArray();

    // Convert MongoDB _id to string
    const cleanedLogs = logs.map(log => ({
      ...log,
      _id: undefined
    }));

    const total = await db.collection('logs').countDocuments(query);

    res.json({
      logs: cleanedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get single log by ID
app.get('/api/logs/:id', async (req, res) => {
  try {
    const log = await db.collection('logs')
      .findOne({ id: req.params.id }, { projection: { _meta: 0 } });

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({ ...log, _id: undefined });
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

// Get traffic statistics for charts
app.get('/api/stats/traffic', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startTime.toISOString() }
        }
      },
      {
        $group: {
          _id: {
            hour: { $substr: ['$timestamp', 11, 2] }
          },
          benign: {
            $sum: { $cond: [{ $eq: ['$label', 'Benign'] }, 1, 0] }
          },
          attacks: {
            $sum: { $cond: [{ $ne: ['$label', 'Benign'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.hour': 1 }
      }
    ];

    const stats = await db.collection('logs').aggregate(pipeline).toArray();

    // Format for frontend chart
    const trafficData = stats.map(stat => ({
      time: `${stat._id.hour}:00`,
      benign: stat.benign,
      attacks: stat.attacks
    }));

    res.json({ trafficData });
  } catch (error) {
    console.error('Error fetching traffic stats:', error);
    res.status(500).json({ error: 'Failed to fetch traffic stats' });
  }
});

// Get KPI data
app.get('/api/stats/kpi', async (req, res) => {
  try {
    const totalFlows = await db.collection('logs').countDocuments();
    const attacks = await db.collection('logs').countDocuments({ label: { $ne: 'Benign' } });
    const benign = await db.collection('logs').countDocuments({ label: 'Benign' });

    // Get active threats (last hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const activeThreats = await db.collection('logs').countDocuments({
      label: { $ne: 'Benign' },
      timestamp: { $gte: oneHourAgo.toISOString() }
    });

    res.json({
      totalFlows: {
        value: formatNumber(totalFlows),
        change: '+8.4%',
        trend: 'up'
      },
      attacks: {
        value: formatNumber(attacks),
        change: '+12%',
        trend: 'up'
      },
      benign: {
        value: formatNumber(benign),
        change: '-2.1%',
        trend: 'down'
      },
      activeThreats: {
        value: activeThreats,
        status: activeThreats > 100 ? 'CRITICAL' : activeThreats > 50 ? 'HIGH' : 'MEDIUM'
      }
    });
  } catch (error) {
    console.error('Error fetching KPI stats:', error);
    res.status(500).json({ error: 'Failed to fetch KPI stats' });
  }
});

// Get attack distribution
app.get('/api/stats/attacks', async (req, res) => {
  try {
    const pipeline = [
      {
        $match: { label: { $ne: 'Benign' } }
      },
      {
        $group: {
          _id: '$label',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ];

    const attacks = await db.collection('logs').aggregate(pipeline).toArray();
    const total = attacks.reduce((sum, a) => sum + a.count, 0);

    const colorMap = {
      'DDoS': '#ef4444',
      'PortScan': '#f97316',
      'Bot': '#8b5cf6',
      'Botnet': '#ef4444',
      'Infiltration': '#f59e0b',
      'Suspicious': '#00b4ff'
    };

    const attackDistribution = attacks.map(a => ({
      name: a._id,
      value: Math.round((a.count / total) * 100),
      color: colorMap[a._id] || '#00b4ff'
    }));

    // Top attack types with percentages
    const topAttackTypes = attacks.slice(0, 3).map(a => ({
      name: a._id,
      percentage: Math.round((a.count / total) * 100),
      color: colorMap[a._id] || '#00b4ff'
    }));

    res.json({ attackDistribution, topAttackTypes });
  } catch (error) {
    console.error('Error fetching attack stats:', error);
    res.status(500).json({ error: 'Failed to fetch attack stats' });
  }
});

// Get top source IPs
app.get('/api/stats/top-ips', async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$src_ip',
          flows: { $sum: 1 }
        }
      },
      {
        $sort: { flows: -1 }
      },
      {
        $limit: 5
      }
    ];

    const ips = await db.collection('logs').aggregate(pipeline).toArray();

    const topSourceIPs = ips.map(ip => ({
      ip: ip._id,
      flows: formatNumber(ip.flows)
    }));

    res.json({ topSourceIPs });
  } catch (error) {
    console.error('Error fetching top IPs:', error);
    res.status(500).json({ error: 'Failed to fetch top IPs' });
  }
});

// Get protocol distribution
app.get('/api/stats/protocols', async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$protocol',
          totalLength: { $sum: '$length' }
        }
      },
      {
        $sort: { totalLength: -1 }
      }
    ];

    const protocols = await db.collection('logs').aggregate(pipeline).toArray();

    const protocolData = protocols.map(p => ({
      name: `${p._id}`,
      value: (p.totalLength / (1024 * 1024 * 1024)).toFixed(1),
      unit: 'GB'
    }));

    res.json({ protocolData });
  } catch (error) {
    console.error('Error fetching protocol stats:', error);
    res.status(500).json({ error: 'Failed to fetch protocol stats' });
  }
});

// Helper function to format large numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

// ============================================
// Socket.io Event Handlers
// ============================================

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial data on connection
  socket.emit('connected', {
    message: 'Connected to LogGuard WebSocket',
    timestamp: new Date().toISOString()
  });

  // Handle client requests for historical data
  socket.on('request_logs', async (params) => {
    try {
      const limit = params?.limit || 10;
      const logs = await db.collection('logs')
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .project({ _meta: 0 })
        .toArray();

      socket.emit('logs_batch', logs.map(log => ({
        ...log,
        _id: undefined
      })));
    } catch (error) {
      console.error('Error fetching logs for socket:', error);
      socket.emit('error', { message: 'Failed to fetch logs' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Start Server
// ============================================

async function startServer() {
  try {
    await connectToMongoDB();
    await connectToRabbitMQ();

    httpServer.listen(PORT, () => {
      console.log(`API Gateway running on port ${PORT}`);
      console.log(`WebSocket server ready`);
      console.log(`CORS enabled for: ${CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await mongoClient?.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await mongoClient?.close();
  process.exit(0);
});

startServer();
