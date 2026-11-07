/** Gemeinsame Testdaten: Demo-Familie F1 (Paar mit gemeinsamem Kind) als Formularzustand. */
import { AngebotTyp, JaNeinUnbekannt, Schulstufe } from '../vertrag'
import { leeresFormular, type Formular } from '../zustand/formular'

export function formularF1(): Formular {
  const f = leeresFormular('2028-08-30')
  f.wohngemeinde = 'ST_GALLEN'
  f.partnerVorhanden = true
  f.sie = { erwerbspensum: 100, meVeranlagung: 60000, meBekannt: true }
  f.partner = { erwerbspensum: 60, meVeranlagung: 37000, meBekannt: true }
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
      betreuungsbeginn: '2028-08-15',
    },
  ]
  return f
}
