"""
Unit tests for matcher module.
"""

import pytest
import pandas as pd
from app.matcher import (
    parse_sku_to_slot,
    should_exclude_row,
    should_include_row,
    detect_mode,
    match
)


class TestSKUParsing:
    """Test SKU parsing logic."""

    def test_parse_sku_standard_formats(self):
        """Test parsing of common SKU formats."""
        assert parse_sku_to_slot("ITEM-001") == 1
        assert parse_sku_to_slot("ITEM-123") == 123
        assert parse_sku_to_slot("item_12") == 12
        assert parse_sku_to_slot("SLOT:5") == 5
        assert parse_sku_to_slot("#42") == 42
        assert parse_sku_to_slot("123") == 123

    def test_parse_sku_edge_cases(self):
        """Test edge cases in SKU parsing."""
        assert parse_sku_to_slot("") is None
        assert parse_sku_to_slot(None) is None
        assert parse_sku_to_slot("   ") is None
        assert parse_sku_to_slot("NO_NUMBERS") is None
        assert parse_sku_to_slot("ITEM") is None

    def test_parse_sku_multiple_numbers(self):
        """Test SKU with multiple numbers - should extract first."""
        assert parse_sku_to_slot("ITEM-001-2023") == 1
        assert parse_sku_to_slot("12-34") == 12

    def test_parse_sku_with_whitespace(self):
        """Test SKU parsing with whitespace."""
        assert parse_sku_to_slot("  ITEM-5  ") == 5
        assert parse_sku_to_slot("\tITEM-10\n") == 10


class TestExclusionLogic:
    """Test exclusion logic."""

    def test_should_exclude_row_basic(self):
        """Test basic exclusion logic."""
        row = pd.Series({'product name': 'Free Givy Item'})
        assert should_exclude_row(row, ['givy']) is True

        row = pd.Series({'product name': 'Regular Item'})
        assert should_exclude_row(row, ['givy']) is False

    def test_should_exclude_row_case_insensitive(self):
        """Test case-insensitive exclusion."""
        row = pd.Series({'product name': 'SHIPPING FEE'})
        assert should_exclude_row(row, ['shipping']) is True

        row = pd.Series({'product name': 'shipping'})
        assert should_exclude_row(row, ['SHIPPING']) is True

    def test_should_exclude_row_multiple_keywords(self):
        """Test exclusion with multiple keywords."""
        keywords = ['givy', 'shipping', 'tip']

        assert should_exclude_row(
            pd.Series({'product name': 'Givy Item'}),
            keywords
        ) is True

        assert should_exclude_row(
            pd.Series({'product name': 'Shipping Fee'}),
            keywords
        ) is True

        assert should_exclude_row(
            pd.Series({'product name': 'Regular Item'}),
            keywords
        ) is False

    def test_should_exclude_row_empty_keywords(self):
        """Test exclusion with no keywords."""
        row = pd.Series({'product name': 'Any Item'})
        assert should_exclude_row(row, []) is False
        assert should_exclude_row(row, None) is False


class TestInclusionLogic:
    """Test inclusion logic."""

    def test_should_include_row_no_filter(self):
        """Test inclusion with no filter - should include all."""
        row = pd.Series({'product name': 'Any Item'})
        assert should_include_row(row, []) is True
        assert should_include_row(row, None) is True

    def test_should_include_row_with_filter(self):
        """Test inclusion with keywords."""
        keywords = ['pokemon', 'yugioh']

        assert should_include_row(
            pd.Series({'product name': 'Pokemon Card'}),
            keywords
        ) is True

        assert should_include_row(
            pd.Series({'product name': 'YuGiOh Card'}),
            keywords
        ) is True

        assert should_include_row(
            pd.Series({'product name': 'Magic Card'}),
            keywords
        ) is False


class TestModeDetection:
    """Test automatic mode detection."""

    def test_detect_mode_sku(self):
        """Test detection when most rows have valid SKUs."""
        df = pd.DataFrame({
            'sku': ['ITEM-1', 'ITEM-2', 'ITEM-3', 'ITEM-4', 'ITEM-5']
        })
        assert detect_mode(df) == "sku"

    def test_detect_mode_sequence(self):
        """Test detection when most rows lack valid SKUs."""
        df = pd.DataFrame({
            'sku': ['ITEM-1', '', None, 'NO_NUM', '']
        })
        assert detect_mode(df) == "sequence"

    def test_detect_mode_no_sku_column(self):
        """Test detection when SKU column is missing."""
        df = pd.DataFrame({
            'product name': ['Item 1', 'Item 2']
        })
        assert detect_mode(df) == "sequence"

    def test_detect_mode_threshold(self):
        """Test 80% threshold for SKU mode."""
        # Exactly 80% valid SKUs - should use SKU mode
        df = pd.DataFrame({
            'sku': ['ITEM-1', 'ITEM-2', 'ITEM-3', 'ITEM-4', '']
        })
        assert detect_mode(df) == "sku"

        # Below 80% - should use sequence mode
        df = pd.DataFrame({
            'sku': ['ITEM-1', 'ITEM-2', 'ITEM-3', '', '']
        })
        assert detect_mode(df) == "sequence"


