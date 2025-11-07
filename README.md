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
2. Create the development database: `createdb blackink_dev`.
3. Copy `.env.example` to `.env` inside `server/` and adjust `DATABASE_URI` if your credentials differ. The example points to `postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/blackink_dev`.
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

## Environment variables

| Name | Location | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `client/.env` | Base URL for the Flask API (default `http://127.0.0.1:5000`) |
| `FLASK_ENV` | `server/.env` | Flask environment (`development`, `production`, etc.) |
| `DATABASE_URI` | `server/.env` | Database connection string; fallback is a local SQLite file (`server/blackink_dev.db`) |
| `SECRET_KEY` | `server/.env` | Secret key for Flask session security |
| `UPLOADS_S3_BUCKET` | `server/.env` | Optional. When set, gallery uploads are stored in this AWS S3 bucket. |
| `UPLOADS_S3_REGION` | `server/.env` | AWS region for the uploads bucket. |
| `UPLOADS_PUBLIC_BASE_URL` | `server/.env` | Optional CDN/base URL for uploaded media. |
| `UPLOADS_S3_PREFIX` | `server/.env` | Optional key prefix (default `uploads`). |
| `SQUARE_APPLICATION_ID` | `server/.env` | Square Web Payments application ID. |
| `SQUARE_LOCATION_ID` | `server/.env` | Square location ID that receives deposits. |
| `SQUARE_ACCESS_TOKEN` | `server/.env` | Square access token (use sandbox token for testing). |
| `SQUARE_ENVIRONMENT` | `server/.env` | `sandbox` or `production` (defaults to `sandbox`). |
| `SQUARE_DEPOSIT_AMOUNT_CENTS` | `server/.env` | Booking deposit amount in cents (default `10000`, i.e. $100). |
| `SQUARE_DEPOSIT_CURRENCY` | `server/.env` | Currency code for deposits (default `USD`). |
| `SQUARE_FAKE_PAYMENTS` | `server/.env` | Set to `true` to bypass real payments in development. |

### Payments & uploads

- **Uploads** – When the optional `UPLOADS_S3_*` variables are populated, media uploaded from the admin dashboard is streamed directly to S3 and served from the bucket (or a CDN you configure with `UPLOADS_PUBLIC_BASE_URL`). Without these values, uploads fall back to local disk which is not persistent across deployments.
- **Square deposits** – Booking submissions now use the Square Web Payments SDK and the `/api/appointments` endpoint records a deposit before storing the appointment. Provide the Square sandbox credentials listed above for testing, or switch `SQUARE_ENVIRONMENT=production` with a live access token for launch. Use `SQUARE_FAKE_PAYMENTS=true` locally if you want to bypass card entry entirely.

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
- Backend: deploy `server/` to Render, Fly.io, or Heroku; provision a persistent database via `DATABASE_URI` and ensure `npm run build --prefix client` runs before Gunicorn boots so the SPA bundle is available.
- Automated tests force `DATABASE_URI` to an in-memory SQLite instance so test runs stay isolated from shared databases.
- Update CORS origins in `app/__init__.py` if production hosts differ from local defaults.
# black-work-tattoo
