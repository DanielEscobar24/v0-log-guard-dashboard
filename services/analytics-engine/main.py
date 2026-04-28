"""
LogGuard Analytics Engine
Consumes raw logs, classifies traffic, and produces processed logs
"""

import os
import sys
import json
import time
import logging
import signal
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

import pika
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# ============================================
# CONFIGURATION
# ============================================

RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb://admin:logguard123@localhost:27017/logguard?authSource=admin')
MODEL_PATH = os.getenv('MODEL_PATH', '/app/model')

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('analytics-engine')

# Graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    global shutdown_requested
    logger.info('Shutdown signal received')
    shutdown_requested = True

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


# ============================================
# DATA MODELS (Matching Frontend Interface)
# ============================================

@dataclass
class LogEntry:
    """Matches the frontend LogEntry interface exactly"""
    id: str
    timestamp: str
    src_ip: str
    src_port: int
    dst_ip: str
    dst_port: int
    protocol: str
    bytes_sent: int
    bytes_received: int
    packets: int
    duration: float
    label: str
    severity: str
    confidence: float


@dataclass
class Alert:
    """Alert structure for detected attacks"""
    id: str
    timestamp: str
    type: str
    severity: str
    source_ip: str
    target_ip: str
    message: str
    log_id: str
    acknowledged: bool = False


# ============================================
# LABEL AND SEVERITY MAPPING
# ============================================

# Map CICIDS-2017 labels to frontend labels
LABEL_MAPPING = {
    'BENIGN': 'Benign',
    'NORMAL': 'Benign',
    'DOS HULK': 'DDoS',
    'DOS GOLDENEYE': 'DDoS',
    'DOS SLOWLORIS': 'DDoS',
    'DOS SLOWHTTPTEST': 'DDoS',
    'DDOS': 'DDoS',
    'PORTSCAN': 'Port Scan',
    'PORT SCAN': 'Port Scan',
    'FTP-PATATOR': 'Brute Force',
    'SSH-PATATOR': 'Brute Force',
    'BRUTE FORCE': 'Brute Force',
    'WEB ATTACK - BRUTE FORCE': 'Brute Force',
    'WEB ATTACK - XSS': 'Web Attack',
    'WEB ATTACK - SQL INJECTION': 'SQL Injection',
    'BOT': 'Botnet',
    'BOTNET': 'Botnet',
    'INFILTRATION': 'Infiltration',
    'HEARTBLEED': 'Heartbleed'
}

# Severity levels based on attack type
SEVERITY_MAPPING = {
    'Benign': 'low',
    'Port Scan': 'medium',
    'Brute Force': 'high',
    'DDoS': 'critical',
    'Web Attack': 'high',
    'SQL Injection': 'critical',
    'Botnet': 'critical',
    'Infiltration': 'critical',
    'Heartbleed': 'critical'
}

# Protocol number to name mapping
PROTOCOL_MAPPING = {
    0: 'HOPOPT',
    1: 'ICMP',
    6: 'TCP',
    17: 'UDP',
    41: 'IPv6',
    47: 'GRE',
    50: 'ESP',
    51: 'AH',
    58: 'ICMPv6',
    89: 'OSPF',
    132: 'SCTP'
}


# ============================================
# DATA TRANSFORMATION
# ============================================

def generate_id(data: Dict[str, Any]) -> str:
    """Generate unique ID from row data"""
    unique_string = f"{data.get('Flow ID', '')}{data.get('Timestamp', '')}{data.get('Src IP', '')}"
    return hashlib.md5(unique_string.encode()).hexdigest()[:16]


def map_label(raw_label: str) -> str:
    """Map raw CICIDS label to frontend label"""
    normalized = str(raw_label).strip().upper()
    return LABEL_MAPPING.get(normalized, 'Benign')


def get_severity(label: str) -> str:
    """Get severity based on attack type"""
    return SEVERITY_MAPPING.get(label, 'low')


def map_protocol(protocol_num: Any) -> str:
    """Map protocol number to name"""
    try:
        num = int(float(protocol_num))
        return PROTOCOL_MAPPING.get(num, f'OTHER({num})')
    except (ValueError, TypeError):
        return 'TCP'


