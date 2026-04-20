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
# Handle por defecto alineado con el ejemplo de Kaggle Hub; sobreescribe con KAGGLE_DATASET en .env si quieres otro mirror.
KAGGLE_DATASET = os.getenv('KAGGLE_DATASET', 'bertvankeulen/cicids-2017').strip()
# Si está definido y contiene CSV, se omite Kaggle (útil si la API devuelve 403 por reglas/consentimiento).
LOCAL_DATASET_PATH = os.getenv('LOCAL_DATASET_PATH', '').strip()

# Máximo de filas a publicar por cada pasada de stream_dataset (desarrollo / carga acotada).
# Vacío, 0 o inválido = sin tope (comportamiento anterior).
_max_rows_raw = os.getenv('MAX_STREAM_ROWS', '').strip()
MAX_STREAM_ROWS: Optional[int] = None
if _max_rows_raw:
    try:
        _mr = int(_max_rows_raw)
        if _mr > 0:
            MAX_STREAM_ROWS = _mr
    except ValueError:
        pass

# Primeras N filas de cada CSV del dataset (p. ej. 10 por día/archivo); vacío = cargar todo el fichero.
_sample_csv_raw = os.getenv('SAMPLE_ROWS_PER_CSV', '').strip()
SAMPLE_ROWS_PER_CSV: Optional[int] = None
if _sample_csv_raw:
    try:
        _sr = int(_sample_csv_raw)
        if _sr > 0:
            SAMPLE_ROWS_PER_CSV = _sr
    except ValueError:
        pass

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
                
                # Debe coincidir con analytics-engine / otros consumidores (misma firma de cola).
                self.channel.queue_declare(queue='raw_logs', durable=True)
                
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

def ensure_kaggle_credentials() -> None:
    """
    kagglehub >= 0.4 usa el token en KAGGLE_API_TOKEN (Ajustes → API → token tipo KGAT_...).
    Si el .env solo define KAGGLE_KEY con ese prefijo, lo copiamos para que el SDK autentique.
    """
    if os.getenv('KAGGLE_API_TOKEN', '').strip():
        return
    legacy = (os.getenv('KAGGLE_KEY') or '').strip()
    if legacy.startswith('KGAT_'):
        os.environ['KAGGLE_API_TOKEN'] = legacy
        logger.info('KAGGLE_API_TOKEN no estaba definido; usando KAGGLE_KEY (token KGAT_)')


def download_dataset() -> str:
    """Resuelve la ruta del dataset: carpeta local con CSV o descarga vía kagglehub."""
    import glob

    if LOCAL_DATASET_PATH:
        path = os.path.abspath(os.path.expanduser(LOCAL_DATASET_PATH))
        if not os.path.isdir(path):
            raise FileNotFoundError(f'LOCAL_DATASET_PATH no es un directorio: {path}')
        csv_files = glob.glob(os.path.join(path, '**', '*.csv'), recursive=True)
        if not csv_files:
            raise FileNotFoundError(
                f'No hay archivos .csv bajo LOCAL_DATASET_PATH ({path}). '
                'Descarga el dataset desde el navegador (Kaggle) y apunta esta variable a la carpeta descomprimida.'
            )
        logger.info(f'Usando dataset local ({len(csv_files)} CSV), sin llamar a la API de Kaggle: {path}')
        return path

    ensure_kaggle_credentials()
    logger.info(f'Downloading dataset: {KAGGLE_DATASET}')
    try:
        resolved = kagglehub.dataset_download(KAGGLE_DATASET)
        logger.info(f'Dataset downloaded to: {resolved}')
        return resolved
    except Exception as e:
        logger.error(f'Failed to download dataset: {e}')
        raise


def load_dataset(dataset_path: str) -> pd.DataFrame:
    """Load and combine all CSV files from the dataset"""
    import glob

    csv_files = sorted(glob.glob(os.path.join(dataset_path, '**/*.csv'), recursive=True))

    if not csv_files:
        raise FileNotFoundError(f'No CSV files found in {dataset_path}')

    logger.info(f'Found {len(csv_files)} CSV files')

    dataframes = []
    for csv_file in csv_files:
        logger.info(f'Loading: {os.path.basename(csv_file)}')
        try:
            df = pd.read_csv(csv_file, low_memory=False)
            df = clean_dataframe(df)
            if SAMPLE_ROWS_PER_CSV is not None:
                df = df.head(SAMPLE_ROWS_PER_CSV).reset_index(drop=True)
                logger.info(
                    f'  SAMPLE_ROWS_PER_CSV={SAMPLE_ROWS_PER_CSV}: usando las primeras {len(df)} filas de este fichero'
                )
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
    rows_sent = 0
    errors = 0
    skipped_validation = 0
    warned_invalid_keys = False

    # Con muestra por CSV mantenemos orden (primeras filas de cada día); si no, mezclamos.
    if SAMPLE_ROWS_PER_CSV is None:
        df = df.sample(frac=1).reset_index(drop=True)
    if MAX_STREAM_ROWS is not None:
        df = df.head(MAX_STREAM_ROWS).reset_index(drop=True)
        logger.info(f'MAX_STREAM_ROWS active: sending at most {MAX_STREAM_ROWS} rows this pass')

    total_rows = len(df)
    logger.info(f'Starting stream: {total_rows} rows at {STREAM_INTERVAL_MS}ms interval')

    for idx, row in df.iterrows():
        if shutdown_requested:
            logger.info('Shutdown requested, stopping stream')
            break

        try:
            row_dict = validate_row(row.to_dict())

            if row_dict:
                row_dict['_ingestion_timestamp'] = datetime.utcnow().isoformat()
                row_dict['_row_index'] = int(idx)

                if producer.publish(row_dict):
                    rows_sent += 1
                else:
                    errors += 1
            else:
                skipped_validation += 1
                if not warned_invalid_keys:
                    sample_keys = [str(k) for k in list(row.index)[:20]]
                    logger.warning(
                        'Fila rechazada por validate_row (faltan Src IP/Dst IP o vacíos). '
                        'Claves de ejemplo en el CSV: %s',
                        sample_keys,
                    )
                    warned_invalid_keys = True

            if rows_sent > 0 and rows_sent % 100 == 0:
                logger.info(f'Progress: {rows_sent}/{total_rows} rows sent ({errors} errors)')

            time.sleep(interval_seconds)

        except Exception as e:
            logger.error(f'Error processing row {idx}: {e}')
            errors += 1

    if skipped_validation:
        logger.warning(f'Stream complete: {rows_sent} sent, {skipped_validation} filas omitidas (validación), {errors} errors')
    else:
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
        if SAMPLE_ROWS_PER_CSV is not None and MAX_STREAM_ROWS is not None:
            logger.warning(
                'SAMPLE_ROWS_PER_CSV y MAX_STREAM_ROWS activos: tras unir los CSV solo se '
                'publicarán como máximo %s filas por pasada. Para las primeras N por cada '
                'fichero sin recortar el total, deja MAX_STREAM_ROWS vacío en .env.',
                MAX_STREAM_ROWS,
            )

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
