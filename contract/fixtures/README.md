# Fixtures

Request/Response/Trace der Demo-Familien (PLAN A9). Besitz: R2 (Fall), I1 (Format und Generierung).

Alle Dateien sind mit dem aktuellen Modell generiert (Stand 7.11.2026):

- **Request:** Eingaben wie im gleichnamigen Fall in `openfisca_ch_sg/tests/kibg/test_demo_familien.yaml`
  (F1x: wie F1, Periode 2027-09, kein Modelltest). Angefragt werden alle Variablen mit Formel, bei jeder
  Person und der Familie, ausser sie sind Eingabe.
- **Response:** Antwort von `/calculate`, **Trace:** Antwort von `/trace` der OpenFisca-Web-API.

Datumswerte kommen im HTTP-Format (`"Tue, 15 Aug 2028 00:00:00 GMT"`), Beträge als float32
(z. B. `325.00003`).

Neu generieren, wenn sich Modell oder Testfälle ändern: Modell starten
(`uv run openfisca serve --country-package openfisca_ch_sg --port 5001`), dann jede Request-Datei an
`/calculate` und `/trace` schicken und die Antworten als `.response.json` und `.trace.json` speichern.
