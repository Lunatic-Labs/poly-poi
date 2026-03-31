# PolyPOI

**AI-powered tour guides for any point of interest — no custom app required.**

PolyPOI is a config-driven platform that lets non-technical staff at parks, museums, and campuses stand up a branded visitor experience by scanning a QR code. Each site gets its own chatbot, interactive map, and personalized stop recommendations — all grounded in content the staff upload themselves.

---

## What it does

**For visitors** — Scan a QR code on arrival and open a mobile web app (no download). Ask questions in plain language, explore an interactive map, and get a personalized tour based on your interests.

**For staff** — Log in to an admin portal, upload documents (brochures, trail guides, exhibit notes), add tour stops, and configure branding. No technical knowledge required. Content changes go live immediately.

**For the platform** — Adding a new site requires only configuration and content, not code. All sites run on the same shared infrastructure.

---

## Visitor experience

| Module | What it does |
|--------|-------------|
| **Chatbot** | Answers natural-language questions from the site's own knowledge base (RAG). Acknowledges gaps rather than guessing. |
| **Interactive map** | Shows tour stops and amenities (restrooms, food, parking). Tap a stop for details and photos. |
| **Recommendations** | Asks 2–3 quick preference questions and suggests a personalized route. |
| **Amenity lookup** | Always-on quick access to practical info — hours, emergency contacts, accessibility. |

---

## Showcase POIs

Three sites demonstrate the framework across different contexts:

- **National park** — outdoor trails, wildlife, safety info, ranger Q&A
- **Museum / historic site** — exhibit context, collection background, accessibility routes
- **College campus** — admissions tours, building finder, campus life Q&A

---

## Admin portal

Staff manage their site through a guided web portal:

- **Onboarding wizard** — set up org identity, branding colors, logo, and tone in minutes
- **Document uploads** — PDFs and docs are chunked, embedded, and added to the knowledge base automatically
- **Stop management** — add tour stops with GPS coordinates, photos, and interest tags
- **Amenity records** — structured forms for restrooms, food, parking, emergency info
- **QR code download** — generates a scannable PNG linking visitors to the site

---

## Tech overview

| Layer | Choice |
|-------|--------|
| Backend | Python + FastAPI |
| Frontend | React + Vite (TypeScript + Tailwind) |
| Database | Supabase (Postgres + pgvector + Auth + Storage) |
| AI | OpenAI GPT-4o (chat), text-embedding-3-small (embeddings) |
| Hosting | Railway + Supabase cloud |

Each site is a **tenant** — isolated by `tenant_id` at the database layer, with its own branding, content, and configuration.

---

## Getting started

```sh
make setup                               # install Python + Node deps
cp .env.example backend/.env.local      # add Supabase + OpenAI credentials
make backend                             # API at http://localhost:8000
make frontend                            # app at http://localhost:5173
```

Credentials: Supabase dashboard → Settings → API (use legacy anon/service_role keys).

See `CLAUDE.md` for full dev conventions, migration commands, and project structure.
