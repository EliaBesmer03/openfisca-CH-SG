/**
 * Prüft texte/de.ts nach PLAN B10: jedes Flag, jeder Status, jede Antwortoption und jeder
 * Quellentyp hat einen Text; Sprachregeln (Sätze unter 20 Wörtern, „Sie“-Form, „CHF 1’040“).
 */
import { describe, expect, it } from 'vitest'
import type { Pruefschritt, RegelStatus } from '../api/trace'
import {
  AngebotTyp,
  Ausnahmegrund,
  Partnerschaft,
  Pruefstatus,
  Quellentyp,
  Schulstufe,
  flagNamen,
} from '../vertrag'
import { texte } from './de'
import { chf, chfRund } from './format'

/** Alle Texte als Strings; Funktionen werden mit Beispielwerten aufgerufen. */
function alleTexte(wert: unknown, pfad = 'texte'): { pfad: string; text: string }[] {
  if (typeof wert === 'string') return [{ pfad, text: wert }]
  if (typeof wert === 'function') {
    const beispiel = Array.from({ length: wert.length }, (_, i) => (i === 0 ? 'Lina' : 'CHF 325'))
    const r = (wert as (...a: unknown[]) => unknown)(...beispiel)
    return typeof r === 'string' ? [{ pfad: `${pfad}()`, text: r }] : []
  }
  if (wert && typeof wert === 'object') {
    return Object.entries(wert).flatMap(([k, v]) => alleTexte(v, `${pfad}.${k}`))
  }
  return []
}

const texteListe = alleTexte(texte)

describe('texte/de.ts – Vollständigkeit (B10)', () => {
  it('jedes Flag aus A6 hat einen Text', () => {
    for (const f of flagNamen) expect(texte.flags[f]?.trim().length, f).toBeGreaterThan(0)
  })

  it('jeder Prüfstatus hat Titel, Symbol und Satz', () => {
    for (const s of Pruefstatus.werte) {
      expect(texte.status[s].titel.length, s).toBeGreaterThan(0)
      expect(texte.status[s].symbol.length, s).toBeGreaterThan(0)
      expect(texte.satz[s], s).toBeTypeOf('function')
    }
  })

  it('jede Antwortoption und jeder Quellentyp hat eine Bezeichnung', () => {
    const paare: [readonly string[], Record<string, string>][] = [
      [Schulstufe.werte, texte.optionen.schulstufe],
      [AngebotTyp.werte, texte.optionen.angebotTyp],
      [Partnerschaft.werte, texte.optionen.partnerschaft],
      [Ausnahmegrund.werte, texte.optionen.ausnahmegrund],
      [Quellentyp.werte, texte.quellentyp],
    ]
    for (const [werte, labels] of paare) for (const w of werte) expect(labels[w], w).toBeTruthy()
  })

  it('jeder Prüfschritt und jeder Regelstatus der Warum-Ansicht hat einen Text', () => {
    const schritte: Pruefschritt[] = ['wohnsitz', 'pensum', 'ausnahme', 'alter', 'angebot', 'einkommen', 'aktuell', 'hoechstbeitrag', 'einkommensfaktor', 'stunden', 'kostendeckel', 'beginn']
    const status: RegelStatus[] = ['ERFUELLT', 'NICHT_ERFUELLT', 'UNBEKANNT', 'ERMESSEN', 'INFO', 'NICHT_RELEVANT', 'NICHT_ERMITTELT']
    for (const s of schritte) expect(texte.warum.schritte[s]).toBeTruthy()
    for (const s of status) expect(texte.warum.status[s].text).toBeTruthy()
  })

  it('Banner entspricht B10', () => {
    expect(texte.banner).toBe(
      'Simulation, keine Verfügung. Das Gesetz gilt ab 1. August 2028. Die Zahlen stammen aus dem Verordnungsentwurf.',
    )
  })
})

describe('texte/de.ts – Sprachregeln (B10)', () => {
  // Formeln und Legenden sind keine Sätze im Sinne der Regel.
  const ausgenommen = /^texte\.warum\.formel\./

  it('Sätze haben weniger als 20 Wörter', () => {
    const zuLang: string[] = []
    for (const { pfad, text } of texteListe) {
      if (ausgenommen.test(pfad)) continue
      for (const satz of text.split(/(?<=[.!?])\s+/)) {
        const woerter = satz.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöü0-9]/.test(w))
        if (woerter.length >= 20) zuLang.push(`${pfad}: „${satz}“ (${woerter.length})`)
      }
    }
    expect(zuLang).toEqual([])
  })

  it('„Sie“-Form, keine Du-Form', () => {
    const du = texteListe.filter(({ text }) => /\b(du|dich|dir|dein|deine|deinen|deiner)\b/i.test(text))
    expect(du.map((d) => d.pfad)).toEqual([])
  })

  it('Beträge im Format „CHF 1’040“', () => {
    expect(chf(1040)).toBe('CHF 1’040.00')
    expect(chfRund(97000)).toBe('CHF 97’000')
    const falsch = texteListe.filter(({ text }) => /CHF\s?\d{1,3}'\d{3}|Fr\.\s?\d/.test(text))
    expect(falsch.map((f) => f.pfad)).toEqual([])
  })
})
