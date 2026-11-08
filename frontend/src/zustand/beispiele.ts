/**
 * Beispielfamilie für die Vorführung: vorausgefüllter Fragebogen.
 *
 * Familie Meier: eine gewöhnliche Familie. Sara arbeitet 60 %, ihr Partner 100 %, Lina (2) ist
 * zwei Tage pro Woche in der Kita. Ergebnis laut Modell: CHF 325 pro Monat.
 */
import { AngebotTyp, JaNeinUnbekannt, Schulstufe } from '../vertrag'
import { leeresFormular, type Formular } from './formular'

export function familieMeier(gesuchsdatum: string): Formular {
  const f = leeresFormular(gesuchsdatum)
  f.wohngemeinde = 'ST_GALLEN'
  f.partnerVorhanden = true
  f.sie = { erwerbspensum: 60, meVeranlagung: 37000, meBekannt: true }
  f.partner = { erwerbspensum: 100, meVeranlagung: 60000, meBekannt: true }
  f.kinder = [
    {
      name: 'Lina',
      geburtsdatum: '2026-06-15',
      schulstufe: Schulstufe.VORSCHULALTER,
      angebotTyp: AngebotTyp.KITA,
      angebotAngemeldet: JaNeinUnbekannt.JA,
      betreuungstageProWoche: 2,
      betreuungsstundenProTag: 10,
      kostenProStunde: 12,
      partnerIstElternteil: true,
      betreuungsbeginn: '',
    },
  ]
  return f
}
