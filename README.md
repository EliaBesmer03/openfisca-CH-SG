# Kinderbetreuungsbeiträge St.Gallen – Rules as Code

Ein Rechner, der Familien sagt, ob und wie viel Beitrag sie nach dem neuen St.Galler Kinderbetreuungsgesetz erhalten, und warum. Das Recht ist in OpenFisca modelliert, ein React-Frontend stellt die Fragen in einfacher Sprache.

Stand: 8. November 2026.

## 1. Problem

Ab August 2028 haben Eltern im Kanton St.Gallen erstmals einen **Rechtsanspruch** auf Beiträge an die Kita, die Tagesfamilie oder den Hort. Grundlage sind das totalrevidierte Gesetz (KiBG, Volksabstimmung 14.6.2026) und der Verordnungsentwurf (KiBV, Vernehmlassung bis 15.11.2026).

Für Familien ist die Rechtslage schwer verständlich:

- Der Anspruch hängt an mehreren Bedingungen: Wohnsitz, Alter des Kindes, Erwerbspensum (20 % allein, 120 % als Paar), anerkanntes Angebot.
- Die Höhe ergibt sich aus einer Formel im Anhang der Verordnung, abhängig von Einkommen, Stunden und Alter.
- Gesetz und Verordnung lassen Fragen offen, und an einer Stelle entscheidet die Gemeinde nach Ermessen.

Eltern wissen deshalb vor dem Gesuch nicht, ob es sich lohnt, und die Gemeinden müssen dieselben Fragen immer wieder beantworten.

## 2. Lösung

Wir haben KiBG und KiBV als ausführbares Modell umgesetzt. Für eine Familie und einen Monat beantwortet es:

1. **Anspruch:** ja, nein, Angaben fehlen, oder Prüfung durch die Gemeinde?
2. **Höhe:** Beitrag pro Kind und Monat, aufgeteilt auf Kanton und Gemeinde.
3. **Verfahren:** Ab wann wird bezahlt, und wie lange gilt die Verfügung?

Jedes Ergebnis zeigt die Bestimmungen, auf denen es beruht, mit Originalwortlaut. Der Rechner ist eine unverbindliche Information. Er ersetzt weder das Gesuch noch den Entscheid der Gemeinde.

## 3. Architektur

```
Frontend (React)  ──JSON──▶  OpenFisca Web-API  ──▶  Erklärungsschicht  ──▶  Rechtsschicht
Fragebogen, Ergebnis,        /calculate              Status, 26 Hinweise      KiBG/KiBV-Variablen,
Warum-Ansicht                                                                 Parameter mit Fundstelle
```

**Grundsatz: Recht wird nur im Modell berechnet, nie im Frontend.** Das Frontend übersetzt Antworten in eine API-Anfrage und zeigt das Ergebnis an.

**Rechtsschicht** (`openfisca_ch_sg/variables/kibg/`). Jede Variable entspricht einer Bestimmung, z. B. `erwerbspensum_erfuellt` für Art. 4 Abs. 1 lit. a/b KiBG. Die Formel aus dem Anhang der KiBV steht fast wörtlich im Code:

> B = (MaxV + Z1) × (1 − (ME − MinmE) / (MaxmE − MinmE)) + Z2

Alle Beträge und Grenzen liegen als Parameter mit Fundstelle in `parameters/`. Ändert die Regierung nach der Vernehmlassung einen Wert, ändert sich eine Datei.

**Erklärungsschicht** (`openfisca_ch_sg/variables/anwendung/`). Sie leitet aus der Rechtsschicht einen Status ab (*Anspruch*, *Prüfung durch die Gemeinde*, *Angaben fehlen*, *kein Anspruch*, *noch nicht in Kraft*) und 26 Hinweise, warum dieser Status entsteht (z. B. „Kind jünger als drei Monate“). Sie liest die Rechtsschicht, aber nie umgekehrt. So bleibt der Rechtscode Zeile für Zeile mit dem Gesetz vergleichbar, und die Erklärung für Eltern lässt sich ändern, ohne das Recht anzufassen.

**Regeltabelle** (`contract/regeln.json`). Sie enthält alle 142 Bestimmungen beider Erlasse mit Wortlaut, Kurzfassung in einfacher Sprache, Quelle und Umsetzung. 63 sind modelliert, 79 bewusst nicht (Plattform, Datenschutz, Zahlungsflüsse, Zuständigkeiten, Budget), jeweils mit Begründung. Sie haben keinen Einfluss auf den Einzelfall. Das Frontend zeigt die Wortlaute aus dieser Tabelle an.

