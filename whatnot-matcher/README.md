# Whatnot Slot Matcher

A production-ready tool for matching Whatnot order CSV exports to pre-assigned inventory slots.

## Features

- **Smart Matching Modes**:
  - **SKU Mode**: Parse SKU fields to extract slot numbers (supports formats like `ITEM-001`, `#42`, `SLOT:5`)
  - **Sequence Mode**: Assign slots chronologically based on order timestamps
  - **Auto Mode**: Automatically detect the best mode based on data quality

- **Flexible Filtering**:
  - Exclude items by keywords (e.g., giveaways, shipping fees)
  - Include only specific items by keywords (optional)
  - Excluded items don't consume slot numbers

- **Data Quality**:
  - Detect duplicate slot assignments
  - Flag items needing manual review
  - Comprehensive matching summary

- **Dual Interface**:
  - Clean web UI with drag-and-drop
  - CLI for automation and scripting

## Installation

### Prerequisites

- Python 3.8 or higher
- pip

### Setup

1. Clone or download this repository
2. Install dependencies:

```bash
cd whatnot-matcher
pip install -r requirements.txt
```

## Usage

### Web UI

1. Start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. Open your browser to `http://localhost:8000`

3. Upload your CSV, configure options, and click "Match Slots"

4. Review the preview and download the matched CSV

### CLI

Basic usage:

```bash
python -m app.cli --in orders.csv --out matched.csv
```

With options:

```bash
python -m app.cli \
  --in orders.csv \
  --out matched.csv \
  --mode auto \
  --start-slot 1 \
  --exclude "givy,shipping,tip"
```

Full CLI options:

```
--in INPUT_FILE         Input CSV file path (required)
--out OUTPUT_FILE       Output CSV file path (required)
--mode {auto,sku,sequence}  Matching mode (default: auto)
--start-slot N          Starting slot number (default: 1)
--exclude KEYWORDS      Comma-separated keywords to exclude
--include KEYWORDS      Comma-separated keywords to include (optional)
```

## Matching Modes

### Auto Mode (Recommended)

Automatically selects the best mode:
- If 80%+ of rows have valid SKUs → use SKU mode
- Otherwise → use Sequence mode

```bash
python -m app.cli --in orders.csv --out matched.csv --mode auto
```

### SKU Mode

Extracts slot numbers from the SKU field. Supports formats:
- `ITEM-001` → Slot 1
- `item_12` → Slot 12
- `SLOT:5` → Slot 5
- `#42` → Slot 42
- `123` → Slot 123

If SKU is missing or invalid, the item is flagged for manual review.

```bash
python -m app.cli --in orders.csv --out matched.csv --mode sku
```

### Sequence Mode

Assigns slots based on chronological order:
1. Sorts by "placed at" timestamp (if available)
2. Falls back to file order if timestamp missing
3. Assigns sequential slot numbers starting from `--start-slot`
4. Excluded items don't consume slots

```bash
python -m app.cli --in orders.csv --out matched.csv --mode sequence --start-slot 1
```

## CSV Requirements

### Required Columns

- **product name**: Used for keyword filtering

### Optional Columns (Mode-Dependent)

- **sku**: Required for SKU mode (can be empty for Sequence mode)
- **placed at**: Used for chronological sorting in Sequence mode

### Example CSV

```csv
product name,sku,placed at,price
Pokemon Card,ITEM-001,2024-01-15 10:00,25.00
YuGiOh Card,ITEM-002,2024-01-15 10:05,30.00
Free Givy,,2024-01-15 10:10,0.00
Magic Card,ITEM-003,2024-01-15 10:15,20.00
```

## Output Format

The matched CSV includes all original columns plus:

- **slot**: Assigned slot number
- **matched_item_label**: Human-readable label (e.g., "Item #5")
- **match_method**: How the item was matched (`sku`, `sequence`, `excluded`, `manual_review`)
- **needs_review**: Boolean flag for items requiring manual review
- **review_reason**: Explanation if review is needed (e.g., `duplicate_slot`, `sku_missing_or_invalid`)

## Examples

### Example 1: Auto Mode with Exclusions

Exclude giveaways and shipping fees:

```bash
python -m app.cli \
  --in whatnot_orders.csv \
  --out matched_orders.csv \
  --mode auto \
  --exclude "givy,shipping,tip"
```

Result:
- Items with "givy", "shipping", or "tip" in product name are excluded
- Excluded items don't consume slot numbers
- Other items are matched using the best detected mode

### Example 2: SKU Mode for Organized Inventory

When your SKUs already contain slot numbers:

```bash
python -m app.cli \
  --in orders.csv \
  --out matched.csv \
  --mode sku
```

Result:
- `ITEM-001` → Slot 1
- `ITEM-012` → Slot 12
- Empty SKU → Flagged for manual review

### Example 3: Sequence Mode for Simple Matching

When SKUs are unreliable or missing:

```bash
python -m app.cli \
  --in orders.csv \
  --out matched.csv \
  --mode sequence \
  --start-slot 1
```

Result:
- First order (by timestamp) → Slot 1
- Second order → Slot 2
- Third order → Slot 3
- etc.

### Example 4: Include Only Specific Items

Only match Pokemon cards:

```bash
python -m app.cli \
  --in orders.csv \
  --out matched.csv \
  --mode auto \
  --include "pokemon"
```

Result:
- Only items with "pokemon" in product name are matched
- Other items are excluded

## Testing

Run the test suite:

```bash
pytest tests/ -v
```

Run specific test categories:

```bash
# Test SKU parsing
pytest tests/test_matcher.py::TestSKUParsing -v

# Test sequence matching
pytest tests/test_matcher.py::TestSequenceMatching -v
```

## API Documentation

When the server is running, visit:
- Interactive API docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

### Endpoints

**POST /match**
- Upload CSV and get matching results with preview
- Returns JSON with summary and first 25 rows

**POST /download**
- Upload CSV and download matched results
- Returns CSV file

**GET /**
- Serve the web UI

**GET /health**
- Health check endpoint

## Troubleshooting

### "Could not find price column in CSV"

Your CSV must have a column with "price", "sale", or "amount" in the header name.

### "Could not find card number column in CSV" (SKU mode)

SKU mode requires a column with a header like:
- "sku"
- "card #"
- "card number"
- "item #"
- "item number"

Switch to Sequence mode or Auto mode if SKU data is unavailable.

### Items not matching as expected

1. Check the `match_method` column in output
2. Review items with `needs_review = true`
3. Check `review_reason` for details
4. Verify your exclusion keywords aren't too broad

### Duplicate slots detected

This means multiple items were assigned the same slot number. Common causes:
- SKU mode with duplicate SKU values
- Review these items manually and adjust SKUs or use Sequence mode

## Production Deployment

### Using Gunicorn

```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:

```bash
docker build -t whatnot-matcher .
docker run -p 8000:8000 whatnot-matcher
```

## Architecture

```
whatnot-matcher/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI server
│   ├── matcher.py       # Core matching logic
│   ├── cli.py           # CLI interface
│   ├── templates/
│   │   └── index.html   # Web UI
│   └── static/          # Static assets (if needed)
├── tests/
│   └── test_matcher.py  # Unit tests
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
