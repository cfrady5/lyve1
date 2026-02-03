"""
Quick demonstration of the Whatnot Slot Matcher.
Shows both SKU mode and Sequence mode with exclusions.
"""

from app.matcher import load_csv, match, export_csv


def main():
    print("=" * 60)
    print("Whatnot Slot Matcher - Demo")
    print("=" * 60)

    # Load example CSV
    print("\n1. Loading example_orders.csv...")
    with open('example_orders.csv', 'rb') as f:
        file_bytes = f.read()

    df = load_csv(file_bytes)
    print(f"   Loaded {len(df)} rows")
    print("\n   Sample rows:")
    print(df[['product name', 'sku', 'placed at']].head())

    # Demo 1: Auto mode with exclusions
    print("\n" + "=" * 60)
    print("2. Demo: Auto Mode with Exclusions")
    print("=" * 60)
    print("   Excluding: givy, shipping, tip")
    print()

    matched_df, summary = match(
        df.copy(),
        mode='auto',
        start_slot=1,
        exclude_keywords=['givy', 'shipping', 'tip']
    )

    print(f"   Mode used: {summary['mode_used'].upper()}")
    print(f"   Total rows: {summary['total_rows']}")
    print(f"   Matched: {summary['matched']}")
    print(f"   Excluded: {summary['excluded']}")
    print(f"   Needs review: {summary['needs_review']}")
    print(f"   Duplicates: {summary['duplicate_slots']}")

    print("\n   Matched items:")
    matched_items = matched_df[matched_df['match_method'] == 'sku'][
        ['product name', 'slot', 'matched_item_label', 'sku']
    ]
    print(matched_items.to_string(index=False))

    print("\n   Excluded items:")
    excluded_items = matched_df[matched_df['match_method'] == 'excluded'][
        ['product name', 'match_method']
    ]
    print(excluded_items.to_string(index=False))

    # Demo 2: Sequence mode (no SKU)
    print("\n" + "=" * 60)
    print("3. Demo: Sequence Mode (Chronological Order)")
    print("=" * 60)
    print("   Simulating CSV without SKU data")
    print()

    # Remove SKU column to simulate missing SKU data
    df_no_sku = df.copy()
    df_no_sku['sku'] = ''

    matched_df_seq, summary_seq = match(
        df_no_sku,
        mode='sequence',
        start_slot=1,
        exclude_keywords=['givy', 'shipping', 'tip']
    )

    print(f"   Mode used: {summary_seq['mode_used'].upper()}")
    print(f"   Matched: {summary_seq['matched']}")
    print(f"   Excluded: {summary_seq['excluded']}")

    print("\n   Slot assignment (chronological order):")
    seq_items = matched_df_seq[matched_df_seq['match_method'] == 'sequence'][
        ['slot', 'product name', 'placed at']
    ].sort_values('slot')
    print(seq_items.to_string(index=False))

    print("\n   Note: Excluded items don't consume slots.")
    print("   Slots are: 1, 2, 3, 4, 5, 6 (no gaps)")

    # Save outputs
    print("\n" + "=" * 60)
    print("4. Saving Results")
    print("=" * 60)

    csv_bytes = export_csv(matched_df)
    with open('demo_output_sku.csv', 'wb') as f:
        f.write(csv_bytes)
    print("   Saved: demo_output_sku.csv")

    csv_bytes_seq = export_csv(matched_df_seq)
    with open('demo_output_sequence.csv', 'wb') as f:
        f.write(csv_bytes_seq)
    print("   Saved: demo_output_sequence.csv")

    print("\n" + "=" * 60)
    print("Demo Complete!")
    print("=" * 60)
    print("\nKey Takeaways:")
    print("  - SKU mode extracts slot numbers from SKU field")
    print("  - Sequence mode assigns slots chronologically")
    print("  - Exclusions don't consume slot numbers")
    print("  - Auto mode picks the best approach")
    print()


if __name__ == '__main__':
    main()
