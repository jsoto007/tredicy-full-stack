# Black Ink Tattoo

A minimal, monochrome full-stack experience for the BLACK INK TATTOO studio. The React + Tailwind client pairs with a Flask + SQLAlchemy API to showcase work, capture consultations, and stay accessible across light and dark themes.

## Getting Started

1. Clone this repository.
2. Copy the provided environment examples and adjust values.
3. Install dependencies for the client and server.
4. Run the dev servers in separate terminals.

### Environment setup

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

### Server

```bash
cd server
pipenv install
pipenv run flask --app wsgi run --debug
```

The Flask server now serves the built Vite bundle from `client/dist`. Run `npm run build --prefix client` (or let the Procfile `assets` process handle it) before starting the web process in production so non-API routes resolve.

#### PostgreSQL 17 setup

1. Install PostgreSQL 17 (macOS Homebrew: `brew install postgresql@17`) and ensure the service is running (`brew services start postgresql@17`).
2. Create the development database: `createdb tredicy_db`.
3. Copy `.env.example` to `.env` inside `server/` and adjust `DATABASE_URI` if your credentials differ. The example points to `postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/tredicy_db`.
4. Apply migrations (or allow `db.create_all()` on first boot): `pipenv run flask db upgrade`.
5. Seed demo data: `pipenv run python seed.py`.

### Client

```bash
cd client
npm install
npm run dev
```

Available scripts:

- `npm run dev` - Vite development server on http://127.0.0.1:5173
- `npm run build` - production bundle
- `npm run preview` - preview built assets
- `npm run lint` - lint source files with ESLint
- `npm run format` - format with Prettier

The dev server proxies `/api/*` to `http://127.0.0.1:5000`, keeping credentialed cookies and CSRF tokens aligned with the Flask backend.

## Environment variables

| Name | Location | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `client/.env` | Base URL for the Flask API (default blank so relative paths hit the hosting origin – override this when the API lives on another host) |
| `FLASK_ENV` | `server/.env` | Flask environment (`development`, `production`, etc.) |
| `DATABASE_URI` | `server/.env` | Database connection string; must target the `tredicy_db` database |
| `SECRET_KEY` | `server/.env` | Secret key for Flask session security |
| `UPLOADS_S3_BUCKET` | `server/.env` | Optional. When set, gallery uploads are stored in this AWS S3 bucket. |
| `UPLOADS_S3_REGION` | `server/.env` | AWS region for the uploads bucket. |
| `UPLOADS_PUBLIC_BASE_URL` | `server/.env` | Optional CDN/base URL for uploaded media. |
| `UPLOADS_S3_PREFIX` | `server/.env` | Optional key prefix (default `uploads`). |
| `STRIPE_SECRET_KEY` | `server/.env` | Stripe secret key used to create Checkout sessions. |
| `STRIPE_PUBLISHABLE_KEY` | `server/.env` | Stripe publishable key exposed to the client config endpoint. |
| `STRIPE_CURRENCY` | `server/.env` | Currency code for bookings (default `USD`). |
| `STRIPE_COUNTRY_CODE` | `server/.env` | Two-letter country code for checkout display (default `US`). |
| `STRIPE_FAKE_PAYMENTS` | `server/.env` | Set to `true` to bypass live Stripe checkout during development. |
| `MAILGUN_DOMAIN` | `server/.env` | Mailgun domain used for outgoing confirmation & activation emails. |
| `MAILGUN_API_KEY` | `server/.env` | Private Mailgun API key for delivering messages. |
| `MAILGUN_FROM` / `MAILGUN_FROM_EMAIL` | `server/.env` | Sender address for automated emails (e.g. `Melodi Nails <melodinails@mail.sotodev.com>`). `MAILGUN_FROM` takes priority; `MAILGUN_FROM_EMAIL` is accepted as a fallback. |
| `CLIENT_BASE_URL` | `server/.env` | Frontend root URL used when generating activation links (default `http://localhost:5173`). |

### Payments & uploads

- **Uploads** – When the optional `UPLOADS_S3_*` variables are populated, media uploaded from the admin dashboard is streamed directly to S3 and served from the bucket (or a CDN you configure with `UPLOADS_PUBLIC_BASE_URL`). Without these values, uploads are stored in the database (and mirrored to disk) so they survive deployments; S3/CDN storage is still recommended for large files.
- **Stripe checkout** – Booking submissions now create an appointment draft and redirect the client into Stripe Checkout. After payment succeeds, the confirmation page verifies the Stripe session and records the payment against the appointment. Use `STRIPE_FAKE_PAYMENTS=true` locally if you want to bypass live checkout during development.

## Architecture

- `client/` - Vite + React single-page application with TailwindCSS, modular UI components, and data fallbacks.
- `server/` - Flask application factory with SQLAlchemy models, seeded demo records, and JSON-only routes.
- Shared focus on monochrome styling, ample spacing, and light/dark theming managed via `document.documentElement.classList`.

## Accessibility & performance checklist

- Descriptive `alt` text for imagery and discernible labels for interactive elements.
- Keyboard-friendly navigation with focus trapping in dialogs and lightbox, plus arrow-key tabs.
- Respects `prefers-reduced-motion`; lazy loads gallery imagery.
- Theme toggle persists user choice and honors initial system preference.

## Deployment notes

- Frontend: deploy `client/` build output to Netlify or Vercel with `VITE_API_BASE_URL` pointing to the live API.
- Backend: deploy `server/` to Render, Fly.io, or Heroku; provision a persistent database via `DATABASE_URI` that ends in `/tredicy_db` and ensure `npm run build --prefix client` runs before Gunicorn boots so the SPA bundle is available.
- Automated tests force `DATABASE_URI` to an in-memory SQLite instance so test runs stay isolated from shared databases.
- Update CORS origins in `app/__init__.py` if production hosts differ from local defaults.
# black-work-tattoo
# melodi-nails-full-stack
