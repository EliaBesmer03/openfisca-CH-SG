# Frontend – Rechner KiBG/KiBV St.Gallen (I2)

React + Vite + TypeScript. Rechnet nie selbst Recht; alle Ergebnisse kommen von der OpenFisca-API (PLAN Teil A).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
```

## API-Modus

`VITE_API_MODE` in `.env` (oder `.env.local`):

- `live` (Standard): Requests über den Vite-Proxy `/api` an die OpenFisca-API (`make serve-local` im Repo-Root).
  Der Fragebogen braucht das Modell: Er fragt es nach jeder entscheidenden Antwort (Zwischenprüfung).
- `fixtures`: Antworten aus `../contract/fixtures/*.response.json`, ohne laufendes Modell (`npm run dev:demo`).
  Nur die Beispielfamilien funktionieren; der Fragebogen findet keine passende Fixture.

Live gegen das Modell:

```bash
make serve-local          # im Repo-Root, OpenFisca auf 127.0.0.1:5000
npm run dev               # im Ordner frontend/ (Live-Modus)
```

Proxy-Ziel ist `http://127.0.0.1:5000`. Anderer Port: `API_ZIEL=http://127.0.0.1:5001 npm run dev:live`.

Achtung macOS: Der AirPlay-Empfänger belegt Port 5000 auch unter IPv6. Ein Proxy auf `localhost:5000`
landet dort und bekommt eine leere 403-Antwort. Deshalb zielt der Proxy auf `127.0.0.1`.
