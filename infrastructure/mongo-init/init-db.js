// MongoDB Initialization Script for LogGuard Platform
// Creates collections, indexes, and initial configuration

db = db.getSiblingDB('logguard');

// ============================================
// COLLECTIONS
// ============================================

// Processed logs collection
db.createCollection('logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['timestamp', 'src_ip', 'dst_ip', 'protocol', 'label'],
      properties: {
        timestamp: { bsonType: 'date' },
        src_ip: { bsonType: 'string' },
        src_port: { bsonType: 'int' },
        dst_ip: { bsonType: 'string' },
        dst_port: { bsonType: 'int' },
        protocol: { bsonType: 'string' },
        bytes_sent: { bsonType: 'long' },
        bytes_received: { bsonType: 'long' },
        packets: { bsonType: 'int' },
        duration: { bsonType: 'double' },
        label: { bsonType: 'string' },
        severity: { bsonType: 'string' },
        confidence: { bsonType: 'double' },
        flow_id: { bsonType: 'string' }
      }
    }
  }
});

// Alerts collection for detected attacks
db.createCollection('alerts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['timestamp', 'type', 'severity', 'source_ip'],
      properties: {
        timestamp: { bsonType: 'date' },
        type: { bsonType: 'string' },
        severity: { bsonType: 'string' },
        source_ip: { bsonType: 'string' },
        target_ip: { bsonType: 'string' },
        message: { bsonType: 'string' },
        log_id: { bsonType: 'objectId' },
        acknowledged: { bsonType: 'bool' }
      }
    }
  }
});

// Stats collection for aggregated metrics
db.createCollection('stats');

// ============================================
// INDEXES
// ============================================

// Logs indexes
db.logs.createIndex({ timestamp: -1 });
db.logs.createIndex({ label: 1 });
db.logs.createIndex({ severity: 1 });
db.logs.createIndex({ src_ip: 1 });
db.logs.createIndex({ dst_ip: 1 });
db.logs.createIndex({ protocol: 1 });
db.logs.createIndex({ timestamp: -1, label: 1 });

// Alerts indexes
db.alerts.createIndex({ timestamp: -1 });
db.alerts.createIndex({ type: 1 });
db.alerts.createIndex({ severity: 1 });
db.alerts.createIndex({ acknowledged: 1 });

// Stats indexes
db.stats.createIndex({ type: 1, timestamp: -1 });

print('LogGuard database initialized successfully!');
