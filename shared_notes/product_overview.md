# PolyPOI — Product Overview

**What we're building and how it works** · March 2026

---

## The Problem

Points of interest — parks, museums, campuses — want to offer visitors a smart, conversational guide, but hiring one or building an app from scratch is expensive and time-consuming.

## What PolyPOI Does

PolyPOI is a shared platform that lets any point of interest spin up its own AI-powered tour guide. Visitors scan a QR code on arrival and land in a mobile web app — no download needed — where they can:

- **Ask questions in plain language** and get answers drawn from that site's own content (trail guides, exhibit descriptions, campus FAQs — whatever the staff have uploaded).
- **Browse an interactive map** showing tour stops, restrooms, food, parking, and other amenities.
- **Get personalized stop suggestions** based on a few quick preference questions (e.g., "I'm interested in history and accessibility-friendly stops").
- **Look up practical info** like hours, directions, and emergency contacts at any time.

The key idea: every POI runs on the same platform. What makes each one unique is its content and configuration — not custom code.

## How Staff Set It Up

POI staff manage their site through an admin portal designed to feel more like Squarespace than a developer console. A guided setup wizard walks them through four steps:

1. **Identity** — Name, logo, brand colors.
2. **Content** — Upload documents (PDFs, brochures, guides). The system processes these automatically so the AI can reference them.
3. **Tour Stops** — Add stops with descriptions, photos, and locations using a pin-drop map.
4. **Amenities** — Check off which amenities the site has and fill in locations and hours.

After setup, a dashboard shows engagement stats and flags questions visitors are asking that the content can't answer yet — giving staff a natural feedback loop for improving their guide over time.

## How It Works Under the Hood

Staff upload documents → the system breaks them into searchable pieces and stores them. When a visitor asks a question, the system finds the most relevant pieces of content and sends them to an AI model (GPT-4o) along with the question to generate a grounded answer.

Practical questions like "Where's the nearest restroom?" skip the AI entirely and pull directly from the structured data staff entered — faster, cheaper, and always accurate.

If connectivity drops (common at outdoor sites), the app falls back to cached data so maps, stop info, and amenity lookups keep working. If the AI service itself goes down, the system serves pre-written FAQ answers and directs visitors to on-site staff.

## The Three Showcase POIs

We're validating the framework with three intentionally different site types:

| Site Type                  | Why It Tests the Framework                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| **National Park**          | Large area, heavy content (trail guides, wildlife, safety), offline connectivity challenges |
| **Museum / Historic Site** | Dense indoor stops, deep narrative content, accessibility focus                             |
| **College Campus**         | Mix of buildings, dining, events; content changes frequently                                |

If the same platform handles all three well, it's a strong signal that it can accommodate a wide range of POIs.

## Stretch goals (out of scope for MVP)

Audio narration, multilingual support, AI that adapts to time-of-day or weather, and deeper analytics are all future possibilities the architecture can accommodate — but they're not part of this initial build.

---
