# PolyPOI
 
**Framework for Building AI Tour Guides**
 
Architecture Design Document · March 2026 · Version 1.0
 
---
 
## Executive Summary
 
PolyPOI is a config-driven, multi-tenant framework that enables non-technical staff at points of interest (POIs) to create and manage AI-powered tour guides. Visitors access the tour guide by scanning a QR code on arrival, opening a mobile web application that provides conversational Q&A, interactive maps, and personalized stop recommendations—all grounded in content the POI staff have uploaded.
 
The framework provides a shared platform where each POI is a tenant defined by configuration and content rather than code. Shared modules handle common functionality (chatbot, map, recommendations, amenity lookup) while tenant-specific data—documents, tour stops, branding, and amenity records—make each experience unique.
 
Three showcase POIs demonstrate the framework's flexibility across diverse site types: a national park, a museum or historic site, and a college campus.
 
---
 
## Project Goals
 
- **Framework-first design:** Adding a new POI requires only configuration and content—no code changes.
- **Non-technical authoring:** POI staff create and manage tour guides through a guided admin portal with document uploads and structured forms.
- **AI-grounded Q&A:** Visitors ask natural-language questions answered from the POI's own knowledge base using retrieval-augmented generation (RAG).
- **Personalized recommendations:** Visitors receive stop and route suggestions based on their stated interests.
- **Zero-install visitor access:** Visitors scan a QR code and use a mobile web app with no download required.
- **Showcase variety:** Three POIs (national park, museum, college campus) validate the framework across outdoor, indoor, educational, and commercial contexts.
 
---
 
## High-Level Architecture
 
The system comprises three layers: the Admin Portal, the Core Platform, and the Visitor App.
 
### Admin Portal
 
A web-based dashboard where POI staff log in and manage their site. Capabilities include uploading documents (PDFs, brochures, trail guides) that feed the RAG knowledge base, defining tour stops via structured forms (name, description, GPS coordinates, photos, category, tags), configuring which visitor-facing modules are enabled, managing amenity records, and customizing branding. Each POI receives its own isolated workspace.
 
### Core Platform
 
The shared backend that all POIs consume. It handles tenant resolution (mapping a URL slug to the correct POI configuration), the RAG pipeline (document ingestion, chunking, embedding, and retrieval), the AI layer (OpenAI GPT-4o for Q&A and recommendations, scoped to POI-specific context), a content API serving tour stops, routes, and amenity data, and authentication for admin users. The Core Platform is entirely POI-agnostic—all site-specific behavior originates from configuration and content.
 
### Visitor App
 
A responsive mobile web application. When a visitor scans a QR code, the URL encodes the POI identifier (e.g., `app.polypoi.com/grand-canyon`). The app fetches that tenant's configuration, applies its branding, and presents the enabled interaction modules. No installation is required.
 
---
 
## Data Model
 
All data is scoped by tenant ID at the database level, ensuring strict isolation between POIs.
 
### Structured Data Primacy
 
The framework draws a clear line between two categories of content. Operational facts—hours, amenity locations, closures, safety information, routes, accessibility details—live in structured relational records and are treated as the authoritative source of truth. These are directly editable by staff, queryable without AI, and guaranteed to be current. Narrative and educational content—historical context, trail ecology, exhibit background, scientific explanations—lives in uploaded documents processed through the RAG pipeline. When both sources touch the same topic, structured data wins. This separation ensures that the most safety-critical and time-sensitive information is never dependent on retrieval quality or AI interpretation.
 
### Tenant (POI) Configuration
 
Each POI is defined by a tenant record containing the POI name, URL slug, branding (colors, logo, welcome text), enabled modules, operating hours, and contact and emergency information. This configuration is the single source of truth for rendering the visitor experience.
 
### Tour Stops
 
The core content unit. Each stop includes a name, description, GPS coordinates, category (exhibit, trailhead, building, landmark), optional photos, and interest tags for the recommendation engine (e.g., history, nature, accessible, family-friendly). Stops can be grouped into ordered routes such as a Highlights Tour or Accessibility-Friendly Path.
 
### Knowledge Documents
 
