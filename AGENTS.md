# AGENTS.md

## Purpose
Operational guide for code agents and contributors working in this repo.

## Project Snapshot
- Stack: Astro static site + Cloudflare Worker static asset serving.
- Homepage hero uses preprocessed ASCII frame playback generated offline.
- Deploys are automated via GitHub Actions (`.github/workflows/deploy.yml`) to Cloudflare Workers.

## Core Commands
- Install: `npm ci`
- Dev server: `npm run dev`
- Build: `npm run build`
- Regenerate search index only: `npm run generate-search-index`
- Build ASCII assets: `npm run build:ascii-video -- --input <video-path> [options]`

## ASCII Pipeline Notes
- Converter script: `scripts/build-ascii-video.mjs`
- Generated assets: `public/media/ascii-bike/`
- Runtime player: `src/components/ascii-player.ts`
- Hero integration: `src/components/AsciiBackground.astro`

## Deploy Notes
- Pushing to `main` triggers Cloudflare deploy workflow.
- Required GitHub secrets:
  - Preferred: `CLOUDFLARE_API_TOKEN`
  - Alternative: `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL`

## Guardrails
- Do not commit local temp/debug files.
- Keep large generated binaries only when they are intentional site assets (e.g., ASCII frames used in production).
- Validate `npm run build` before pushing.
