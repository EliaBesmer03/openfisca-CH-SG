/**
 * Zwischenprüfung im Fragebogen: schickt die bisherigen Angaben ans Modell und liest nur Flags.
 *
 * Das Frontend entscheidet damit nichts Rechtliches selbst:
 * - früher Abbruch, wenn das Modell zur eben beantworteten Frage ein Flag „kein Anspruch“ setzt,
 * - Frage 10 (Grund für tieferes Pensum), wenn das Modell `flag_pensum_unter_minimum` meldet,
 * - Pensum und Einkommen der Partnerin / des Partners, wenn das Modell sie als gefestigt meldet.
 *
 * Fehlende Angaben gehen mit Standardwerten ans Modell. Deshalb zählen nur Flags zu Fragen,
 * die schon beantwortet sind (siehe ABBRUCH_FLAGS im Fragebogen).
 */
import { ENTITAET_PLURAL, ID, ROLLE, V, type FlagName } from '../vertrag'
import type { Formular } from '../zustand/formular'
import { RohSituationSchema } from './antwort'
import type { Client } from './client'
import { PRUEF_AUSGABEN, baueGesuche, type GesuchsTyp } from './situation'

export type Zwischenstand = {
  /** Gesetzte Flags pro Kind (Index in Formular.kinder) */
  kindFlags: Record<number, FlagName[]>
  /** Gesetzte Familien-Flags pro Gesuchseinheit */
  familienFlags: Partial<Record<GesuchsTyp, FlagName[]>>
  /** null = unbekannt (noch nicht gefragt oder Modell nicht erreichbar) */
  partnerGefestigt: boolean | null
}

export const LEERER_ZWISCHENSTAND: Zwischenstand = { kindFlags: {}, familienFlags: {}, partnerGefestigt: null }

const gesetzt = (eintraege: Record<string, unknown> | undefined, periode: string, namen: readonly string[]) =>
  namen.filter((n) => (eintraege?.[n] as Record<string, unknown> | undefined)?.[periode] === true) as FlagName[]

export async function pruefeZwischenstand(client: Client, f: Formular): Promise<Zwischenstand> {
  const stand: Zwischenstand = { kindFlags: {}, familienFlags: {}, partnerGefestigt: null }
  for (const gesuch of baueGesuche(f, PRUEF_AUSGABEN)) {
    const roh = RohSituationSchema.parse(await client.calculate(gesuch.situation))
    const personen = roh[ENTITAET_PLURAL.person]
    const familie = roh[ENTITAET_PLURAL.familie][ID.familie] as Record<string, unknown>
    stand.familienFlags[gesuch.typ] = gesetzt(familie, gesuch.periode, PRUEF_AUSGABEN.familie)
    const kinder = (familie[ROLLE.kinder] as string[] | undefined) ?? []
    gesuch.kindIndizes.forEach((i, pos) => {
      stand.kindFlags[i] = gesetzt(personen[kinder[pos]], gesuch.periode, PRUEF_AUSGABEN.kind)
    })
    const gefestigt = personen[ID.partner]?.[V.partner_gefestigt]?.[gesuch.periode]
    if (typeof gefestigt === 'boolean') stand.partnerGefestigt = gefestigt
  }
  return stand
}
