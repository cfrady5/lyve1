"""
Core matching logic for Whatnot Slot Matcher.
Handles SKU-based and sequence-based slot assignment.
"""

import re
from io import BytesIO
from typing import Tuple, Dict, List, Optional
import pandas as pd


def load_csv(file_bytes: bytes) -> pd.DataFrame:
    """
    Load CSV from bytes into a DataFrame.

    Args:
        file_bytes: Raw CSV file bytes

    Returns:
        DataFrame with loaded CSV data

    Raises:
        ValueError: If CSV is invalid or empty
    """
    try:
        df = pd.read_csv(BytesIO(file_bytes))
        if df.empty:
            raise ValueError("CSV file is empty")
        return df
    except Exception as e:
        raise ValueError(f"Failed to load CSV: {str(e)}")


def parse_sku_to_slot(sku: str) -> Optional[int]:
    """
    Extract slot number from SKU string.

    Supports formats:
    - "ITEM-001" -> 1
    - "item_12" -> 12
    - "SLOT:5" -> 5
    - "#42" -> 42
    - "123" -> 123

    Args:
        sku: SKU string to parse

    Returns:
        Slot number as integer, or None if no valid number found
    """
    if not sku or pd.isna(sku):
        return None

    # Convert to string and strip whitespace
    sku_str = str(sku).strip()
    if not sku_str:
        return None

    # Try to extract first integer from the string
    match = re.search(r'\d+', sku_str)
    if match:
        return int(match.group())

    return None


def should_exclude_row(row: pd.Series, exclude_keywords: List[str]) -> bool:
    """
    Check if a row should be excluded based on keywords.

    Args:
        row: DataFrame row to check
        exclude_keywords: List of keywords to check against

    Returns:
        True if row should be excluded, False otherwise
    """
    if not exclude_keywords:
        return False

    # Check product name column (case-insensitive)
    product_name = str(row.get('product name', '')).lower()

    for keyword in exclude_keywords:
        if keyword.lower() in product_name:
            return True

    return False


def should_include_row(row: pd.Series, include_keywords: List[str]) -> bool:
    """
    Check if a row matches include keywords (if provided).

    Args:
        row: DataFrame row to check
        include_keywords: List of keywords that must be present (empty = include all)

    Returns:
        True if row should be included, False otherwise
    """
    if not include_keywords:
        return True  # No filter means include all

    # Check product name column (case-insensitive)
    product_name = str(row.get('product name', '')).lower()

    for keyword in include_keywords:
        if keyword.lower() in product_name:
            return True

    return False


def detect_mode(df: pd.DataFrame) -> str:
    """
    Detect whether to use SKU or Sequence mode based on data quality.

    Args:
        df: DataFrame to analyze

    Returns:
        "sku" if >= 80% of rows have valid SKU, "sequence" otherwise
    """
    if 'sku' not in df.columns:
        return "sequence"

    # Count non-empty SKUs that can be parsed to slots
    valid_skus = df['sku'].apply(lambda x: parse_sku_to_slot(x) is not None).sum()
    total_rows = len(df)

    if total_rows == 0:
        return "sequence"

    sku_ratio = valid_skus / total_rows
    return "sku" if sku_ratio >= 0.8 else "sequence"


