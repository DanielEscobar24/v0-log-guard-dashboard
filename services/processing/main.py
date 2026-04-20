"""
Processing Service for CICIDS-2017 Dataset
===========================================
Consumes raw logs from RabbitMQ, transforms them to match
the frontend schema, and stores them in MongoDB.
Also publishes processed logs to a 'processed_logs' queue
for the gateway to broadcast via WebSocket.
"""

import os
import json
import time
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

import pika
from pika.exceptions import AMQPConnectionError
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('processing-service')

# Environment configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'admin')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'logguard_secret')
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://admin:logguard_secret@localhost:27017/logguard?authSource=admin')

RAW_QUEUE = 'raw_logs'
PROCESSED_QUEUE = 'processed_logs'

# Protocol mapping (CICIDS-2017 uses numeric protocol codes)
PROTOCOL_MAP = {
    0: 'ICMP',
    6: 'TCP',
    17: 'UDP',
    # Default to TCP for HTTPS traffic (we'll infer from port)
}

# Label normalization mapping (CICIDS-2017 labels to frontend labels)
LABEL_MAP = {
    'BENIGN': 'Benign',
    'benign': 'Benign',
    'DoS Hulk': 'DDoS',
    'DoS GoldenEye': 'DDoS',
    'DoS slowloris': 'DDoS',
    'DoS Slowhttptest': 'DDoS',
    'DDoS': 'DDoS',
    'PortScan': 'PortScan',
    'Port Scan': 'PortScan',
    'FTP-Patator': 'Bot',
    'SSH-Patator': 'Bot',
    'Bot': 'Bot',
    'Botnet': 'Botnet',
    'Infiltration': 'Infiltration',
    'Web Attack - Brute Force': 'Suspicious',
    'Web Attack - XSS': 'Suspicious',
    'Web Attack - Sql Injection': 'Suspicious',
    'Heartbleed': 'Suspicious',
}


