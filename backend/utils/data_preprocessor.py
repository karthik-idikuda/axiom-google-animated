"""CSV loading, encoding, and preprocessing utilities.

Used by CARTOGRAPHER to prepare a dataset for DirectLiNGAM.
All logic is stateless — pass in a DataFrame, get back a cleaned DataFrame
plus the encoding map needed to recover original column names/values.
"""
from __future__ import annotations

import io
import logging
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler

log = logging.getLogger("axiom.preprocessor")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_csv_bytes(raw: bytes) -> pd.DataFrame:
    """Parse CSV bytes into a DataFrame."""
    return pd.read_csv(io.BytesIO(raw))


def load_csv_path(path: str) -> pd.DataFrame:
    """Load a local CSV file into a DataFrame."""
    return pd.read_csv(path)


def preprocess(
    df: pd.DataFrame,
    *,
    nan_threshold: float = 0.30,
) -> Tuple[pd.DataFrame, Dict]:
    """Clean and encode a DataFrame for causal discovery.

    Args:
        df: Raw input DataFrame.
        nan_threshold: Drop rows where fraction of NaN exceeds this value.

    Returns:
        (df_numeric, encoding_map) where:
          df_numeric   — fully numeric DataFrame ready for LiNGAM
          encoding_map — {"col_name": {"classes": [...], "dtype": "category"}, ...}
                         Only set for columns that were label-encoded.
    """
    df = df.copy()

    # 1. Drop rows with too many NaN values
    row_nan_frac = df.isnull().mean(axis=1)
    before = len(df)
    df = df[row_nan_frac <= nan_threshold].reset_index(drop=True)
    log.info("Dropped %d rows with > %.0f%% NaN", before - len(df), nan_threshold * 100)

    # 2. Fill remaining NaN: mode for categoricals, median for numerics
    for col in df.columns:
        if df[col].isnull().any():
            if df[col].dtype == object or str(df[col].dtype) == "category":
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "unknown")
            else:
                df[col] = df[col].fillna(df[col].median())

    # 3. Strip whitespace from string columns
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].str.strip()

    # 4. Label-encode all categorical columns
    encoding_map: Dict = {}
    le = LabelEncoder()
    for col in df.select_dtypes(include=["object", "category"]).columns:
        df[col] = le.fit_transform(df[col].astype(str))
        encoding_map[col] = {
            "dtype": "category",
            "classes": le.classes_.tolist(),
        }

    # 5. Standardize numeric columns (helps LiNGAM convergence)
    scaler = StandardScaler()
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    df[numeric_cols] = scaler.fit_transform(df[numeric_cols])

    log.info(
        "Preprocessed %d rows × %d cols — %d categorical cols encoded",
        len(df), len(df.columns), len(encoding_map),
    )
    return df, encoding_map


def adjacency_to_edges(
    matrix: np.ndarray,
    col_names: List[str],
    protected_attrs: List[str],
    weight_threshold: float = 0.10,
) -> List[Dict]:
    """Convert LiNGAM adjacency matrix to a frontend-ready edge list.

    Only includes edges where |weight| > weight_threshold.
    Marks edges where source is a protected attribute as biased_edge=True.
    """
    edges = []
    n = matrix.shape[0]
    # DirectLiNGAM convention: matrix[child_index, parent_index] = parent -> child.
    for child_idx in range(n):
        for parent_idx in range(n):
            w = float(matrix[child_idx, parent_idx])
            if abs(w) > weight_threshold:
                edges.append({
                    "source": col_names[parent_idx],
                    "target": col_names[child_idx],
                    "weight": round(w, 4),
                    "biased_edge": col_names[parent_idx] in protected_attrs,
                })
    return edges
