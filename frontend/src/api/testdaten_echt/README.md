# Echte Antworten des Modells (Testdaten)

Mitschnitt der OpenFisca-API vom 7.11.2026 (Modell in `openfisca_ch_sg/`, lokal `openfisca serve --port 5001`).
Dienen den Frontend-Tests als Referenz für die echte Form von `/calculate` und `/trace`.

| Datei | Inhalt |
| --- | --- |
| `F01_voll.request.json` | Situation F1, gebaut vom Frontend (`baueSituation`), alle Ausgaben und Flags angefragt |
| `F01_voll.response.json` | Antwort `/calculate` darauf |
| `F01_voll.trace.json` | Antwort `/trace` darauf |
| `F01_a8.trace.json` | Antwort `/trace` auf `contract/fixtures/F01_standardfamilie.request.json` (Teilmenge aus A8) |

Ändert sich das Modell, neu erzeugen. Massgebend für den Offline-Modus bleiben die Fixtures in `contract/fixtures/`.