def connect_to_mongodb() -> MongoClient:
    """Establish connection to MongoDB with retry logic."""
    max_retries = 10
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Test connection
            client.admin.command('ping')
            logger.info("Connected to MongoDB")
            return client
        except ConnectionFailure as e:
            logger.warning(f"MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                raise


def connect_to_rabbitmq() -> pika.BlockingConnection:
    """Establish connection to RabbitMQ with retry logic."""
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        credentials=credentials,
        heartbeat=600,
        blocked_connection_timeout=300
    )
    
    max_retries = 10
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            connection = pika.BlockingConnection(parameters)
            logger.info(f"Connected to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
            return connection
        except AMQPConnectionError as e:
            logger.warning(f"RabbitMQ connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                raise


def get_protocol(raw_protocol: Any, dst_port: Optional[int]) -> str:
    """Determine protocol based on raw protocol number and destination port."""
    if raw_protocol is None:
        # Infer from port
        if dst_port == 443:
            return 'HTTPS'
        elif dst_port == 80:
            return 'TCP'
        return 'TCP'
    
    try:
        protocol_num = int(raw_protocol)
        protocol = PROTOCOL_MAP.get(protocol_num, 'TCP')
        
        # Override to HTTPS if port 443
        if dst_port == 443 and protocol == 'TCP':
            return 'HTTPS'
        
        return protocol
    except (ValueError, TypeError):
        return 'TCP'


def normalize_label(raw_label: Optional[str]) -> str:
    """Normalize CICIDS-2017 label to frontend label format."""
    if raw_label is None:
        return 'Benign'
    
    label_str = str(raw_label).strip()
    return LABEL_MAP.get(label_str, 'Suspicious' if label_str != '' else 'Benign')


def calculate_confidence(label: str, flow_duration: float, packet_count: int) -> float:
    """Calculate prediction confidence based on label and flow characteristics."""
    if label == 'Benign':
        # Lower confidence for benign (since we're more interested in attacks)
        base = 0.1 + (flow_duration / 10000000) * 0.1
        return min(0.3, base)
    else:
        # Higher confidence for attack labels
        # Longer flows and more packets = higher confidence
        duration_factor = min(0.15, flow_duration / 5000000)
        packet_factor = min(0.14, packet_count / 1000)
        return min(0.99, 0.7 + duration_factor + packet_factor)


def transform_to_frontend_schema(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform raw CICIDS-2017 data to match the frontend LogEntry interface.
    
    Frontend schema:
    - id: string
    - flow_id: string
    - timestamp: string (ISO format)
    - src_ip: string
    - dst_ip: string
    - protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTPS'
    - flow_duration: number
    - label: 'Benign' | 'DDoS' | 'PortScan' | 'Bot' | 'Botnet' | 'Infiltration' | 'Suspicious'
    - length?: number
    - flags?: string
    - payload?: string
    - prediction_confidence?: number
    """
    # Extract destination port for protocol inference
    dst_port = raw_data.get('destination_port') or raw_data.get('Destination Port')
    if dst_port is not None:
        try:
            dst_port = int(dst_port)
        except (ValueError, TypeError):
            dst_port = None
    
    # Get source and destination IPs (handle various column name formats)
    src_ip = (
        raw_data.get('source_ip') or 
        raw_data.get('Source IP') or 
        raw_data.get('Source_IP') or 
        '0.0.0.0'
    )
    dst_ip = (
        raw_data.get('destination_ip') or 
        raw_data.get('Destination IP') or 
        raw_data.get('Destination_IP') or 
        '0.0.0.0'
    )
    
    # Get flow duration (microseconds in CICIDS-2017)
    flow_duration_raw = (
        raw_data.get('flow_duration') or 
        raw_data.get('Flow Duration') or 
        raw_data.get('Flow_Duration') or 
        0
    )
    try:
        flow_duration = float(flow_duration_raw) if flow_duration_raw else 0
    except (ValueError, TypeError):
        flow_duration = 0
    
    # Get protocol
    raw_protocol = (
        raw_data.get('protocol') or 
        raw_data.get('Protocol') or 
        6  # Default TCP
    )
    protocol = get_protocol(raw_protocol, dst_port)
    
    # Get label
    raw_label = raw_data.get('label') or raw_data.get('Label')
    label = normalize_label(raw_label)
    
    # Calculate packet length (sum of forward and backward packet lengths)
    fwd_length = raw_data.get('total_length_fwd') or raw_data.get('Total Length of Fwd Packets') or 0
    bwd_length = raw_data.get('total_length_bwd') or raw_data.get('Total Length of Bwd Packets') or 0
    try:
        length = int(fwd_length or 0) + int(bwd_length or 0)
    except (ValueError, TypeError):
        length = 0
    
    # Calculate total packets
    fwd_packets = raw_data.get('total_fwd_packets') or raw_data.get('Total Fwd Packets') or 0
    bwd_packets = raw_data.get('total_bwd_packets') or raw_data.get('Total Backward Packets') or 0
    try:
        total_packets = int(fwd_packets or 0) + int(bwd_packets or 0)
    except (ValueError, TypeError):
        total_packets = 0
    
    # Build flags string from flag counts
    flags_parts = []
    if raw_data.get('syn_flag_count') or raw_data.get('SYN Flag Count'):
        flags_parts.append('SYN')
    if raw_data.get('ack_flag_count') or raw_data.get('ACK Flag Count'):
        flags_parts.append('ACK')
    if raw_data.get('fin_flag_count') or raw_data.get('FIN Flag Count'):
        flags_parts.append('FIN')
    if raw_data.get('rst_flag_count') or raw_data.get('RST Flag Count'):
        flags_parts.append('RST')
    if raw_data.get('psh_flag_count') or raw_data.get('PSH Flag Count'):
        flags_parts.append('PSH')
    flags = '|'.join(flags_parts) if flags_parts else '0x00'
    
    # Generate unique IDs
    unique_id = str(uuid.uuid4())
    flow_id = f"FL-{uuid.uuid4().hex[:8].upper()}"
    
    # Use current timestamp for live streaming effect
    timestamp = datetime.utcnow().isoformat() + 'Z'
    
    return {
        'id': f"log-{unique_id}",
        'flow_id': flow_id,
        'timestamp': timestamp,
        'src_ip': str(src_ip),
        'dst_ip': str(dst_ip),
        'protocol': protocol,
        'flow_duration': flow_duration,
        'label': label,
        'length': length,
        'flags': flags,
        'payload': '48 65 6c 6c 6f 20 57 6f 72 6c 64 21 ...',  # Placeholder hex payload
        'prediction_confidence': calculate_confidence(label, flow_duration, total_packets),
        # Store additional metadata for analytics
        '_meta': {
            'original_label': raw_label,
            'total_packets': total_packets,
            'dst_port': dst_port,
            'processed_at': datetime.utcnow().isoformat() + 'Z'
        }
    }


def process_message(
    ch: pika.channel.Channel,
    method: pika.spec.Basic.Deliver,
    properties: pika.spec.BasicProperties,
    body: bytes,
    db,
    publish_channel: pika.channel.Channel
):
    """Process a single message from the raw_logs queue."""
    try:
        # Parse the raw data
        raw_data = json.loads(body.decode('utf-8'))
        
        # Transform to frontend schema
        processed_log = transform_to_frontend_schema(raw_data)
        
        # Store in MongoDB
        collection = db['logs']
        collection.insert_one(processed_log.copy())
        
        # Remove MongoDB _id before publishing (not JSON serializable)
        if '_id' in processed_log:
            del processed_log['_id']
        
        # Publish to processed_logs queue for WebSocket broadcast
        publish_channel.basic_publish(
            exchange='',
            routing_key=PROCESSED_QUEUE,
            body=json.dumps(processed_log, default=str),
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type='application/json'
            )
        )
        
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
        logger.debug(f"Processed log: {processed_log['id']} - {processed_log['label']}")
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


def main():
    """Main entry point for the processing service."""
    logger.info("Starting Processing Service...")
    
    # Connect to MongoDB
    mongo_client = connect_to_mongodb()
    db = mongo_client['logguard']
    
    # Create indexes for better query performance
    db['logs'].create_index('timestamp')
    db['logs'].create_index('label')
    db['logs'].create_index('src_ip')
    logger.info("MongoDB indexes created")
    
    # Connect to RabbitMQ
    connection = connect_to_rabbitmq()
    consume_channel = connection.channel()
    publish_channel = connection.channel()
    
    # Declare queues
    consume_channel.queue_declare(queue=RAW_QUEUE, durable=True)
    publish_channel.queue_declare(queue=PROCESSED_QUEUE, durable=True)
    logger.info(f"Queues '{RAW_QUEUE}' and '{PROCESSED_QUEUE}' declared")
    
    # Set prefetch count for better throughput
    consume_channel.basic_qos(prefetch_count=10)
    
    # Set up consumer with callback
    def callback(ch, method, properties, body):
        process_message(ch, method, properties, body, db, publish_channel)
    
    consume_channel.basic_consume(
        queue=RAW_QUEUE,
        on_message_callback=callback,
        auto_ack=False
    )
    
    logger.info("Processing service ready. Waiting for messages...")
    
    try:
        consume_channel.start_consuming()
    except KeyboardInterrupt:
        logger.info("Processing service interrupted by user")
    finally:
        connection.close()
        mongo_client.close()
        logger.info("Connections closed")


if __name__ == "__main__":
    main()
