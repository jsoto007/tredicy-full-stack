---
name: Tredici Social Website Redesign
description: Full redesign of the frontend from a nail salon (Melodi Nails) to Tredici Social, an elevated Italian restaurant in Bronxville, NY
type: project
---

Redesigned the existing Melodi Nails full-stack app into a restaurant site for Tredici Social.

**Why:** The client wanted a modern, clean, welcoming site for their contemporary Italian restaurant.

**What was done:**
- Replaced nail salon brand with Tredici Social brand colors (crimson/garnet reds, charcoal dark, gold metallics, warm cream/linen light backgrounds)
- Added Google Fonts: Cormorant Garamond (headings) + Inter (body)
- Updated Tailwind config with `ts-*` color tokens and `font-heading`/`font-body`
- Rewrote Header (restaurant nav: Menu, Reservations, Private Events, Gallery, About)
- Rewrote Footer (restaurant info, hours, links)
- Rewrote all landing sections: Hero, QuickLinks, About/Story, MenuHighlights (repurposed Services.jsx), Gallery, ReservationsBand (repurposed Booking.jsx), Visit (repurposed Contact.jsx)
- Created new pages: `/menu` → MenuPage.jsx, `/gallery` → GalleryPage.jsx, `/private-events` → PrivateEventsPage.jsx
- Created `client/src/data/menu.json` with full Italian restaurant menu (Antipasti, Pasta, Secondi, Contorni, Dolci, Cocktails, Wine)
- Added backend endpoint: `POST /api/contact/private-events` in routes.py (Mailgun-powered inquiry form)
- Removed language toggle from public UI (kept LanguageContext for admin pages)
- Kept all admin/auth routes and portal routes intact but unlisted from public nav

**Admin/backend unchanged** — gallery upload, admin dashboard, etc. still work at their original routes.

**Placeholder photos** — Gallery tiles use CSS gradient placeholders. All gallery items have `src: null` with a `color` fallback. Swap by setting `src` to a real image path/URL.

**How to apply:** On further changes, use the `ts-*` color tokens in Tailwind. Don't reintroduce nail salon content. Keep the admin routes hidden from public nav.
