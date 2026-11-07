/**
 * Formularzustand des Fragebogens. Reine UX-Daten, keine Rechtslogik.
 *
 * `null` heisst „noch nicht beantwortet“; leere Zahlen sind NaN, leere Daten ''.
 * Welche Personen in welcher Rolle ans Modell gehen, entscheidet api/situation.ts
 * allein aus den Antworten (Partner ja/nein, Elternteil des Kindes ja/nein).
 */
import {
  V,
  VARIABLEN,
  type AngebotTyp,
  type Ausnahmegrund,
  type Entscheid,
  type JaNeinUnbekannt,
  type Schulstufe,
  type Wohngemeinde,
} from '../vertrag'

export type FormularPerson = {
  erwerbspensum: number
  meVeranlagung: number
  meBekannt: boolean
}

export type FormularKind = {
  /** Nur für die Anzeige, wird nicht gesendet. */
  name: string
  /** YYYY-MM-DD */
  geburtsdatum: string
  schulstufe: Schulstufe | null
  angebotTyp: AngebotTyp | null
  angebotAngemeldet: JaNeinUnbekannt | null
  betreuungstageProWoche: number
  betreuungsstundenProTag: number
  kostenProStunde: number
  /** Frage 7: Ist die Partnerin / der Partner auch Elternteil dieses Kindes? */
  partnerIstElternteil: boolean | null
  /** „Genauer rechnen“; leer = Tag des Gesuchs. */
  betreuungsbeginn: string
}

export type Formular = {
  wohngemeinde: Wohngemeinde | ''
  /** Frage 6 */
  partnerVorhanden: boolean | null
  /** Frage 8 */
  verheiratet: boolean | null
  /** Frage 8, bei nicht verheiratet: YYYY-MM */
  zusammenSeit: string
  /** Frage 11: ein Wert für beide (gemeinsame Steuerveranlagung) */
  gemeinsamVeranlagt: boolean
  sie: FormularPerson
  partner: FormularPerson
  kinder: FormularKind[]
  /** Frage 10; null = nicht gefragt */
  ausnahmegrund: Ausnahmegrund | null
  /** Nicht im Fragebogen; nur für die Entscheid-Simulation auf der Ergebnisseite. */
  ausnahmeEntscheid: Entscheid
  // ---------- Genauer rechnen ----------
  /** YYYY-MM-DD */
  gesuchsdatum: string
  einkommenGesunken: boolean
  meAktuell: number
  zusatzbeitragZ1: number | null
  zusatzbeitragZ2: number | null
}

const LEER = Number.NaN

export function leerePerson(): FormularPerson {
  return { erwerbspensum: LEER, meVeranlagung: LEER, meBekannt: VARIABLEN[V.me_bekannt].standard }
}

export function leeresKind(): FormularKind {
  return {
    name: '',
    geburtsdatum: '',
    schulstufe: null,
    angebotTyp: null,
    angebotAngemeldet: null,
    betreuungstageProWoche: LEER,
    betreuungsstundenProTag: LEER,
    kostenProStunde: LEER,
    partnerIstElternteil: null,
    betreuungsbeginn: '',
  }
}

export function leeresFormular(gesuchsdatum: string): Formular {
  return {
    wohngemeinde: '',
    partnerVorhanden: null,
    verheiratet: null,
    zusammenSeit: '',
    gemeinsamVeranlagt: false,
    sie: leerePerson(),
    partner: leerePerson(),
    kinder: [leeresKind()],
    ausnahmegrund: null,
    ausnahmeEntscheid: VARIABLEN[V.ausnahme_entscheid].standard,
    gesuchsdatum,
    einkommenGesunken: false,
    meAktuell: LEER,
    zusatzbeitragZ1: null,
    zusatzbeitragZ2: null,
  }
}
