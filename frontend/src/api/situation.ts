/**
 * Formularzustand → Situationen (JSON für /calculate und /trace).
 *
 * Das Modell rechnet pro Gesuchseinheit (`familien`), und eine Person gehört genau einer an.
 * Kinder, für die dieselben Personen Elternteil sind, kommen in dieselbe Gesuchseinheit;
 * Patchwork-Familien ergeben mehrere Anfragen. Die Rollen folgen nur aus den Antworten:
 *
 * | Partner/in? | auch Elternteil des Kindes? | Rollen                                 | haushalt_form |
 * | nein        | –                           | Sie: erziehungsberechtigte             | GETRENNT      |
 * | ja          | ja                          | Sie + Partner/in: erziehungsberechtigte | GEMEINSAM     |
 * | ja          | nein                        | Sie: erziehungsberechtigte, Partner/in: partnerinnen | GETRENNT |
 *
 * Unbeantwortete Angaben (NaN, '', null) werden weggelassen; das Modell nimmt dann den
 * Standardwert. Ob alles Nötige beantwortet ist, prüft der Fragebogen.
 */
import { VOLLZUGSBEGINN_PERIODE } from '../konfiguration'
import {
  ENTITAET_PLURAL,
  F,
  HaushaltForm,
  ID,
  Partnerschaft,
  ROLLE,
  V,
  VARIABLEN,
  flagsDer,
  variablenDer,
  type Entscheid,
  type Familiendaten,
  type FlagName,
  type Personendaten,
  type Situation,
  type VariablenDef,
  type VariablenName,
  type Wert,
} from '../vertrag'
import type { Formular, FormularKind, FormularPerson } from '../zustand/formular'

export type Ausgabe = VariablenName | FlagName

/** Welche Ausgaben bei welcher Personengruppe bzw. der Familie angefragt werden. */
export type AusgabenAuswahl = {
  kind: readonly Ausgabe[]
  partner: readonly Ausgabe[]
  familie: readonly Ausgabe[]
}

const personAusgaben = [
  ...variablenDer({ entitaet: 'person', schicht: 'recht' }),
  ...variablenDer({ entitaet: 'person', schicht: 'anwendung' }),
]

export const ALLE_AUSGABEN: AusgabenAuswahl = {
  kind: [...personAusgaben.filter((n) => n !== V.partner_gefestigt), ...flagsDer('person')],
  partner: [V.partner_gefestigt],
  familie: [
    ...variablenDer({ entitaet: 'familie', schicht: 'recht' }),
    ...variablenDer({ entitaet: 'familie', schicht: 'anwendung' }),
    ...flagsDer('familie'),
  ],
}

/** Ausgaben für die Zwischenprüfung im Fragebogen (früher Abbruch, Zusatzfragen). */
export const PRUEF_AUSGABEN: AusgabenAuswahl = {
  kind: [
    V.pruefstatus_kind,
    F.flag_kind_zu_jung,
    F.flag_kind_zu_alt,
    F.flag_angebot_nicht_anerkannt,
    F.flag_angebot_nicht_angemeldet,
    F.flag_kein_hoechstbeitrag,
  ],
  partner: [V.partner_gefestigt],
  familie: [V.pruefstatus, F.flag_wohnsitz_nicht_sg, F.flag_pensum_unter_minimum, F.flag_ausnahme_kein_grund],
}

export type GesuchsTyp = 'allein' | 'gemeinsam' | 'partner'

export type Gesuch = {
  typ: GesuchsTyp
  /** Positionen in Formular.kinder */
  kindIndizes: number[]
  situation: Situation
  periode: string
  /** Anzeigenamen der Kinder nach Personen-ID */
  namen: Record<string, string>
}

/** Berechnet wird der Monat des Gesuchs, frühestens der Monat des Vollzugsbeginns. */
export function periodeFuer(gesuchsdatum: string): string {
  const monat = /^\d{4}-\d{2}/.test(gesuchsdatum) ? gesuchsdatum.slice(0, 7) : VOLLZUGSBEGINN_PERIODE
  return monat < VOLLZUGSBEGINN_PERIODE ? VOLLZUGSBEGINN_PERIODE : monat
}

export function gesuchsTyp(f: Formular, kind: FormularKind): GesuchsTyp {
  if (f.partnerVorhanden !== true) return 'allein'
  return kind.partnerIstElternteil === false ? 'partner' : 'gemeinsam'
}

/** Jahre zwischen „zusammen seit“ (YYYY-MM) und dem Rechenmonat, auf Monate genau. */
export function jahreSeit(seit: string, periode: string): number | null {
  const a = /^(\d{4})-(\d{2})/.exec(seit)
  const b = /^(\d{4})-(\d{2})/.exec(periode)
  if (!a || !b) return null
  const monate = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]))
  return Math.max(0, monate) / 12
}