class TestSequenceMatching:
    """Test sequence-based matching."""

    def test_sequence_basic(self):
        """Test basic sequence matching."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B', 'Item C']
        })

        matched_df, summary = match(df, mode='sequence', start_slot=1)

        assert list(matched_df['slot']) == [1, 2, 3]
        assert summary['matched'] == 3
        assert summary['mode_used'] == 'sequence'

    def test_sequence_with_exclusions(self):
        """Test sequence matching with exclusions."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Givy Item', 'Item B', 'Item C']
        })

        matched_df, summary = match(
            df,
            mode='sequence',
            start_slot=1,
            exclude_keywords=['givy']
        )

        # Givy item should be excluded and not consume a slot
        slots = matched_df[matched_df['match_method'] == 'sequence']['slot'].tolist()
        assert slots == [1, 2, 3]  # No gap for excluded item
        assert summary['matched'] == 3
        assert summary['excluded'] == 1

    def test_sequence_with_start_slot(self):
        """Test sequence matching with custom start slot."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B']
        })

        matched_df, summary = match(df, mode='sequence', start_slot=10)

        assert list(matched_df['slot']) == [10, 11]

    def test_sequence_with_timestamp_sorting(self):
        """Test sequence matching sorts by timestamp."""
        df = pd.DataFrame({
            'product name': ['Item C', 'Item A', 'Item B'],
            'placed at': ['2024-01-03 10:00', '2024-01-01 10:00', '2024-01-02 10:00']
        })

        matched_df, summary = match(df, mode='sequence', start_slot=1)

        # Should be sorted by timestamp
        sorted_items = matched_df.sort_values('slot')['product name'].tolist()
        assert sorted_items == ['Item A', 'Item B', 'Item C']


class TestSKUMatching:
    """Test SKU-based matching."""

    def test_sku_basic(self):
        """Test basic SKU matching."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B', 'Item C'],
            'sku': ['ITEM-5', 'ITEM-12', 'ITEM-3']
        })

        matched_df, summary = match(df, mode='sku', start_slot=1)

        assert matched_df.iloc[0]['slot'] == 5
        assert matched_df.iloc[1]['slot'] == 12
        assert matched_df.iloc[2]['slot'] == 3
        assert summary['matched'] == 3

    def test_sku_missing(self):
        """Test SKU matching with missing SKUs."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B', 'Item C'],
            'sku': ['ITEM-5', '', 'ITEM-3']
        })

        matched_df, summary = match(df, mode='sku', start_slot=1)

        assert matched_df.iloc[0]['slot'] == 5
        assert pd.isna(matched_df.iloc[1]['slot'])
        assert matched_df.iloc[1]['needs_review'] is True
        assert matched_df.iloc[2]['slot'] == 3
        assert summary['matched'] == 2
        assert summary['needs_review'] == 1

    def test_sku_duplicates(self):
        """Test SKU matching detects duplicates."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B'],
            'sku': ['ITEM-5', 'ITEM-5']
        })

        matched_df, summary = match(df, mode='sku', start_slot=1)

        # Both should be marked as needing review
        assert all(matched_df['needs_review'])
        assert summary['duplicate_slots'] == 1


class TestAutoMode:
    """Test automatic mode selection."""

    def test_auto_selects_sku(self):
        """Test auto mode selects SKU when appropriate."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B', 'Item C', 'Item D', 'Item E'],
            'sku': ['ITEM-1', 'ITEM-2', 'ITEM-3', 'ITEM-4', 'ITEM-5']
        })

        matched_df, summary = match(df, mode='auto')

        assert summary['mode_used'] == 'sku'

    def test_auto_selects_sequence(self):
        """Test auto mode selects sequence when SKUs are missing."""
        df = pd.DataFrame({
            'product name': ['Item A', 'Item B', 'Item C'],
            'sku': ['', '', '']
        })

        matched_df, summary = match(df, mode='auto')

        assert summary['mode_used'] == 'sequence'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