Uploaded files processed through the RAG pipeline, serving as the source for narrative and educational content (history, ecology, exhibit context, scientific background). Each document is linked to its tenant, chunked, embedded, and stored in the vector database. Retrieval queries are always filtered by tenant ID to prevent cross-tenant information leakage. Operational facts (hours, locations, closures) should be maintained in structured records rather than embedded in documents—see Structured Data Primacy above.
 
### Amenities
 
A shared schema covering restrooms, gift shops, food vendors, parking, emergency procedures, and partner experiences. Each amenity has a name, GPS location, hours, type, and optional notes. Because these are structurally identical across POIs, the framework provides a standard form that staff fill in with their specifics.
 
### Entity Relationships
 
| Entity | Belongs To | Has Many | Key Fields |
|---|---|---|---|
| **Tenant** | — | Stops, Routes, Documents, Amenities, Admin Users | slug, name, branding, enabled_modules |
| **Stop** | Tenant | Photos, Tags | name, description, lat/lng, category |
| **Route** | Tenant | Stops (ordered) | name, description, stop_order |
| **Document** | Tenant | Chunks (vectors) | filename, status, token_count |
| **Amenity** | Tenant | — | name, type, lat/lng, hours |
 
---
 
## Visitor-Facing Modules
 
The framework ships with four modules. POI staff toggle the first three on or off; the fourth is always active.
 
### Chatbot Module
 
The primary AI interaction surface. Visitors type or tap a question, and the system retrieves relevant content from the POI's knowledge base, assembles a prompt with that context alongside structured amenity and stop data, and sends it to GPT-4o. The system prompt is templated per POI, establishing the guide's identity and tone. Staff customize tone through a simple selector in the admin portal (friendly and casual, professional and informative, fun and enthusiastic) rather than editing raw prompts. The chatbot is strictly grounded: if the knowledge base lacks an answer, the AI acknowledges the gap rather than hallucinating.
 
### Interactive Map Module
 
Displays the POI's stops and amenities on a mobile-friendly map. Visitors tap stops to view descriptions and photos, toggle amenity layers (restrooms, food, parking), and follow a route with step-by-step navigation between stops. All map data comes from the structured stop and amenity records—no separate map configuration is needed.
 
### Recommendation Module
 
When visitors open the app, they can optionally answer two to three quick preference questions (e.g., What interests you? History, Nature, Art, Family activities). The system matches these preferences against stop tags to suggest a personalized route. This is a lightweight tag-matching algorithm, not a separate AI call, keeping it fast and cost-efficient. The chatbot can also surface recommendations conversationally when asked.
 
### Amenity Lookup Module (Always On)
 
Every POI needs restroom locations, emergency information, and basic wayfinding. This module surfaces amenity data contextually: in the map as toggleable layers, in chatbot responses when visitors ask questions like "Where's the nearest restroom?", and as a quick-access section on the home screen.
 
---
 
## RAG Pipeline and AI Architecture
 
### Query Architecture
 
Every POI uses the same query path regardless of content volume. All uploaded documents are chunked, embedded, and stored in the vector database. At query time, the system retrieves against the vector store, assembles a prompt, and sends it to the LLM. This single path keeps behavior consistent and predictable whether a POI has one brochure or fifty trail guides.
 
For POIs whose total document content fits comfortably within the context window (roughly 3,000 tokens or fewer), the system injects all content directly into the prompt rather than performing a vector lookup. This is a latency optimization—the prompt assembly, guardrails, and response behavior are identical either way.
 
### Document Ingestion Flow
 
When a staff member uploads a document, the following pipeline executes: the file is stored in object storage, a processing job extracts text (with OCR for scanned brochures), the text is chunked into overlapping segments of roughly 500 tokens using a structure-aware strategy that respects document headings and section breaks before falling back to token-based splitting, embeddings are generated via OpenAI's embedding API, and vectors are stored tagged with the tenant ID. Staff see a progress indicator and confirmation when indexing completes.
 
### Chunking Strategy
 
