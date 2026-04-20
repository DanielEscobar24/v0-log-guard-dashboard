"""
Ingestion Service for CICIDS-2017 Dataset
==========================================
Downloads the dataset using kagglehub, cleans data, and streams
rows to RabbitMQ at 500ms intervals to simulate live network traffic.
"""

import os
import json
import time
import logging
from typing import Generator, Dict, Any

import kagglehub
import pandas as pd
import pika
from pika.exceptions import AMQPConnectionError
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ingestion-service')

# Environment configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'admin')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'logguard_secret')
STREAM_INTERVAL_MS = int(os.getenv('STREAM_INTERVAL_MS', 500))
QUEUE_NAME = 'raw_logs'

# CICIDS-2017 column mapping (original column names have leading/trailing spaces)
COLUMN_MAPPING = {
    ' Source IP': 'source_ip',
    ' Destination IP': 'destination_ip',
    ' Source Port': 'source_port',
    ' Destination Port': 'destination_port',
    ' Protocol': 'protocol',
    ' Timestamp': 'timestamp',
    ' Flow Duration': 'flow_duration',
    ' Total Fwd Packets': 'total_fwd_packets',
    ' Total Backward Packets': 'total_bwd_packets',
    'Total Length of Fwd Packets': 'total_length_fwd',
    ' Total Length of Bwd Packets': 'total_length_bwd',
    ' Fwd Packet Length Max': 'fwd_packet_length_max',
    ' Fwd Packet Length Min': 'fwd_packet_length_min',
    ' Fwd Packet Length Mean': 'fwd_packet_length_mean',
    ' Bwd Packet Length Max': 'bwd_packet_length_max',
    ' Bwd Packet Length Min': 'bwd_packet_length_min',
    ' Bwd Packet Length Mean': 'bwd_packet_length_mean',
    ' Flow Bytes/s': 'flow_bytes_per_sec',
    ' Flow Packets/s': 'flow_packets_per_sec',
    ' Flow IAT Mean': 'flow_iat_mean',
    ' Flow IAT Std': 'flow_iat_std',
    ' Flow IAT Max': 'flow_iat_max',
    ' Flow IAT Min': 'flow_iat_min',
    ' Fwd IAT Total': 'fwd_iat_total',
    ' Fwd IAT Mean': 'fwd_iat_mean',
    ' Fwd IAT Std': 'fwd_iat_std',
    ' Fwd IAT Max': 'fwd_iat_max',
    ' Fwd IAT Min': 'fwd_iat_min',
    ' Bwd IAT Total': 'bwd_iat_total',
    ' Bwd IAT Mean': 'bwd_iat_mean',
    ' Bwd IAT Std': 'bwd_iat_std',
    ' Bwd IAT Max': 'bwd_iat_max',
    ' Bwd IAT Min': 'bwd_iat_min',
    'Fwd PSH Flags': 'fwd_psh_flags',
    ' Bwd PSH Flags': 'bwd_psh_flags',
    ' Fwd URG Flags': 'fwd_urg_flags',
    ' Bwd URG Flags': 'bwd_urg_flags',
    ' Fwd Header Length': 'fwd_header_length',
    ' Bwd Header Length': 'bwd_header_length',
    ' Fwd Packets/s': 'fwd_packets_per_sec',
    ' Bwd Packets/s': 'bwd_packets_per_sec',
    ' Min Packet Length': 'min_packet_length',
    ' Max Packet Length': 'max_packet_length',
    ' Packet Length Mean': 'packet_length_mean',
    ' Packet Length Std': 'packet_length_std',
    ' Packet Length Variance': 'packet_length_variance',
    'FIN Flag Count': 'fin_flag_count',
    ' SYN Flag Count': 'syn_flag_count',
    ' RST Flag Count': 'rst_flag_count',
    ' PSH Flag Count': 'psh_flag_count',
    ' ACK Flag Count': 'ack_flag_count',
    ' URG Flag Count': 'urg_flag_count',
    ' CWE Flag Count': 'cwe_flag_count',
    ' ECE Flag Count': 'ece_flag_count',
    ' Down/Up Ratio': 'down_up_ratio',
    ' Average Packet Size': 'avg_packet_size',
    ' Avg Fwd Segment Size': 'avg_fwd_segment_size',
    ' Avg Bwd Segment Size': 'avg_bwd_segment_size',
    ' Fwd Header Length.1': 'fwd_header_length_1',
    'Fwd Avg Bytes/Bulk': 'fwd_avg_bytes_bulk',
    ' Fwd Avg Packets/Bulk': 'fwd_avg_packets_bulk',
    ' Fwd Avg Bulk Rate': 'fwd_avg_bulk_rate',
    ' Bwd Avg Bytes/Bulk': 'bwd_avg_bytes_bulk',
    ' Bwd Avg Packets/Bulk': 'bwd_avg_packets_bulk',
    'Bwd Avg Bulk Rate': 'bwd_avg_bulk_rate',
    'Subflow Fwd Packets': 'subflow_fwd_packets',
    ' Subflow Fwd Bytes': 'subflow_fwd_bytes',
    ' Subflow Bwd Packets': 'subflow_bwd_packets',
    ' Subflow Bwd Bytes': 'subflow_bwd_bytes',
    'Init_Win_bytes_forward': 'init_win_bytes_fwd',
    ' Init_Win_bytes_backward': 'init_win_bytes_bwd',
    ' act_data_pkt_fwd': 'act_data_pkt_fwd',
    ' min_seg_size_forward': 'min_seg_size_fwd',
    'Active Mean': 'active_mean',
    ' Active Std': 'active_std',
    ' Active Max': 'active_max',
    ' Active Min': 'active_min',
    'Idle Mean': 'idle_mean',
    ' Idle Std': 'idle_std',
    ' Idle Max': 'idle_max',
    ' Idle Min': 'idle_min',
    ' Label': 'label'
}


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
            logger.warning(f"Connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                raise


def download_dataset() -> str:
    """Download CICIDS-2017 dataset using kagglehub."""
    logger.info("Downloading CICIDS-2017 dataset from Kaggle...")
    try:
        # Download the dataset - returns path to downloaded files
        path = kagglehub.dataset_download("ciaborges/cicids2017")
        logger.info(f"Dataset downloaded to: {path}")
        return path
    except Exception as e:
        logger.error(f"Failed to download dataset: {e}")
        raise


def clean_value(value: Any) -> Any:
    """Clean individual values - handle NaN, Inf, and type conversion."""
    if pd.isna(value):
        return None
    if isinstance(value, (float, np.floating)):
        if np.isinf(value):
            return None
        return float(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    return str(value).strip()


def stream_csv_chunks(dataset_path: str, chunk_size: int = 1000) -> Generator[Dict[str, Any], None, None]:
    """
    Stream CSV files from dataset in chunks.
    Yields one cleaned row at a time.
    """
    import glob
    
    # Find all CSV files in the dataset
    csv_files = glob.glob(os.path.join(dataset_path, "**/*.csv"), recursive=True)
    
    if not csv_files:
        logger.error(f"No CSV files found in {dataset_path}")
        raise FileNotFoundError(f"No CSV files found in {dataset_path}")
    
    logger.info(f"Found {len(csv_files)} CSV files to process")
    
    for csv_file in csv_files:
        logger.info(f"Processing file: {csv_file}")
        
        try:
            # Read CSV in chunks to avoid loading entire file into memory
            for chunk_idx, chunk in enumerate(pd.read_csv(
                csv_file,
                chunksize=chunk_size,
                low_memory=False,
                encoding='utf-8',
                on_bad_lines='skip'
            )):
                # Clean column names (strip whitespace)
                chunk.columns = chunk.columns.str.strip()
                
                # Also try to rename columns that still have leading spaces
                rename_map = {}
                for col in chunk.columns:
                    # Check if column exists in mapping with or without leading space
                    if f' {col}' in COLUMN_MAPPING:
                        rename_map[col] = COLUMN_MAPPING[f' {col}']
                    elif col in COLUMN_MAPPING:
                        rename_map[col] = COLUMN_MAPPING[col]
                
                chunk.rename(columns=rename_map, inplace=True)
                
                # Replace infinite values with NaN
                chunk.replace([np.inf, -np.inf], np.nan, inplace=True)
                
                # Yield each row as a cleaned dictionary
                for _, row in chunk.iterrows():
                    cleaned_row = {
                        key: clean_value(value)
                        for key, value in row.to_dict().items()
                    }
                    yield cleaned_row
                    
                if chunk_idx % 10 == 0:
                    logger.info(f"Processed chunk {chunk_idx} from {os.path.basename(csv_file)}")
                    
        except Exception as e:
            logger.error(f"Error processing {csv_file}: {e}")
            continue


def publish_to_queue(channel: pika.channel.Channel, row_data: Dict[str, Any]) -> bool:
    """Publish a single row to the RabbitMQ queue."""
    try:
        message = json.dumps(row_data, default=str)
        channel.basic_publish(
            exchange='',
            routing_key=QUEUE_NAME,
            body=message,
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
                content_type='application/json'
            )
        )
        return True
    except Exception as e:
        logger.error(f"Failed to publish message: {e}")
        return False


def main():
    """Main entry point for the ingestion service."""
    logger.info("Starting Ingestion Service...")
    
    # Download dataset
    dataset_path = download_dataset()
    
    # Connect to RabbitMQ
    connection = connect_to_rabbitmq()
    channel = connection.channel()
    
    # Declare the queue
    channel.queue_declare(queue=QUEUE_NAME, durable=True)
    logger.info(f"Queue '{QUEUE_NAME}' declared")
    
    # Stream and publish rows
    row_count = 0
    interval_seconds = STREAM_INTERVAL_MS / 1000.0
    
    try:
        for row in stream_csv_chunks(dataset_path):
            if publish_to_queue(channel, row):
                row_count += 1
                
                if row_count % 100 == 0:
                    logger.info(f"Published {row_count} rows to queue")
                
                # Simulate live traffic with configurable delay
                time.sleep(interval_seconds)
                
    except KeyboardInterrupt:
        logger.info("Ingestion service interrupted by user")
    except Exception as e:
        logger.error(f"Error during streaming: {e}")
        raise
    finally:
        logger.info(f"Total rows published: {row_count}")
        connection.close()
        logger.info("Connection closed")


if __name__ == "__main__":
    main()
