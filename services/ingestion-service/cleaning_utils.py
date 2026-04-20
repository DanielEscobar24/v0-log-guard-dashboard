"""
Cleaning utilities for CICIDS-2017 dataset
Handles NaN values, infinite values, and data validation
"""

import socket
import struct

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional


# CICIDS-2017 expected columns (cleaned version)
EXPECTED_COLUMNS = [
    'Flow ID', 'Src IP', 'Src Port', 'Dst IP', 'Dst Port', 'Protocol',
    'Timestamp', 'Flow Duration', 'Total Fwd Packets', 'Total Bwd Packets',
    'Total Length of Fwd Packets', 'Total Length of Bwd Packets',
    'Fwd Packet Length Max', 'Fwd Packet Length Min', 'Fwd Packet Length Mean',
    'Fwd Packet Length Std', 'Bwd Packet Length Max', 'Bwd Packet Length Min',
    'Bwd Packet Length Mean', 'Bwd Packet Length Std', 'Flow Bytes/s',
    'Flow Packets/s', 'Flow IAT Mean', 'Flow IAT Std', 'Flow IAT Max',
    'Flow IAT Min', 'Fwd IAT Total', 'Fwd IAT Mean', 'Fwd IAT Std',
    'Fwd IAT Max', 'Fwd IAT Min', 'Bwd IAT Total', 'Bwd IAT Mean',
    'Bwd IAT Std', 'Bwd IAT Max', 'Bwd IAT Min', 'Fwd PSH Flags',
    'Bwd PSH Flags', 'Fwd URG Flags', 'Bwd URG Flags', 'Fwd Header Length',
    'Bwd Header Length', 'Fwd Packets/s', 'Bwd Packets/s', 'Packet Length Min',
    'Packet Length Max', 'Packet Length Mean', 'Packet Length Std',
    'Packet Length Variance', 'FIN Flag Count', 'SYN Flag Count',
    'RST Flag Count', 'PSH Flag Count', 'ACK Flag Count', 'URG Flag Count',
    'CWE Flag Count', 'ECE Flag Count', 'Down/Up Ratio', 'Avg Packet Size',
    'Avg Fwd Segment Size', 'Avg Bwd Segment Size', 'Fwd Header Length.1',
    'Fwd Avg Bytes/Bulk', 'Fwd Avg Packets/Bulk', 'Fwd Avg Bulk Rate',
    'Bwd Avg Bytes/Bulk', 'Bwd Avg Packets/Bulk', 'Bwd Avg Bulk Rate',
    'Subflow Fwd Packets', 'Subflow Fwd Bytes', 'Subflow Bwd Packets',
    'Subflow Bwd Bytes', 'Init Fwd Win Bytes', 'Init Bwd Win Bytes',
    'Fwd Act Data Packets', 'Fwd Seg Size Min', 'Active Mean', 'Active Std',
    'Active Max', 'Active Min', 'Idle Mean', 'Idle Std', 'Idle Max',
    'Idle Min', 'Label'
]

# Columns that should be numeric
NUMERIC_COLUMNS = [
    'Src Port', 'Dst Port', 'Protocol', 'Flow Duration',
    'Total Fwd Packets', 'Total Bwd Packets',
    'Total Length of Fwd Packets', 'Total Length of Bwd Packets',
    'Flow Bytes/s', 'Flow Packets/s', 'Packet Length Min',
    'Packet Length Max', 'Packet Length Mean'
]


