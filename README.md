# Family‑Anhänger Kalender (Flask + SQLAlchemy)

Mehrmonats‑Belegungsplan. Balken über die Tage, Bearbeiten per PIN (`ACCESS_CODE`).

## Datenbank
- **Prod:** Setze `DATABASE_URL` (Render Postgres / Neon / Supabase)
- **Dev lokal:** Ohne `DATABASE_URL` wird automatisch **SQLite** unter `data/bookings.sqlite` genutzt

## Lokal starten (optional)
```bash
pip install -r requirements.txt
export ACCESS_CODE=BitteAendern
python app.py
# http://localhost:8080
```

Oder mit Docker:
```bash
docker build -t family-anhaenger .
docker run -p 8080:8080 -e ACCESS_CODE=BitteAendern family-anhaenger
```

## Deploy auf Render (Free)
- `render.yaml` im Repo lassen → Render **Blueprint Deploy**
- In Render **Environment** setzen:
  - `ACCESS_CODE` = eure PIN
  - `DATABASE_URL` = Postgres-URL (Render Free Postgres oder Neon/Supabase)
  - `MONTHS_AHEAD` optional (Default 12)
- Healthcheck: `/health`

## API
- `GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/bookings` → `{name,start,end,note,code}`
- `DELETE /api/bookings/:id?code=...`