The framework uses a single default chunking strategy designed to handle the variability across POI content types. The chunker first splits on clear structural markers—headings, section breaks, horizontal rules—to preserve logical units. Within those sections, it applies 500-token overlapping chunks if the section exceeds the target size. This approach handles both short-entry documents (trail-by-trail guides, exhibit catalogs) and long-form continuous narratives (historical accounts, scientific papers) without the framework to maintain multiple strategies.
 
### Query Flow
 
When a visitor asks a question through the chatbot, a lightweight intent router classifies the question before deciding how to answer it:
 
1. **Classify intent.** A fast, deterministic classifier (keyword and pattern matching—not a second AI call) categorizes the question. Structured-data questions ("Where's the nearest restroom?", "What time do you close?", "Is there parking?") are routed to structured handlers that query relational records directly—no embedding, no retrieval, no LLM. This is faster, cheaper, and more reliable for factual lookups. Open-ended narrative questions ("Tell me about the history of this building", "What wildlife might I see on the ridge trail?") proceed to the RAG path below.
2. **Embed** the visitor's question using the same embedding model.
3. **Retrieve** the top five most relevant chunks from the vector store, filtered by tenant ID.
4. **Assemble the prompt:** system instructions (POI-specific tone and guardrails), retrieved chunks as context, relevant structured data about nearby stops and amenities, and the visitor's question.
5. **Send to GPT-4o** and stream the response back to the visitor.
 
The intent router also strengthens the system's fallback posture: structured handlers continue to answer operational questions even when the AI provider is unavailable (see Error Handling below).
 
### Context Window Management
 
The system prompt template allocates a fixed budget: approximately 200 tokens for identity and tone, approximately 2,000 tokens for retrieved document chunks, and approximately 500 tokens for structured amenity and stop data. This keeps costs predictable and leaves room for conversational history—the app retains the last four to six exchanges for natural back-and-forth without context growth.
 
### AI Guardrails
 
The AI is constrained to its POI's knowledge by default. The system prompt instructs the model to answer only questions relevant to the POI, cite sources when possible, direct visitors to on-site staff for safety emergencies rather than improvising advice, and gracefully decline off-topic questions. These guardrails are baked into the framework and require no staff configuration.
 
---
 
## Admin Portal Design
 
Since POI staff are non-technical, the admin portal is designed to feel approachable—closer to a site builder like Squarespace than a developer console.
 
### Onboarding Wizard
 
New POIs are created through a four-step guided setup wizard rather than a blank dashboard:
 
1. **Step 1 — Identity:** POI name, location, logo, and brand colors.
2. **Step 2 — Content:** Upload documents and/or write a basic description.
3. **Step 3 — Tour Stops:** Add at least one stop with name, description, and location via a pin-drop map interface.
4. **Step 4 — Amenities:** Checklist-style selection of which amenities the POI has, then fill in locations and details for each.
 
The wizard gets a POI to a launchable state in one sitting. Staff can enrich content at any time afterward.
 
### Dashboard
 
After setup, the dashboard provides a snapshot of the POI's status: counts of configured stops, routes, and documents; visitor engagement statistics (questions asked, popular stops); and a report of common unanswered questions—showing staff what visitors are asking that the knowledge base cannot yet handle. This creates a natural feedback loop for content improvement. A Preview button lets staff experience the visitor app exactly as visitors would.
 
### Content Management
 
Two primary tabs. The Documents tab is a drag-and-drop file manager showing processing status for each upload. The Tour Stops tab is a form-based editor with a map preview where staff add stops, assign tags and categories, attach photos, and group stops into named routes by drag-and-drop ordering. Amenities use a type-structured form (restrooms, gift shops, food, emergency, partners) so staff fill in blanks rather than building from scratch.
 
### Configuration and Deployment
 
A settings page where staff toggle modules on or off, select the AI guide's tone preset, edit the welcome message, and generate printable QR codes that link to their POI's visitor URL.
 
---
 
## Error Handling and Edge Cases
 
### Offline and Poor Connectivity
 
