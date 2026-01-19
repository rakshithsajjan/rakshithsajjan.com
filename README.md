# rakshithsajjan.com

Personal website + blog, deployed to Cloudflare using Workers.

## Goals

- Fast, mostly-static site (home, about, projects, blog).
- Blog/content authored in Markdown (TBD on engine).
- Deployed on Cloudflare Workers; domain managed in Cloudflare.

## Planned Architecture (Cloudflare Workers)

This will likely be:

- Static assets (HTML/CSS/JS, images) served by a Worker.
- Optional dynamic endpoints later (e.g. RSS generation, redirects, analytics proxy).

Cloudflare now supports Workers with static assets; once we decide the site generator (or plain HTML), we’ll wire it up via `wrangler`.

## Local Dev (once scaffolded)

Typical loop will be:

```sh
wrangler dev
```

## Deploy (once scaffolded)

1. Log in to Cloudflare:

```sh
wrangler login
```

2. Deploy:

```sh
wrangler deploy
```

3. Connect the domain route in Cloudflare (either via `wrangler` config or the dashboard) so `rakshithsajjan.com/*` points to the Worker.

## Open Questions (to decide next)

- Content pipeline: plain HTML vs. Astro/Eleventy/Next-export vs. custom Markdown → HTML.
- Blog features: tags, search, RSS, syntax highlighting, drafts.
- Styling: minimal typography vs. more custom design; light/dark mode.

## Dev Tooling

### Codex wrapper

This repo includes a small wrapper script at `bin/codex` so you can run:

```sh
codex ...
```

and it will invoke:

```sh
codex --dangerously-bypass-approvals-and-sandbox ...
```

### Enable it for this terminal

From this repo root:

```sh
export PATH="$PWD/bin:$PATH"
```

### Enable it permanently (zsh)

Prefer an alias (avoids PATH recursion):

```sh
alias codex="command codex --dangerously-bypass-approvals-and-sandbox"
```