const beantwortet = (w: Wert | undefined): w is Exclude<Wert, null> =>
  w !== null && w !== undefined && w !== '' && !(typeof w === 'number' && !Number.isFinite(w))

/** Kinder nach Gesuchseinheit gruppieren (Reihenfolge: erstes Vorkommen). */
export function gruppiere(f: Formular, indizes: readonly number[] = f.kinder.map((_, i) => i)): [GesuchsTyp, number[]][] {
  const gruppen = new Map<GesuchsTyp, number[]>()
  for (const i of indizes) {
    const typ = gesuchsTyp(f, f.kinder[i])
    gruppen.set(typ, [...(gruppen.get(typ) ?? []), i])
  }
  return [...gruppen]
}

/**
 * @param partnerGefestigt Antwort des Modells (`partner_gefestigt`) aus der Zwischenprüfung.
 *   Bei `false` gehen Pensum und Einkommen der Partnerin / des Partners nicht in Gesuche, in denen
 *   sie / er nicht Elternteil ist: Sie zählen dort nicht (KiBV-8.2) und werden nicht erfragt.
 */
export function baueGesuche(
  f: Formular,
  ausgaben: AusgabenAuswahl = ALLE_AUSGABEN,
  indizes: readonly number[] = f.kinder.map((_, i) => i),
  partnerGefestigt: boolean | null = null,
): Gesuch[] {
  return gruppiere(f, indizes).map(([typ, kindIndizes]) => baueGesuch(f, typ, kindIndizes, ausgaben, partnerGefestigt))
}

function baueGesuch(
  f: Formular,
  typ: GesuchsTyp,
  kindIndizes: number[],
  ausgaben: AusgabenAuswahl,
  partnerGefestigt: boolean | null,
): Gesuch {
  const periode = periodeFuer(f.gesuchsdatum)
  const wert = (w: Wert) => ({ [periode]: w })
  const setze = (ziel: Record<string, unknown>, name: VariablenName, w: Wert | undefined) => {
    if (beantwortet(w)) ziel[name] = wert(w)
  }
  /** Nur senden, wenn vom Standardwert aus dem Vertrag abweichend. */
  const setzeWennAbweichend = (ziel: Record<string, unknown>, name: VariablenName, w: Wert | undefined) => {
    const def: VariablenDef = VARIABLEN[name]
    if (beantwortet(w) && w !== def.standard) ziel[name] = wert(w)
  }
  const frageAn = (ziel: Record<string, unknown>, namen: readonly Ausgabe[]) => {
    for (const n of namen) ziel[n] = wert(null)
  }

  const zweiPersonen = typ !== 'allein'
  /** Gemeinsame Veranlagung: ganzer Betrag bei Ihnen, 0 bei der Partnerin / dem Partner. */
  const person = (p: FormularPerson, istPartner: boolean): Personendaten => {
    const daten: Personendaten = {}
    setze(daten, V.erwerbspensum, p.erwerbspensum)
    if (istPartner && zweiPersonen && f.gemeinsamVeranlagt) setze(daten, V.me_veranlagung, 0)
    else if (p.meBekannt) setze(daten, V.me_veranlagung, p.meVeranlagung)
    else setzeWennAbweichend(daten, V.me_bekannt, false)
    return daten
  }

  const persons: Record<string, Personendaten> = { [ID.eb(1)]: person(f.sie, false) }
  const familie: Familiendaten = { [ROLLE.erziehungsberechtigte]: [ID.eb(1)] }

  if (typ === 'gemeinsam') {
    persons[ID.eb(2)] = person(f.partner, true)
    familie[ROLLE.erziehungsberechtigte] = [ID.eb(1), ID.eb(2)]
  } else if (typ === 'partner') {
    const p = partnerGefestigt === false ? {} : person(f.partner, true)
    if (f.verheiratet === true) setze(p, V.partnerschaft, Partnerschaft.EHE_ODER_EINGETRAGENE_PARTNERSCHAFT)
    if (f.verheiratet === false) {
      setze(p, V.partnerschaft, Partnerschaft.KONKUBINAT)
      setze(p, V.konkubinat_jahre, jahreSeit(f.zusammenSeit, periode))
    }
    frageAn(p, ausgaben.partner)
    persons[ID.partner] = p
    familie[ROLLE.partnerinnen] = [ID.partner]
  }

  const namen: Record<string, string> = {}
  familie[ROLLE.kinder] = kindIndizes.map((i) => {
    const k = f.kinder[i]
    const id = ID.kind(i + 1)
    if (k.name.trim()) namen[id] = k.name.trim()
    const p: Personendaten = {}
    setze(p, V.geburtsdatum, k.geburtsdatum)
    setze(p, V.schulstufe, k.schulstufe)
    setze(p, V.angebot_typ, k.angebotTyp)
    setze(p, V.angebot_angemeldet, k.angebotAngemeldet)
    setze(p, V.betreuungstage_pro_woche, k.betreuungstageProWoche)
    setze(p, V.betreuungsstunden_pro_tag, k.betreuungsstundenProTag)
    setze(p, V.kosten_pro_stunde, k.kostenProStunde)
    // Ohne Angabe beginnt die Betreuung am Tag des Gesuchs (keine Rückwirkung, keine Verspätung).
    setze(p, V.betreuungsbeginn, k.betreuungsbeginn || f.gesuchsdatum)
    frageAn(p, ausgaben.kind)
    persons[id] = p
    return id
  })

  // Ausgaben zuerst, damit überschreibbare Ausgaben (Z1/Z2) von Eingaben ersetzt werden.
  frageAn(familie, ausgaben.familie)
  setze(familie, V.wohngemeinde, f.wohngemeinde)
  setze(familie, V.haushalt_form, typ === 'gemeinsam' ? HaushaltForm.GEMEINSAMER_HAUSHALT : HaushaltForm.GETRENNTER_HAUSHALT)
  setze(familie, V.gesuchsdatum, f.gesuchsdatum)
  setzeWennAbweichend(familie, V.ausnahmegrund, f.ausnahmegrund)
  setzeWennAbweichend(familie, V.ausnahme_entscheid, f.ausnahmeEntscheid)
  if (f.einkommenGesunken && Number.isFinite(f.meAktuell)) {
    setze(familie, V.antrag_aktuelle_gegebenheiten, true)
    setze(familie, V.me_aktuell, f.meAktuell)
  }
  if (f.zusatzbeitragZ1 !== null) setze(familie, V.zusatzbeitrag_z1_pro_stunde, f.zusatzbeitragZ1)
  if (f.zusatzbeitragZ2 !== null) setze(familie, V.zusatzbeitrag_z2_pro_stunde, f.zusatzbeitragZ2)

  return {
    typ,
    kindIndizes,
    periode,
    namen,
    situation: {
      [ENTITAET_PLURAL.person]: persons,
      [ENTITAET_PLURAL.familie]: { [ID.familie]: familie },
    },
  }
}

