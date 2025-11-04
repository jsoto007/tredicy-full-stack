# Black Ink Tattoo API

Flask application factory that powers the BLACK INK TATTOO client with JSON endpoints, seeded demo data, and secure defaults.

## Quickstart

```bash
cd server
cp .env.example .env
pipenv install
pipenv run flask --app wsgi run --debug
```

## Available routes

- `GET /api/gallery?category=blackwork|fine-line|color` - filtered gallery items
- `GET /api/testimonials` - testimonial collection
- `POST /api/consultations` - create a consultation request with minimal validation

## Environment variables

| Name | Description |
| --- | --- |
| `FLASK_ENV` | Flask environment name |
| `DATABASE_URI` | Database connection string (fallback is `sqlite:///blackink_dev.db` when empty) |
| `SECRET_KEY` | Secret key for session security and signing |

## Development notes

- CORS is limited to `http://127.0.0.1:5173` by default; adjust for production hosts.
- SQLAlchemy seeds demo gallery and testimonial data on first boot so the client can render immediately.
- Consider integrating Flask-Migrate for schema changes (left as a TODO).

### PostgreSQL 17

- Install PostgreSQL 17 (for example, `brew install postgresql@17`) and start the service.
- Create a development database (`createdb blackink_dev`) and point `DATABASE_URI` in `.env` to `postgresql+psycopg2://<user>:<password>@127.0.0.1:5432/blackink_dev`.
- Pytest automatically rewires `DATABASE_URI` to an in-memory SQLite database to avoid touching shared data.
- Run `pipenv run flask db upgrade` (or rely on `db.create_all()`), then execute `pipenv run python seed.py` to populate demo data.