**Warum OpenFisca?** Es trennt Formeln, Parameter und Testfälle, kennt zeitabhängige Werte und bringt eine Web-API mit. Testfälle sind YAML-Dateien, die auch das Rechtsteam lesen und ergänzen kann.

## 4. Vom Recht zum Code

**Rechtsstand im Modell.** Jede Formel gilt erst ab dem 1. August 2028. Für frühere Monate meldet das Modell „noch nicht in Kraft“. Werte aus der Verordnung sind als Entwurf gekennzeichnet.

**Systemgrenze.** Wo das KiBG auf anderes Recht verweist, fragen wir den Sachverhalt ab, statt das andere Recht zu modellieren:

| Begriff | Verweis | Im Modell |
| --- | --- | --- |
| Wohnsitz | ZGB | Auswahl der Wohngemeinde (75 politische Gemeinden) |
| Obhut, Erziehungsberechtigung | Case Law (Bundesgericht) | Rolle in der Familie |
| bewilligte Kita, gemeldete Tagesfamilie | Pflegekinderverordnung | Art des Angebots, „beim Kanton angemeldet?“ |
| massgebendes Einkommen | V zum EG-KVG Art. 12 | Eingabe des Werts |

**Ermessen bleibt bei der Gemeinde.** Nur an einer Stelle hat die Gemeinde Ermessen: Sie *kann* in Ausnahmefällen auf das Mindestpensum verzichten (Art. 4 Abs. 2 KiBG). Das Modell prüft nur, ob ein Grund nach Art. 12 KiBV vorliegt, und zeigt dann „Prüfung durch die Gemeinde“, zusammen mit dem Ergebnis bei Bewilligung und bei Ablehnung.

**Unklarheiten und Entscheide.** Wo der Text mehrdeutig ist, hat das Rechtsteam entschieden und wir haben es dokumentiert:

| Stelle | Frage | Entscheid |
| --- | --- | --- |
| Art. 4 Abs. 2 KiBG, Art. 12 KiBV | Ist die Entbindung zwingend, wenn ein Grund vorliegt? | Nein, Ermessen der Gemeinde; ohne Grund keine Entbindung |
| Art. 4 Abs. 1 lit. a/b KiBG | Paar: Reicht die Summe von 120 %, oder braucht jede Person 20 %? | Summe genügt |
| Art. 4 Abs. 3 KiBG, Art. 14 KiBV | Gilt der Kindergarten als eingeschult? | Ja, sonst gäbe es für Kindergartenkinder im Hort keinen Höchstbeitrag |
| Art. 11 Abs. 2 KiBV | 25 % Abweichung wovon, in welche Richtung? | Rückgang gegenüber der Veranlagung, nur auf Antrag |
| Art. 6 Abs. 2, Art. 20 Abs. 3 KiBG | Welche Kosten deckeln den Beitrag? | Betreuungskosten ohne Verpflegung |
| Art. 9 Abs. 2 KiBG | Was ist das „Datum der Inanspruchnahme“? | Erster Betreuungstag |
| Art. 14 KiBV | Was gilt bei genau 18 Monaten? | Ab diesem Tag der tiefere Satz; im Übergangsmonat tageweise gerechnet (gleich bei 3 Monaten) |
| Art. 3 Abs. 2 lit. d KiBG | Höchstbeitrag für Sonderschulen fehlt | Wie schulergänzende Betreuung (CHF 5.50); vor Einschulung kein Beitrag |
| Art. 15 Abs. 2 KiBV | Gilt „über CHF 154 000 kein Beitrag“ auch für den Gemeindezuschlag? | Ja |
| Art. 14 KiBV | Schulergänzende Betreuung vor Einschulung | Keine Lücke, die Kombination gibt es nicht |
| Art. 16 KiBV | Wie lange gilt die Verfügung? | 12 Monate, im Jahr des Schuleintritts nur bis Schulbeginn |
| Art. 4 Abs. 1 KiBG | Müssen alle Erziehungsberechtigten im Kanton wohnen? | Bei getrenntem Haushalt zählt die gesuchstellende Person |
| Art. 24 KiBV | Dürfen Gemeinden Zuschläge frei gestalten? | Nein, nur über Z1 und Z2 der Formel |
| Art. 4 Abs. 1 lit. b KiBG, Art. 8 KiBV | Gilt die 120-%-Regel mit neuer Partnerin oder neuem Partner? | Ja, sobald die Beziehung gefestigt ist (Ehe oder zwei Jahre Konkubinat) |

