# Fixtures

Request/Response/Trace der Demo-Familien (PLAN A9). Besitz: R2 (Fall), I1 (Format und Generierung).

Alle Dateien sind mit dem aktuellen Modell generiert (Stand 7.11.2026):

- **Request:** Eingaben der 10 Demo-Fälle F1 bis F10 (F2: wie F1, Periode 2027-09). Sie stammen aus den
  früheren Modelltests und sind für die Vorführung neu nummeriert. Die Nummern entsprechen nicht denen
  der Testfälle in `openfisca_ch_sg/tests/kibg/`. Angefragt werden alle
  Variablen mit Formel, bei jeder Person und der Familie, ausser sie sind Eingabe.
- **Response:** Antwort von `/calculate`, **Trace:** Antwort von `/trace` der OpenFisca-Web-API.

Datumswerte kommen im HTTP-Format (`"Tue, 15 Aug 2028 00:00:00 GMT"`), Beträge als float32
(z. B. `325.00003`).

Neu generieren, wenn sich Modell oder Testfälle ändern: Modell starten
(`uv run openfisca serve --country-package openfisca_ch_sg --port 5001`), dann jede Request-Datei an
`/calculate` und `/trace` schicken und die Antworten als `.response.json` und `.trace.json` speichern.