def calculate_confidence(raw_data: Dict[str, Any], label: str) -> float:
    """
    Calculate confidence score based on traffic characteristics
    In production, this would use the ML model
    """
    if label == 'Benign':
        return 0.95
    
    # Base confidence for attacks
    confidence = 0.75
    
    # Adjust based on traffic patterns
    packets = int(raw_data.get('Total Fwd Packets', 0)) + int(raw_data.get('Total Bwd Packets', 0))
    bytes_total = int(raw_data.get('Total Length of Fwd Packets', 0)) + int(raw_data.get('Total Length of Bwd Packets', 0))
    
    # High packet count increases confidence for DDoS
    if label == 'DDoS' and packets > 1000:
        confidence += 0.15
    
    # Port scan detection confidence
    if label == 'Port Scan':
        confidence += 0.10
    
    # Brute force patterns
    if label == 'Brute Force':
        confidence += 0.12
    
    return min(confidence, 0.99)


def transform_raw_to_log_entry(raw_data: Dict[str, Any]) -> Optional[LogEntry]:
    """
    Transform raw CICIDS-2017 data to frontend LogEntry format
    """
    try:
        # Map the raw label
        raw_label = raw_data.get('Label', 'BENIGN')
        label = map_label(raw_label)
        severity = get_severity(label)
        
        # Parse timestamp
        timestamp_raw = raw_data.get('Timestamp', '')
        try:
            # CICIDS format: "15/02/2017 09:18"
            if timestamp_raw:
                dt = datetime.strptime(str(timestamp_raw), '%d/%m/%Y %H:%M')
                timestamp = dt.isoformat() + 'Z'
            else:
                timestamp = datetime.utcnow().isoformat() + 'Z'
        except ValueError:
            timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Calculate bytes and packets
        bytes_sent = int(float(raw_data.get('Total Length of Fwd Packets', 0)))
        bytes_received = int(float(raw_data.get('Total Length of Bwd Packets', 0)))
        packets = int(float(raw_data.get('Total Fwd Packets', 0))) + int(float(raw_data.get('Total Bwd Packets', 0)))
        
        # Duration in seconds
        duration_micro = float(raw_data.get('Flow Duration', 0))
        duration = duration_micro / 1_000_000  # Convert microseconds to seconds
        
        log_entry = LogEntry(
            id=generate_id(raw_data),
            timestamp=timestamp,
            src_ip=str(raw_data.get('Src IP', '0.0.0.0')),
            src_port=int(float(raw_data.get('Src Port', 0))),
            dst_ip=str(raw_data.get('Dst IP', '0.0.0.0')),
            dst_port=int(float(raw_data.get('Dst Port', 0))),
            protocol=map_protocol(raw_data.get('Protocol', 6)),
            bytes_sent=bytes_sent,
            bytes_received=bytes_received,
            packets=packets,
            duration=round(duration, 3),
            label=label,
            severity=severity,
            confidence=calculate_confidence(raw_data, label)
        )
        
        return log_entry
        
    except Exception as e:
        logger.error(f'Failed to transform data: {e}')
        return None


def create_alert(log_entry: LogEntry) -> Optional[Alert]:
    """Create alert for detected attacks"""
    if log_entry.label == 'Benign':
        return None
    
    alert_messages = {
        'DDoS': f'DDoS attack detected from {log_entry.src_ip}',
        'Port Scan': f'Port scanning activity from {log_entry.src_ip}',
        'Brute Force': f'Brute force attempt from {log_entry.src_ip}',
        'Web Attack': f'Web attack detected from {log_entry.src_ip}',
        'SQL Injection': f'SQL injection attempt from {log_entry.src_ip}',
        'Botnet': f'Botnet activity detected from {log_entry.src_ip}',
        'Infiltration': f'Network infiltration from {log_entry.src_ip}',
        'Heartbleed': f'Heartbleed exploit attempt from {log_entry.src_ip}'
    }
    
    return Alert(
        id=hashlib.md5(f'{log_entry.id}{datetime.utcnow().isoformat()}'.encode()).hexdigest()[:16],
        timestamp=datetime.utcnow().isoformat() + 'Z',
        type=log_entry.label,
        severity=log_entry.severity,
        source_ip=log_entry.src_ip,
        target_ip=log_entry.dst_ip,
        message=alert_messages.get(log_entry.label, f'Attack detected: {log_entry.label}'),
        log_id=log_entry.id
    )


# ============================================
# DATABASE AND MESSAGING
# ============================================