def match(
    df: pd.DataFrame,
    mode: str = "auto",
    start_slot: int = 1,
    exclude_keywords: Optional[List[str]] = None,
    include_keywords: Optional[List[str]] = None
) -> Tuple[pd.DataFrame, Dict]:
    """
    Match CSV rows to inventory slots.

    Args:
        df: Input DataFrame with order data
        mode: Matching mode - "auto", "sku", or "sequence"
        start_slot: Starting slot number (default: 1)
        exclude_keywords: Keywords to exclude from matching (e.g., ["givy", "shipping"])
        include_keywords: Keywords that must be present (empty = include all)

    Returns:
        Tuple of (matched_df, summary_dict) where:
        - matched_df: DataFrame with slot assignments and metadata
        - summary_dict: Statistics about the matching process
    """
    if df.empty:
        raise ValueError("DataFrame is empty")

    # Normalize keyword lists
    exclude_keywords = [k.strip() for k in (exclude_keywords or [])] if exclude_keywords else []
    include_keywords = [k.strip() for k in (include_keywords or [])] if include_keywords else []

    # Detect mode if auto
    if mode == "auto":
        mode = detect_mode(df)

    if mode not in ["sku", "sequence"]:
        raise ValueError(f"Invalid mode: {mode}. Must be 'auto', 'sku', or 'sequence'")

    # Initialize output columns
    df = df.copy()
    df['slot'] = None
    df['matched_item_label'] = None
    df['match_method'] = None
    df['needs_review'] = False
    df['review_reason'] = ''

    # Track statistics
    total_rows = len(df)
    excluded_count = 0
    matched_count = 0
    needs_review_count = 0
    slot_usage = {}

    if mode == "sku":
        # SKU-based matching
        for idx, row in df.iterrows():
            # Check exclusions first
            if should_exclude_row(row, exclude_keywords):
                df.at[idx, 'match_method'] = 'excluded'
                excluded_count += 1
                continue

            # Check inclusions
            if not should_include_row(row, include_keywords):
                df.at[idx, 'match_method'] = 'excluded'
                excluded_count += 1
                continue

            # Try to parse SKU
            sku = row.get('sku')
            slot_num = parse_sku_to_slot(sku)

            if slot_num is None:
                df.at[idx, 'match_method'] = 'manual_review'
                df.at[idx, 'needs_review'] = True
                df.at[idx, 'review_reason'] = 'sku_missing_or_invalid'
                needs_review_count += 1
            else:
                df.at[idx, 'slot'] = slot_num
                df.at[idx, 'matched_item_label'] = f"Item #{slot_num}"
                df.at[idx, 'match_method'] = 'sku'
                matched_count += 1

                # Track slot usage for duplicate detection
                if slot_num in slot_usage:
                    slot_usage[slot_num].append(idx)
                else:
                    slot_usage[slot_num] = [idx]

    else:  # sequence mode
        # Sort by timestamp if available, otherwise preserve file order
        if 'placed at' in df.columns:
            # Try to parse as datetime
            try:
                df['_sort_key'] = pd.to_datetime(df['placed at'], errors='coerce')
                df = df.sort_values('_sort_key')
            except:
                # Fall back to original order
                pass

        current_slot = start_slot

        for idx, row in df.iterrows():
            # Check exclusions first
            if should_exclude_row(row, exclude_keywords):
                df.at[idx, 'match_method'] = 'excluded'
                excluded_count += 1
                continue

            # Check inclusions
            if not should_include_row(row, include_keywords):
                df.at[idx, 'match_method'] = 'excluded'
                excluded_count += 1
                continue

            # Assign sequential slot
            df.at[idx, 'slot'] = current_slot
            df.at[idx, 'matched_item_label'] = f"Item #{current_slot}"
            df.at[idx, 'match_method'] = 'sequence'
            matched_count += 1

            # Track slot usage
            if current_slot in slot_usage:
                slot_usage[current_slot].append(idx)
            else:
                slot_usage[current_slot] = [idx]

            current_slot += 1

    # Detect duplicate slots
    duplicate_count = 0
    for slot_num, indices in slot_usage.items():
        if len(indices) > 1:
            duplicate_count += 1
            for idx in indices:
                df.at[idx, 'needs_review'] = True
                existing_reason = df.at[idx, 'review_reason']
                df.at[idx, 'review_reason'] = (
                    f"{existing_reason}; duplicate_slot" if existing_reason
                    else "duplicate_slot"
                )
                if df.at[idx, 'match_method'] != 'manual_review':
                    needs_review_count += 1

    # Build summary
    summary = {
        'total_rows': total_rows,
        'matched': matched_count,
        'excluded': excluded_count,
        'needs_review': needs_review_count,
        'duplicate_slots': duplicate_count,
        'mode_used': mode,
        'start_slot': start_slot,
        'exclude_keywords': exclude_keywords,
        'include_keywords': include_keywords,
    }

    return df, summary


def export_csv(df: pd.DataFrame) -> bytes:
    """
    Export DataFrame to CSV bytes.

    Args:
        df: DataFrame to export

    Returns:
        CSV data as bytes
    """
    output = BytesIO()
    df.to_csv(output, index=False)
    return output.getvalue()