Visitors at outdoor POIs will frequently have limited connectivity. On first load, the visitor app caches the POI configuration, stop data, map tiles, and amenity information locally. If connectivity drops, the map, stop descriptions, amenity lookup, and structured-data handlers (hours, locations, basic wayfinding) continue to function from cached data. The chatbot displays a friendly offline message and falls back to local keyword search against cached stop descriptions for narrative questions. When connectivity resumes, the chatbot returns to normal operation.
 
### AI Unavailability
 
If the OpenAI API is slow or unreachable, the system degrades gracefully through three fallback tiers:
 
- **Structured handlers (unaffected):** Questions routed to structured handlers by the intent router continue to work normally—they never touch the AI provider. Visitors can still get restroom locations, hours, amenity details, and route information with zero degradation.
- **FAQ matching:** For questions that would normally go to RAG, the visitor's question is matched against pre-written FAQ responses using simple keyword and pattern matching (no AI required). The framework seeds common defaults and staff can add more through the admin portal. If there is a match, that answer is served.
- **Staff referral:** If no FAQ match is found, the system directs the visitor to on-site staff with the POI's contact information. This is the honest fallback for questions too specific for the canned response bank.
 
### Content Gaps
 
When the AI cannot answer a question from the knowledge base, two things happen: the visitor receives an honest acknowledgment and a suggestion to ask on-site staff, and the question is logged in the admin dashboard's unanswered questions report. Over time, this makes the knowledge base more comprehensive through staff action rather than AI fine-tuning.
 
---
 
## Deployment Architecture
 
For the three-POI showcase, the platform runs as a single deployable service with the following components:
 
| Component | Details |
|---|---|
| **Web Server** | Containerized application serving both the admin portal and visitor app |
| **Database** | PostgreSQL for tenant configs, stops, routes, amenities, and admin accounts |
| **Vector Store** | pgvector (PostgreSQL extension)—keeps everything in one database rather than introducing a separate service |
| **Object Storage** | S3 or equivalent for uploaded documents and images |
| **AI Provider** | OpenAI API (GPT-4o for Q&A, embedding API for vector generation, TTS API available for future audio tours) |
 
Tenant routing uses the URL slug: visitors access `app.polypoi.com/{poi-slug}` and the server resolves the matching tenant configuration. QR codes generated in the admin portal point to these URLs.
 
### Scaling Considerations
 
At three tenants, this architecture is comfortably simple. If growth to hundreds of tenants were required, the primary bottlenecks would be the vector store and AI API costs, both of which scale linearly and can be addressed without rearchitecting the system.
 
---
 
## Showcase POIs
 
Three POIs are selected to demonstrate the framework's flexibility across meaningfully different site types, each exercising the shared modules in distinct ways.
 
| POI Type | Key Features Exercised | Content Profile | Unique Challenges |
|---|---|---|---|
| **National Park** | Trails, outdoor nav, safety alerts, natural science Q&A | Heavy: trail guides, wildlife docs, safety manuals (full RAG) | Offline connectivity, large geographic area, safety-critical info |
| **Museum / Historic Site** | Indoor exhibits, curated routes, deep historical knowledge | Moderate: exhibit catalog, historical narratives | Dense stop density, rich narrative content, accessibility |
| **College Campus** | Building wayfinding, dining vendors, event info, visitor center | Light to moderate: campus map, department overviews, visitor FAQ | Frequent content updates, mix of indoor/outdoor, vendor partnerships |
 
This mix covers outdoor versus indoor, nature versus culture, content-heavy versus content-light, and educational versus commercial contexts—providing comprehensive validation that the framework's shared modules adapt correctly to each.
 
---
 
## Future Considerations
 
The following capabilities are explicitly out of scope for the initial build but are architecturally accommodated by the modular, config-driven design:
 
- **Audio narration tours:** OpenAI's TTS API can generate spoken narration per stop. The module pattern supports adding this as a toggleable feature.
- **Multilingual support:** Translation of tour content and chatbot responses for international visitors.
- **Dynamic personalization:** AI-generated narration that adapts content based on visitor context (time of day, weather, previous stops visited).
- **Analytics dashboard:** Deeper visitor behavior analytics beyond the basic engagement stats and unanswered questions report.
- **CMS import:** Importing content directly from existing POI websites or content management systems.
