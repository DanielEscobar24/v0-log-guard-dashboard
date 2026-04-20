/**
 * LogGuard API Gateway
 * Express + Socket.io server bridging backend services to the frontend
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import amqp from 'amqplib';

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 4000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://admin:logguard123@localhost:27017/logguard?authSource=admin';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// ============================================
// SOCKET.IO SETUP
// ============================================

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ============================================
// DATABASE CONNECTION
// ============================================

let db;
let mongoClient;

async function connectMongoDB() {
  const maxRetries = 10;
  const retryDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      mongoClient = new MongoClient(MONGODB_URL);
      await mongoClient.connect();
      db = mongoClient.db('logguard');
      console.log('Connected to MongoDB successfully');
      return true;
    } catch (error) {
      console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  return false;
}

// ============================================
// RABBITMQ CONSUMER
// ============================================

let rabbitConnection;
let rabbitChannel;

async function connectRabbitMQ() {
  const maxRetries = 10;
  const retryDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      rabbitConnection = await amqp.connect(RABBITMQ_URL);
      rabbitChannel = await rabbitConnection.createChannel();

      // Assert queues
      await rabbitChannel.assertQueue('processed_logs', { durable: true });
      await rabbitChannel.assertQueue('alerts', { durable: true });

      // Set prefetch
      await rabbitChannel.prefetch(10);

      console.log('Connected to RabbitMQ successfully');

      // Start consumers
      startConsumers();
      return true;
    } catch (error) {
      console.warn(`RabbitMQ connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  return false;
}

function startConsumers() {
  // Consume processed logs and emit to connected clients
  rabbitChannel.consume('processed_logs', (msg) => {
    if (msg) {
      try {
        const logEntry = JSON.parse(msg.content.toString());
        
        // Emit to all connected clients
        io.emit('new_log', logEntry);
        
        rabbitChannel.ack(msg);
      } catch (error) {
        console.error('Error processing log message:', error);
        rabbitChannel.nack(msg, false, false);
      }
    }
  });

  // Consume alerts and emit to connected clients
  rabbitChannel.consume('alerts', (msg) => {
    if (msg) {
      try {
        const alert = JSON.parse(msg.content.toString());
        
        // Emit to all connected clients
        io.emit('new_alert', alert);
        
        rabbitChannel.ack(msg);
      } catch (error) {
        console.error('Error processing alert message:', error);
        rabbitChannel.nack(msg, false, false);
      }
    }
  });

  console.log('RabbitMQ consumers started');
}

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial stats on connection
  sendInitialStats(socket);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Handle client requests for historical data
  socket.on('request_logs', async (params) => {
    const logs = await getLogs(params);
    socket.emit('logs_response', logs);
  });

  socket.on('request_stats', async () => {
    const stats = await getStats();
    socket.emit('stats_response', stats);
  });
});

async function sendInitialStats(socket) {
  try {
    const stats = await getStats();
    socket.emit('initial_stats', stats);
  } catch (error) {
    console.error('Error sending initial stats:', error);
  }
}

// ============================================
// REST API ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mongodb: !!db,
    rabbitmq: !!rabbitChannel,
    timestamp: new Date().toISOString()
  });
});

// Get logs with pagination and filtering
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await getLogs(req.query);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get single log by ID
app.get('/api/logs/:id', async (req, res) => {
  try {
    const log = await db.collection('logs').findOne({ id: req.params.id });
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json(log);
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

// Get alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const { limit = 50, acknowledged } = req.query;
    
    const query = {};
    if (acknowledged !== undefined) {
      query.acknowledged = acknowledged === 'true';
    }

    const alerts = await db.collection('alerts')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge alert
app.put('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    const result = await db.collection('alerts').updateOne(
      { id: req.params.id },
      { $set: { acknowledged: true } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Get dashboard stats
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get traffic over time
app.get('/api/stats/traffic', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: since.toISOString() }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00',
              date: { $dateFromString: { dateString: '$timestamp' } }
            }
          },
          benign: {
            $sum: { $cond: [{ $eq: ['$label', 'Benign'] }, 1, 0] }
          },
          attacks: {
            $sum: { $cond: [{ $ne: ['$label', 'Benign'] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const traffic = await db.collection('logs').aggregate(pipeline).toArray();
    res.json(traffic.map(t => ({
      timestamp: t._id,
      benign: t.benign,
      attacks: t.attacks,
      total: t.total
    })));
  } catch (error) {
    console.error('Error fetching traffic stats:', error);
    res.status(500).json({ error: 'Failed to fetch traffic stats' });
  }
});

// Get attack distribution
app.get('/api/stats/attacks', async (req, res) => {
  try {
    const pipeline = [
      {
        $match: {
          label: { $ne: 'Benign' }
        }
      },
      {
        $group: {
          _id: '$label',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    const attacks = await db.collection('logs').aggregate(pipeline).toArray();
    res.json(attacks.map(a => ({
      type: a._id,
      count: a.count
    })));
  } catch (error) {
    console.error('Error fetching attack stats:', error);
    res.status(500).json({ error: 'Failed to fetch attack stats' });
  }
});

// Get top source IPs
app.get('/api/stats/top-sources', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const pipeline = [
      {
        $match: {
          label: { $ne: 'Benign' }
        }
      },
      {
        $group: {
          _id: '$src_ip',
          attacks: { $sum: 1 },
          types: { $addToSet: '$label' }
        }
      },
      { $sort: { attacks: -1 } },
      { $limit: parseInt(limit) }
    ];

    const sources = await db.collection('logs').aggregate(pipeline).toArray();
    res.json(sources.map(s => ({
      ip: s._id,
      attacks: s.attacks,
      types: s.types
    })));
  } catch (error) {
    console.error('Error fetching top sources:', error);
    res.status(500).json({ error: 'Failed to fetch top sources' });
  }
});

// Get protocol distribution
app.get('/api/stats/protocols', async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$protocol',
          count: { $sum: 1 },
          attacks: {
            $sum: { $cond: [{ $ne: ['$label', 'Benign'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ];

    const protocols = await db.collection('logs').aggregate(pipeline).toArray();
    res.json(protocols.map(p => ({
      protocol: p._id,
      total: p.count,
      attacks: p.attacks
    })));
  } catch (error) {
    console.error('Error fetching protocol stats:', error);
    res.status(500).json({ error: 'Failed to fetch protocol stats' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getLogs(params = {}) {
  const {
    page = 1,
    limit = 50,
    label,
    severity,
    src_ip,
    dst_ip,
    protocol,
    from,
    to
  } = params;

  const query = {};

  if (label) query.label = label;
  if (severity) query.severity = severity;
  if (src_ip) query.src_ip = { $regex: src_ip, $options: 'i' };
  if (dst_ip) query.dst_ip = { $regex: dst_ip, $options: 'i' };
  if (protocol) query.protocol = protocol;

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = from;
    if (to) query.timestamp.$lte = to;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [logs, total] = await Promise.all([
    db.collection('logs')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray(),
    db.collection('logs').countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };
}

async function getStats() {
  const [
    totalLogs,
    totalAttacks,
    recentAlerts,
    labelCounts
  ] = await Promise.all([
    db.collection('logs').countDocuments(),
    db.collection('logs').countDocuments({ label: { $ne: 'Benign' } }),
    db.collection('alerts').countDocuments({ acknowledged: false }),
    db.collection('logs').aggregate([
      { $group: { _id: '$label', count: { $sum: 1 } } }
    ]).toArray()
  ]);

  const severityCounts = await db.collection('logs').aggregate([
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]).toArray();

  return {
    totalLogs,
    totalAttacks,
    totalBenign: totalLogs - totalAttacks,
    activeAlerts: recentAlerts,
    attackRate: totalLogs > 0 ? ((totalAttacks / totalLogs) * 100).toFixed(2) : 0,
    byLabel: labelCounts.reduce((acc, l) => ({ ...acc, [l._id]: l.count }), {}),
    bySeverity: severityCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
  };
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown() {
  console.log('Shutting down gracefully...');

  // Close Socket.io
  io.close();

  // Close RabbitMQ
  if (rabbitChannel) await rabbitChannel.close();
  if (rabbitConnection) await rabbitConnection.close();

  // Close MongoDB
  if (mongoClient) await mongoClient.close();

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================
// START SERVER
// ============================================

async function start() {
  console.log('='.repeat(50));
  console.log('LogGuard API Gateway Starting');
  console.log('='.repeat(50));

  // Connect to MongoDB
  const mongoConnected = await connectMongoDB();
  if (!mongoConnected) {
    console.error('Failed to connect to MongoDB');
    process.exit(1);
  }

  // Connect to RabbitMQ
  const rabbitConnected = await connectRabbitMQ();
  if (!rabbitConnected) {
    console.error('Failed to connect to RabbitMQ');
    process.exit(1);
  }

  // Start HTTP server
  httpServer.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
    console.log(`CORS enabled for: ${CORS_ORIGIN}`);
    console.log(`WebSocket ready for connections`);
  });
}

start().catch(console.error);