/** Periode einer Situation (erster Periodenschlüssel der Familie), z. B. für Demo-Fälle. */
export function periodeVon(situation: Situation): string | null {
  for (const familie of Object.values(situation[ENTITAET_PLURAL.familie])) {
    for (const eintrag of Object.values(familie)) {
      if (!Array.isArray(eintrag)) {
        const periode = Object.keys(eintrag)[0]
        if (periode) return periode
      }
    }
  }
  return null
}

/** Kopie der Situation mit gesetztem Behördenentscheid (Entscheid-Simulation, KiBG-4.2). */
export function mitEntscheid(situation: Situation, periode: string, entscheid: Entscheid): Situation {
  const kopie = structuredClone(situation)
  for (const familie of Object.values(kopie[ENTITAET_PLURAL.familie])) {
    familie[V.ausnahme_entscheid] = { [periode]: entscheid }
  }
  return kopie
}

/** Eingabewert der Familie aus einer Situation lesen (für Anzeige, z. B. Wohngemeinde). */
export function familienEingabe(situation: Situation, name: VariablenName, periode: string): Wert | undefined {
  const familie = Object.values(situation[ENTITAET_PLURAL.familie])[0]
  const eintrag = familie?.[name]
  return eintrag === undefined || Array.isArray(eintrag) ? undefined : eintrag[periode]
}

/**
 * Ergänzt eine fertige Situation (z. B. Demo-Fall aus contract/fixtures) um alle Ausgaben,
 * damit Ergebnis und Warum-Ansicht dieselben Werte und Flags haben wie beim Fragebogen.
 * Vorhandene Einträge bleiben unverändert.
 */
export function mitAllenAusgaben(situation: Situation, periode: string, ausgaben: AusgabenAuswahl = ALLE_AUSGABEN): Situation {
  const kopie = structuredClone(situation)
  const personen = kopie[ENTITAET_PLURAL.person]
  const ergaenze = (ziel: Record<string, unknown> | undefined, namen: readonly Ausgabe[]) => {
    if (!ziel) return
    for (const n of namen) if (!(n in ziel)) ziel[n] = { [periode]: null }
  }
  for (const familie of Object.values(kopie[ENTITAET_PLURAL.familie])) {
    ergaenze(familie, ausgaben.familie)
    const rolle = (r: string) => (Array.isArray(familie[r]) ? (familie[r] as string[]) : [])
    for (const id of rolle(ROLLE.kinder)) ergaenze(personen[id], ausgaben.kind)
    for (const id of rolle(ROLLE.partnerinnen)) ergaenze(personen[id], ausgaben.partner)
  }
  return kopie
}
