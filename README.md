# EHL Predictions

This repo now includes a TypeScript/Bun implementation that is easier to plug into a web frontend.

## TypeScript + Bun (recommended)

### Prerequisites
- Bun 1.x

### Install

```bash
bun install
```

### Run CLI projection

```bash
bun run start
```

Useful flags:

```bash
bun run start --mode auto --samples 1000000
bun run start --json
bun run start --json --out projection.json
```

### Type-check

```bash
bun run check
```

### Run interactive web app

```bash
bun run web:dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

Web controls include:
- projection mode (`auto`, `exact`, `monte-carlo`)
- Monte Carlo sample size
- strength weight slider
- per-game outcome overrides for scenario planning

Build for production:

```bash
bun run web:build
```

## Python (legacy script)

The original Python script is still available:

```bash
python main.py
```
