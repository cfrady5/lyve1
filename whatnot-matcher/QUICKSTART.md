# Quick Start Guide

## Installation

```bash
# Navigate to the project
cd whatnot-matcher

# Install dependencies
pip3 install -r requirements.txt
```

## Running the Demo

```bash
python3 demo.py
```

This will:
1. Load the example CSV (`example_orders.csv`)
2. Show SKU mode matching with exclusions
3. Show Sequence mode matching
4. Generate output files: `demo_output_sku.csv` and `demo_output_sequence.csv`

## Starting the Web Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open: http://localhost:8000

## Using the CLI

```bash
# Basic usage
python3 -m app.cli --in example_orders.csv --out matched.csv

# With exclusions
python3 -m app.cli \
  --in example_orders.csv \
  --out matched.csv \
  --mode auto \
  --exclude "givy,shipping,tip"
```

## Running Tests

```bash
pytest tests/ -v
```

## Example Output

When you run the demo with `example_orders.csv`, you'll see:

**SKU Mode (Auto-detected):**
- Pokemon Charizard (SKU: ITEM-5) → Slot 5
- YuGiOh Blue Eyes (SKU: ITEM-12) → Slot 12
- Magic Black Lotus (SKU: ITEM-3) → Slot 3
- Pokemon Pikachu (SKU: ITEM-8) → Slot 8
- Pokemon Mewtwo (SKU: ITEM-19) → Slot 19
- YuGiOh Dark Magician (SKU: ITEM-1) → Slot 1

**Excluded (don't consume slots):**
- Free Givy Item (matched "givy")
- Shipping Fee (matched "shipping")
- Tip for Seller (matched "tip")

**Sequence Mode (without SKU):**
- First item chronologically → Slot 1
- Second item → Slot 2
- Third item → Slot 3
- etc. (excluded items don't consume slots)

## Key Files

- `app/matcher.py` - Core matching logic
- `app/main.py` - FastAPI web server
- `app/cli.py` - Command-line interface
- `app/templates/index.html` - Web UI
- `tests/test_matcher.py` - Unit tests
- `example_orders.csv` - Sample data
