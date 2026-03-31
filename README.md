# PolyPOI

**AI-powered tour guides for any point of interest.**

PolyPOI is a platform where site staff stand up a fully branded visitor experience without writing code. Each site gets its own chatbot, interactive map, and personalized stop recommendations based on the site's uploaded content.

---

## What it does

**For visitors** — Scan a QR code on arrival and open a mobile web app. Ask questions in plain language, explore an interactive map, and get a personalized tour based on your interests.

**For staff** — Log in to an admin portal, upload documents, add tour stops, and configure branding.

---

## Visitor experience

| Module              | What it does                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Chatbot**         | Answers natural-language questions from the site's own knowledge base (RAG). Acknowledges gaps rather than guessing. |
| **Interactive map** | Shows tour stops and amenities (restrooms, food, parking). Tap a stop for details and photos.                        |
| **Recommendations** | Asks 2–3 quick preference questions and suggests a personalized route.                                               |
| **Amenity lookup**  | Always-on quick access to practical info — hours, emergency contacts, accessibility.                                 |

---

## Admin portal

Staff manage their site through a guided web portal:

- **Onboarding wizard** — set up org identity, branding colors, logo, and tone
- **Document uploads** — PDFs and docs are chunked, embedded, and added to the knowledge base automatically
- **Stop management** — add tour stops with GPS coordinates, photos, and interest tags
- **Amenity records** — structured forms for restrooms, food, parking, emergency info
- **QR code download** — generates a scannable PNG linking visitors to the site

---

## Tech overview

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Backend  | Python + FastAPI                                          |
| Frontend | React + Vite (TypeScript + Tailwind)                      |
| Database | Supabase (Postgres + pgvector + Auth + Storage)           |
| AI       | OpenAI GPT-4o (chat), text-embedding-3-small (embeddings) |
| Hosting  | Railway + Supabase cloud                                  |

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
