"""
CLI interface for Whatnot Slot Matcher.
"""

import argparse
import sys
from pathlib import Path
from app.matcher import load_csv, match, export_csv


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Whatnot Slot Matcher - Assign inventory slots to orders",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-detect mode and match
  whatnot-matcher --in orders.csv --out matched.csv

  # Use SKU mode with exclusions
  whatnot-matcher --in orders.csv --out matched.csv --mode sku --exclude "givy,shipping,tip"

  # Use sequence mode starting at slot 5
  whatnot-matcher --in orders.csv --out matched.csv --mode sequence --start-slot 5
        """
    )

    parser.add_argument(
        '--in',
        dest='input_file',
        required=True,
        help='Input CSV file path'
    )

    parser.add_argument(
        '--out',
        dest='output_file',
        required=True,
        help='Output CSV file path'
    )

    parser.add_argument(
        '--mode',
        choices=['auto', 'sku', 'sequence'],
        default='auto',
        help='Matching mode (default: auto)'
    )

    parser.add_argument(
        '--start-slot',
        type=int,
        default=1,
        help='Starting slot number (default: 1)'
    )

    parser.add_argument(
        '--exclude',
        type=str,
        default='',
        help='Comma-separated keywords to exclude (e.g., "givy,shipping,tip")'
    )

    parser.add_argument(
        '--include',
        type=str,
        default='',
        help='Comma-separated keywords to include (optional)'
    )

    args = parser.parse_args()

    try:
        # Check input file exists
        input_path = Path(args.input_file)
        if not input_path.exists():
            print(f"Error: Input file not found: {args.input_file}", file=sys.stderr)
            sys.exit(1)

        # Load CSV
        print(f"Loading CSV from {args.input_file}...")
        with open(input_path, 'rb') as f:
            file_bytes = f.read()

        df = load_csv(file_bytes)
        print(f"Loaded {len(df)} rows")

        # Parse keywords
        exclude_keywords = [k.strip() for k in args.exclude.split(',') if k.strip()]
        include_keywords = [k.strip() for k in args.include.split(',') if k.strip()]

        # Match
        print(f"Matching with mode={args.mode}, start_slot={args.start_slot}...")
        matched_df, summary = match(
            df,
            mode=args.mode,
            start_slot=args.start_slot,
            exclude_keywords=exclude_keywords,
            include_keywords=include_keywords
        )

        # Print summary
        print("\nMatching Summary:")
        print(f"  Total rows:       {summary['total_rows']}")
        print(f"  Matched:          {summary['matched']}")
        print(f"  Excluded:         {summary['excluded']}")
        print(f"  Needs review:     {summary['needs_review']}")
        print(f"  Duplicate slots:  {summary['duplicate_slots']}")
        print(f"  Mode used:        {summary['mode_used']}")

        # Export
        print(f"\nWriting output to {args.output_file}...")
        output_bytes = export_csv(matched_df)
        with open(args.output_file, 'wb') as f:
            f.write(output_bytes)

        print("Done!")

        # Exit with error code if there are items needing review
        if summary['needs_review'] > 0:
            print(
                f"\nWarning: {summary['needs_review']} items need manual review. "
                "Check the 'needs_review' column in the output.",
                file=sys.stderr
            )
            sys.exit(2)

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
