# Black Ink Tattoo API

Flask application factory that powers the BLACK INK TATTOO client with JSON endpoints, seeded demo data, and secure defaults.

## Quickstart

```bash
cd server
cp .env.example .env
pipenv install
pipenv run flask --app wsgi run --debug
```

Build the React client (`npm run build --prefix client`) so Flask can serve the static bundle from `client/dist` when running in a single-service production deployment.

## Available routes

- `GET /api/gallery?category=blackwork|fine-line|color` - filtered gallery items
- `GET /api/testimonials` - testimonial collection
- `POST /api/consultations` - create a consultation request with minimal validation

## Environment variables

| Name | Description |
| --- | --- |
| `FLASK_ENV` | Flask environment name |
| `DATABASE_URI` | Database connection string. Must target the `/tredicy_db` database; there is no fallback URI. |
| `SECRET_KEY` | Secret key for session security and signing |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional admin email to create or update on deploy |
| `ADMIN_BOOTSTRAP_PASSWORD` | Optional admin password to set on deploy |
| `ADMIN_BOOTSTRAP_NAME` | Optional admin display name to set on deploy |
| `SESSION_COOKIE_SAMESITE` | Optional override for the session cookie's `SameSite` attribute (defaults to `Strict` in production and `Lax` in development). Use `None` only when the API and frontend are separated hosts *and* the service is served over HTTPS. |

## Development notes

- CORS is limited to `http://127.0.0.1:5173` by default; adjust for production hosts.
- When the React dev server runs on a different host/port (e.g., Vite on `127.0.0.1:5173`), you may need to build the client or proxy requests so the browser sees the API as same-site. Setting `SESSION_COOKIE_SAMESITE=None` also requires `SESSION_COOKIE_SECURE=true` and HTTPS, otherwise browsers will reject the cookie.
- SQLAlchemy seeds demo gallery and testimonial data on first boot so the client can render immediately.
- Consider integrating Flask-Migrate for schema changes (left as a TODO).

### PostgreSQL 17

- Install PostgreSQL 17 (for example, `brew install postgresql@17`) and start the service.
- Create a development database named `tredicy_db` and point `DATABASE_URI` in `.env` to `postgresql+psycopg2://<user>:<password>@127.0.0.1:5432/tredicy_db`.
- Pytest automatically rewires `DATABASE_URI` to an in-memory SQLite database to avoid touching shared data.
- Run `pipenv run flask db upgrade` (or rely on `db.create_all()`), then execute `pipenv run python seed.py` to populate demo data.
- To bootstrap a production admin account during deploy, set `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, and optionally `ADMIN_BOOTSTRAP_NAME`. The `ensure-bootstrap-admin` command is idempotent and updates the password if the email already exists.