class MongoDBClient:
    def __init__(self, url: str):
        self.url = url
        self.client: Optional[MongoClient] = None
        self.db = None
        
    def connect(self) -> bool:
        max_retries = 10
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                self.client = MongoClient(self.url)
                self.client.admin.command('ping')
                self.db = self.client.logguard
                logger.info('Connected to MongoDB successfully')
                return True
            except ConnectionFailure as e:
                logger.warning(f'MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}')
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    
        return False
    
    def insert_log(self, log_entry: LogEntry) -> bool:
        try:
            self.db.logs.insert_one(asdict(log_entry))
            return True
        except Exception as e:
            logger.error(f'Failed to insert log: {e}')
            return False
    
    def insert_alert(self, alert: Alert) -> bool:
        try:
            self.db.alerts.insert_one(asdict(alert))
            return True
        except Exception as e:
            logger.error(f'Failed to insert alert: {e}')
            return False
    
    def close(self):
        if self.client:
            self.client.close()


class RabbitMQClient:
    def __init__(self, url: str):
        self.url = url
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.channel.Channel] = None
        
    def connect(self) -> bool:
        max_retries = 10
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                params = pika.URLParameters(self.url)
                params.heartbeat = 600
                params.blocked_connection_timeout = 300
                
                self.connection = pika.BlockingConnection(params)
                self.channel = self.connection.channel()
                
                # Declare queues
                self.channel.queue_declare(queue='raw_logs', durable=True)
                self.channel.queue_declare(queue='processed_logs', durable=True)
                self.channel.queue_declare(queue='alerts', durable=True)
                
                # Set QoS for fair dispatch
                self.channel.basic_qos(prefetch_count=1)
                
                logger.info('Connected to RabbitMQ successfully')
                return True
                
            except Exception as e:
                logger.warning(f'RabbitMQ connection attempt {attempt + 1}/{max_retries} failed: {e}')
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    
        return False
    
    def publish(self, queue: str, message: dict) -> bool:
        try:
            self.channel.basic_publish(
                exchange='',
                routing_key=queue,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type='application/json'
                )
            )
            return True
        except Exception as e:
            logger.error(f'Failed to publish to {queue}: {e}')
            return False
    
    def consume(self, queue: str, callback):
        """Set up consumer for queue"""
        self.channel.basic_consume(
            queue=queue,
            on_message_callback=callback
        )
    
    def start_consuming(self):
        self.channel.start_consuming()
    
    def stop_consuming(self):
        self.channel.stop_consuming()
    
    def close(self):
        if self.connection and not self.connection.is_closed:
            self.connection.close()


# ============================================
# MAIN PROCESSING LOOP
# ============================================

def process_message(ch, method, properties, body, mongo: MongoDBClient, rabbitmq: RabbitMQClient):
    """Process a single raw log message"""
    try:
        raw_data = json.loads(body)
        
        # Transform to LogEntry format
        log_entry = transform_raw_to_log_entry(raw_data)
        
        if log_entry:
            # Store in MongoDB
            mongo.insert_log(log_entry)
            
            # Publish to processed_logs queue for api-log-guard
            rabbitmq.publish('processed_logs', asdict(log_entry))
            
            # Create alert if attack detected
            alert = create_alert(log_entry)
            if alert:
                mongo.insert_alert(alert)
                rabbitmq.publish('alerts', asdict(alert))
                logger.info(f'Alert created: {alert.type} from {alert.source_ip}')
        
        # Acknowledge message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except json.JSONDecodeError as e:
        logger.error(f'Invalid JSON: {e}')
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        logger.error(f'Processing error: {e}')
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


def main():
    global shutdown_requested
    
    logger.info('=' * 50)
    logger.info('LogGuard Analytics Engine Starting')
    logger.info('=' * 50)
    
    # Initialize connections
    mongo = MongoDBClient(MONGODB_URL)
    rabbitmq = RabbitMQClient(RABBITMQ_URL)
    
    if not mongo.connect():
        logger.error('Cannot start without MongoDB connection')
        sys.exit(1)
    
    if not rabbitmq.connect():
        logger.error('Cannot start without RabbitMQ connection')
        sys.exit(1)
    
    try:
        # Set up consumer with callback
        def callback(ch, method, properties, body):
            if shutdown_requested:
                rabbitmq.stop_consuming()
                return
            process_message(ch, method, properties, body, mongo, rabbitmq)
        
        rabbitmq.consume('raw_logs', callback)
        
        logger.info('Waiting for messages...')
        rabbitmq.start_consuming()
        
    except KeyboardInterrupt:
        logger.info('Keyboard interrupt received')
    except Exception as e:
        logger.error(f'Fatal error: {e}')
        raise
    finally:
        rabbitmq.close()
        mongo.close()
        logger.info('Analytics engine stopped')


if __name__ == '__main__':
    main()
