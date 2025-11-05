# Family‑Anhänger Kalender (Flask + SQLAlchemy)

- Balken über mehrere Tage, Name einmal pro Buchung
- Ohne Passwort möglich (einfach `ACCESS_CODE` leer lassen)
- Render‑freundliche DB‑URL Normalisierung (`postgres://` → `postgresql+psycopg2://`, `sslmode=require`)

## Deploy auf Render
- Repo pushen → Render **Blueprint** → `DATABASE_URL` + `ACCESS_CODE` (optional) setzen → fertig
- Healthcheck: `/health`