def canonicalize_cicids_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    bertvankeulen/cicids-2017 y otros CSV usan nombres distintos a los del mirror 'cleaned'
    (p. ej. Src IP dec, Total Fwd Packet). Los alineamos con lo que esperan validate_row y analytics.
    """
    pairs = [
        ('Src IP dec', 'Src IP'),
        ('Dst IP dec', 'Dst IP'),
        ('Source IP', 'Src IP'),
        ('Destination IP', 'Dst IP'),
        ('Source Port', 'Src Port'),
        ('Destination Port', 'Dst Port'),
        ('Total Fwd Packet', 'Total Fwd Packets'),
        ('Total Bwd packets', 'Total Bwd Packets'),
        ('Total Bwd Packet', 'Total Bwd Packets'),
        ('Total Length of Fwd Packet', 'Total Length of Fwd Packets'),
        ('Total Length of Bwd Packet', 'Total Length of Bwd Packets'),
    ]
    renames = {o: n for o, n in pairs if o in df.columns and n not in df.columns}
    if renames:
        df = df.rename(columns=renames)
    return df


def materialize_decimal_ipv4_columns(df: pd.DataFrame) -> pd.DataFrame:
    """bertvankeulen CSV guarda IPv4 como entero 32-bit; lo pasamos a string dotted-quad."""
    for col in ('Src IP', 'Dst IP'):
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue

        def to_dotted(v: Any) -> Any:
            if pd.isna(v):
                return v
            try:
                n = int(float(v)) & 0xFFFFFFFF
                return socket.inet_ntoa(struct.pack('!I', n))
            except (ValueError, OSError, struct.error, TypeError, OverflowError):
                return str(v)

        df[col] = df[col].map(to_dotted)
    return df


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean the dataframe by handling NaN and infinite values
    
    Args:
        df: Raw pandas DataFrame
        
    Returns:
        Cleaned DataFrame
    """
    # Strip whitespace from column names
    df.columns = df.columns.str.strip()
    df = canonicalize_cicids_column_names(df)
    df = materialize_decimal_ipv4_columns(df)

    # Replace infinite values with NaN first
    df = df.replace([np.inf, -np.inf], np.nan)
    
    # For numeric columns, fill NaN with 0 or median
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        if df[col].isna().any():
            # Use 0 for count-based columns, median for others
            if 'Count' in col or 'Packets' in col or 'Flags' in col:
                df[col] = df[col].fillna(0)
            else:
                median_val = df[col].median()
                df[col] = df[col].fillna(median_val if pd.notna(median_val) else 0)
    
    # For string columns, fill NaN with empty string or 'Unknown'
    string_cols = df.select_dtypes(include=['object']).columns
    
    for col in string_cols:
        if col == 'Label':
            df[col] = df[col].fillna('BENIGN')
        else:
            df[col] = df[col].fillna('Unknown')
    
    # Ensure numeric types are correct
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # Remove any remaining rows with critical NaN values
    critical_cols = ['Src IP', 'Dst IP', 'Label']
    existing_critical = [c for c in critical_cols if c in df.columns]
    if existing_critical:
        df = df.dropna(subset=existing_critical)
    
    return df


def validate_row(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Validate and clean a single row dictionary
    
    Args:
        row: Dictionary representing a single row
        
    Returns:
        Cleaned row dict or None if invalid
    """
    try:
        cleaned = {}
        
        for key, value in row.items():
            # Clean the key
            clean_key = str(key).strip()
            
            # Handle NaN/None values
            if pd.isna(value) or value is None:
                if clean_key == 'Label':
                    cleaned[clean_key] = 'BENIGN'
                elif clean_key in ['Src IP', 'Dst IP']:
                    return None  # Critical field missing
                else:
                    cleaned[clean_key] = 0 if clean_key in NUMERIC_COLUMNS else ''
                continue
            
            # Handle infinite values
            if isinstance(value, float) and (np.isinf(value) or np.isnan(value)):
                cleaned[clean_key] = 0
                continue
            
            # Handle numpy types
            if hasattr(value, 'item'):
                value = value.item()
            
            # Convert numpy int/float to Python native types
            if isinstance(value, (np.integer, np.floating)):
                value = value.item()
            
            cleaned[clean_key] = value
        
        # Validate critical fields exist
        if not cleaned.get('Src IP') or not cleaned.get('Dst IP'):
            return None
        
        return cleaned
        
    except Exception:
        return None


def map_protocol(protocol_num: int) -> str:
    """Map protocol number to name"""
    protocols = {
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
    return protocols.get(int(protocol_num), f'OTHER({protocol_num})')


def normalize_label(label: str) -> str:
    """Normalize attack labels to consistent format"""
    label = str(label).strip().upper()
    
    # Map various label formats to consistent names
    label_mapping = {
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
    
    return label_mapping.get(label, label.title())