## 5. Verantwortung und Risiken

- **Grenzen der Automatisierung.** Das Ergebnis ist eine Schätzung, keine Verfügung. Wo die Gemeinde Ermessen hat, rechnet das Modell nicht weiter. Fehlen Angaben, sagt es „Angaben fehlen“ und welche, statt zu raten.
- **Transparenz.** Jeder Rechenschritt verweist auf seine Fundstelle, die Warum-Ansicht zeigt den Wortlaut. Wo das Gesetz unklar ist, steht unser Entscheid mit Begründung in der Tabelle „Unklarheiten und Entscheide“ (Abschnitt 4). Der Code ist öffentlich.
- **Fairness.** Gleiche Fälle werden gleich behandelt, unabhängig von Gemeinde und Sachbearbeitung. Ungleiche Folgen einer Auslegung machen wir sichtbar: Nach unserer Auslegung von Art. 4 Abs. 1 lit. b KiBG muss ein Elternteil mit gefestigter neuer Partnerschaft zusammen 120 % arbeiten, ohne Partner nur 20 %.
- **Datenschutz.** Kein Login, kein Name, keine AHV-Nummer. Die Angaben gehen nur für die einzelne Berechnung an die API und werden nicht gespeichert.
- **Verantwortlichkeit.** Auslegungen und Sollwerte stammen vom Rechtsteam, die Umsetzung vom Techteam. Ändert sich ein Wert, zeigen die Tests sofort, welche Fälle betroffen sind.

**Grenzen des Prototyps:**

- Übergangsregel (Art. 25 KiBV) nicht modelliert; es gilt immer die 30-Tage-Frist von Art. 9 Abs. 2 KiBG.
- Massgebendes Einkommen wird eingegeben
- Eine Berechnung pro Monat; Änderungen während einer Verfügung (Art. 11 Abs. 3, Art. 16 Abs. 3 KiBV) fehlen.
- Ein Monat hat 52/12 Wochen (Annahme); Module und Monatspauschalen (Art. 14 Abs. 5 KiBV) fehlen mangels Richtlinie.
- Zusatzbeiträge aller Gemeinden sind CHF 0, bis Beschlüsse vorliegen.

## 6. Tests

**Testfälle des Rechtsteams.** 63 Familien mit Sollwerten im YAML-Format, 26 Normalfälle und 37 Grenzfälle. Das Modell muss genau diese Werte liefern. Die Fälle sind nach Thema aufgeteilt (`openfisca_ch_sg/tests/kibg/test_01_standardfamilien.yaml` bis `test_09_mehrere_kinder.yaml`). Ein neuer Fall entsteht, indem man einen bestehenden kopiert und die Angaben ändert, ohne Programmierkenntnisse.

Beispiele für Grenzfälle: Kind wird am 1. oder 16. drei Monate alt; Pensum 19/20 % allein und 119/120 % als Paar; Konkubinat 1,9/2 Jahre; Einkommen CHF 39 999/40 000 und 154 000/154 001; Rückgang 24,9/25 %; Gesuch nach 30/31 Tagen; Monat vor und nach Inkrafttreten.

**Abgleichtests.** 70 weitere Tests prüfen, dass Regeltabelle und Code übereinstimmen und dass Rechts- und Erklärungsschicht sich nicht widersprechen. Zusammen sind es **133 Tests**, alle bestanden.

**Demo-Fälle.** In `contract/fixtures/` liegen 10 Beispielfamilien mit gespeicherten API-Antworten. So lässt sich der Rechner ohne laufendes Modell vorführen. Jeder Fall zeigt ein anderes Ergebnis des Rechners:

| Fall | Zeigt |
| --- | --- |
| F1 Standardfamilie | Anspruch, CHF 325 pro Monat (wie Familie Meier) |
| F2 Standardfamilie 2027 | noch nicht in Kraft |
| F3 Alleinerziehend, Hort | schulergänzende Betreuung, 20-%-Regel allein |
| F4 110 % + 10 % | 120-%-Regel als Paar, Summe genügt |
| F5 Einkommen über MaxmE | Anspruch, aber Beitrag CHF 0 |
| F6 Kind 2 Monate | Kind zu jung |
| F7 Kind wird im Monat 18 Monate | tageweise Rechnung im Übergangsmonat |
| F8 Ausnahme offen | Prüfung durch die Gemeinde |
| F9 Konkubinat, Partner 20 % | neue Partnerschaft zählt mit |
| F10 Wohnsitz ausserkantonal | kein Anspruch |

