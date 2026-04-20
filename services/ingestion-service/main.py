"""
LogGuard Ingestion Service
Downloads CICIDS-2017 dataset via kagglehub and streams rows to RabbitMQ
"""

import os
import sys
import json
import time
import logging
import signal
from datetime import datetime
from typing import Optional

import pika
import kagglehub
import pandas as pd

from cleaning_utils import clean_dataframe, validate_row

# ============================================
# CONFIGURATION
# ============================================

RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')
DATA_PATH = os.getenv('DATA_PATH', '/app/data')
STREAM_INTERVAL_MS = int(os.getenv('STREAM_INTERVAL_MS', '500'))
KAGGLE_DATASET = 'ciaboreanuda/cicids2017-cleaned'

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ingestion-service')

# Graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    global shutdown_requested
    logger.info('Shutdown signal received, finishing current operation...')
    shutdown_requested = True

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


# ============================================
# RABBITMQ CONNECTION
# ============================================

class RabbitMQProducer:
    def __init__(self, url: str):
        self.url = url
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.channel.Channel] = None
        
    def connect(self) -> bool:
        """Establish connection to RabbitMQ with retry logic"""
        max_retries = 10
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                params = pika.URLParameters(self.url)
                params.heartbeat = 600
                params.blocked_connection_timeout = 300
                
                self.connection = pika.BlockingConnection(params)
                self.channel = self.connection.channel()
                
                # Declare queue (idempotent)
                self.channel.queue_declare(
                    queue='raw_logs',
                    durable=True,
                    arguments={'x-message-ttl': 3600000}
                )
                
                logger.info('Connected to RabbitMQ successfully')
                return True
                
            except Exception as e:
                logger.warning(f'RabbitMQ connection attempt {attempt + 1}/{max_retries} failed: {e}')
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    
        logger.error('Failed to connect to RabbitMQ after all retries')
        return False
    
    def publish(self, message: dict) -> bool:
        """Publish message to raw_logs queue"""
        try:
            self.channel.basic_publish(
                exchange='',
                routing_key='raw_logs',
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent
                    content_type='application/json',
                    timestamp=int(time.time())
                )
            )
            return True
        except Exception as e:
            logger.error(f'Failed to publish message: {e}')
            # Try to reconnect
            self.connect()
            return False
    
    def close(self):
        """Close connection gracefully"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info('RabbitMQ connection closed')


# ============================================
# DATASET MANAGEMENT
# ============================================

def download_dataset() -> str:
    """Download CICIDS-2017 dataset using kagglehub"""
    logger.info(f'Downloading dataset: {KAGGLE_DATASET}')
    
    try:
        # kagglehub handles caching automatically
        path = kagglehub.dataset_download(KAGGLE_DATASET)
        logger.info(f'Dataset downloaded to: {path}')
        return path
    except Exception as e:
        logger.error(f'Failed to download dataset: {e}')
        raise


def load_dataset(dataset_path: str) -> pd.DataFrame:
    """Load and combine all CSV files from the dataset"""
    import glob
    
    csv_files = glob.glob(os.path.join(dataset_path, '**/*.csv'), recursive=True)
    
    if not csv_files:
        raise FileNotFoundError(f'No CSV files found in {dataset_path}')
    
    logger.info(f'Found {len(csv_files)} CSV files')
    
    dataframes = []
    for csv_file in csv_files:
        logger.info(f'Loading: {os.path.basename(csv_file)}')
        try:
            df = pd.read_csv(csv_file, low_memory=False)
            df = clean_dataframe(df)
            dataframes.append(df)
        except Exception as e:
            logger.warning(f'Failed to load {csv_file}: {e}')
    
    if not dataframes:
        raise ValueError('No valid dataframes loaded')
    
    combined_df = pd.concat(dataframes, ignore_index=True)
    logger.info(f'Total rows loaded: {len(combined_df)}')
    
    return combined_df


# ============================================
# STREAMING LOGIC
# ============================================

def stream_dataset(df: pd.DataFrame, producer: RabbitMQProducer):
    """Stream dataset rows to RabbitMQ at configured interval"""
    global shutdown_requested
    
    interval_seconds = STREAM_INTERVAL_MS / 1000.0
    total_rows = len(df)
    rows_sent = 0
    errors = 0
    
    logger.info(f'Starting stream: {total_rows} rows at {STREAM_INTERVAL_MS}ms interval')
    
    # Shuffle for variety in the stream
    df = df.sample(frac=1).reset_index(drop=True)
    
    for idx, row in df.iterrows():
        if shutdown_requested:
            logger.info('Shutdown requested, stopping stream')
            break
        
        try:
            # Validate and convert row to dict
            row_dict = validate_row(row.to_dict())
            
            if row_dict:
                # Add metadata
                row_dict['_ingestion_timestamp'] = datetime.utcnow().isoformat()
                row_dict['_row_index'] = idx
                
                if producer.publish(row_dict):
                    rows_sent += 1
                else:
                    errors += 1
            
            # Progress logging
            if rows_sent % 100 == 0:
                logger.info(f'Progress: {rows_sent}/{total_rows} rows sent ({errors} errors)')
            
            time.sleep(interval_seconds)
            
        except Exception as e:
            logger.error(f'Error processing row {idx}: {e}')
            errors += 1
    
    logger.info(f'Stream complete: {rows_sent} rows sent, {errors} errors')


# ============================================
# MAIN
# ============================================

def main():
    logger.info('=' * 50)
    logger.info('LogGuard Ingestion Service Starting')
    logger.info('=' * 50)
    
    # Initialize RabbitMQ producer
    producer = RabbitMQProducer(RABBITMQ_URL)
    
    if not producer.connect():
        logger.error('Cannot start without RabbitMQ connection')
        sys.exit(1)
    
    try:
        # Download dataset
        dataset_path = download_dataset()
        
        # Load and clean data
        df = load_dataset(dataset_path)
        
        # Stream continuously (loop for demo purposes)
        while not shutdown_requested:
            stream_dataset(df, producer)
            
            if not shutdown_requested:
                logger.info('Restarting stream from beginning...')
                time.sleep(5)
                
    except KeyboardInterrupt:
        logger.info('Keyboard interrupt received')
    except Exception as e:
        logger.error(f'Fatal error: {e}')
        raise
    finally:
        producer.close()
        logger.info('Ingestion service stopped')


if __name__ == '__main__':
    main()