## 7. Installation

Voraussetzungen: Python 3.11, [uv](https://docs.astral.sh/uv/), Node.js mit npm, Git.

**Modell** (im Repo-Root):

```sh
uv sync      # installiert OpenFisca-Core 44.7.1 und das Modell
make test    # alle 133 Tests
uv run openfisca serve --country-package openfisca_ch_sg --bind 127.0.0.1:5001
```

Die API läuft auf `http://127.0.0.1:5001` (Port 5001, weil macOS Port 5000 für AirPlay belegt).

**Frontend** (im Ordner `frontend/`):

```sh
npm install
API_ZIEL=http://127.0.0.1:5001 npm run dev:live   # mit laufendem Modell, http://localhost:5173
npm run dev:demo                                  # ohne Modell, mit den 10 Demo-Fällen
npm test                                          # Frontend-Tests
```

**Schnell ausprobieren** (ohne Modell, nur Node.js nötig):

1. Im Ordner `frontend/` `npm install` und `npm run dev:demo` ausführen, dann `http://localhost:5173` öffnen.
2. Bei „Beispiel: Familie Meier“ auf **Direkt zum Ergebnis** klicken. Erwartet: Anspruch, rund **CHF 325 pro Monat** für Lina. Mit **Warum?** erscheinen die Bestimmungen, auf denen das Ergebnis beruht.
3. Unter **Weitere Testfälle** weitere Familien öffnen, zum Beispiel:
   - **F2:** gleiche Familie im Jahr 2027 → noch nicht in Kraft
   - **F6:** Kind 2 Monate alt → kein Anspruch, Kind zu jung
   - **F8:** Pensum zu tief, Ausnahmegrund vorhanden → Prüfung durch die Gemeinde

Mit **Rechner starten** lässt sich der Fragebogen selbst ausfüllen. Im Demo-Modus gibt es nur für die vorbereiteten Familien ein Ergebnis, für eigene Angaben braucht es das laufende Modell (`dev:live`).

**Aufbau:**

| Pfad | Inhalt |
| --- | --- |
| `openfisca_ch_sg/variables/kibg/` | Rechtsschicht |
| `openfisca_ch_sg/variables/anwendung/` | Erklärungsschicht |
| `openfisca_ch_sg/parameters/` | Beträge und Grenzen mit Fundstelle |
| `openfisca_ch_sg/tests/` | Testfälle und Abgleichtests |
| `contract/regeln.json` | 142 Bestimmungen mit Wortlaut und Umsetzung |
| `contract/gemeinden.json` | 75 Gemeinden |
| `contract/fixtures/` | 10 Demo-Fälle: Anfrage und Antwort der API |
| `frontend/` | Rechner (React, Vite, TypeScript) |

## 8. Team, KI und Quellen

Wir haben im Team zwei Gruppen gebildet:

| Team | Personen | Beitrag |
| --- | --- | --- |
| Techteam | Leon Schwendener, Elia Besmer | OpenFisca-Modell, Regeln, Parameter, Umsetzung der Tests in YAML; Frontend mit Fragebogen, Ergebnis- und Warum-Ansicht, API-Anbindung |
| Rechtsteam | Dario Jacobi, Sebastian Meier | Auslegung der unklaren Stellen, Grenzfälle und Sollwerte der Testfälle, Fragen in einfacher Sprache |

Gemeinsame Aufgaben:

- **Dokumentation:** Leon Schwendener, Elia Besmer und Dario Jacobi
- **Präsentation:** Sebastian Meier

**KI-Einsatz.** Wir haben Claude Code (Anthropic) als Programmierassistenten genutzt: für Modell- und Frontend-Code, die Umsetzung der Testfälle in YAML, das Extrahieren der Regeln aus den amtlichen PDFs und Textentwürfe. Die KI hat Unklarheiten aufgezeigt und Lesarten vorgeschlagen. Entschieden hat das Rechtsteam, und alle Sollwerte stammen von ihm. Code und Texte haben wir selbst geprüft.

**Open Source.** OpenFisca Core und Country-Template (AGPL-3.0), uv, pytest, React, Vite, TypeScript, Vitest, Zod.

**Quellen.** KiBG, Ergebnis der 1. Lesung im Kantonsrat vom 16.9.2025 (Ratsinformationssystem St.Gallen); KiBV-Entwurf, RRB 2026/733, mit Medienmitteilung; Gemeindeliste nach BFS-Stand 1.1.2024 (Fachstelle für Statistik St.Gallen).


