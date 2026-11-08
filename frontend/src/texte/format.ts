/** Formatierung für die Anzeige (de-CH): „CHF 1’040.00“, „15.08.2028“. */
import { ID, V, VARIABLEN, gemeindeName, istSonderwert, type VariablenDef } from '../vertrag'
import { texte } from './de'
import type { Rechnung } from '../api/trace'

/** de-CH mit typografischem Apostroph als Tausendertrennzeichen („1’040“), unabhängig von der ICU-Version. */
function zahlFormat(optionen: Intl.NumberFormatOptions) {
  const f = new Intl.NumberFormat('de-CH', optionen)
  return { format: (n: number) => f.format(n).replace(/'/g, '’') }
}

const genau = zahlFormat({ minimumFractionDigits: 2, maximumFractionDigits: 2 })
const gerundet = zahlFormat({ maximumFractionDigits: 0 })
const prozent = zahlFormat({ style: 'percent', maximumFractionDigits: 1 })

export const chf = (betrag: number) => `${texte.einheiten.chf} ${genau.format(betrag)}`
export const chfRund = (betrag: number) => `${texte.einheiten.chf} ${gerundet.format(betrag)}`
export { zahlFormat }
export const alsProzent = (anteil: number) => prozent.format(anteil)

export function datum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return t && m && j ? `${t}.${m}.${j}` : iso
}

/** Anzeigename einer Person: eingegebener Name, sonst `kind_2` → „Kind 2“, `lina` → „Lina“. */
export function personName(id: string, namen?: Readonly<Record<string, string>>): string {
  if (namen?.[id]) return namen[id]
  if (id === ID.eb(1)) return texte.personen.sie
  if (id === ID.eb(2) || id === ID.partner) return texte.personen.partner
  const nr = /^kind_(\d+)$/.exec(id)
  if (nr && id === ID.kind(Number(nr[1]))) return texte.personen.kind(Number(nr[1]))
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/** „A“, „A und B“, „A, B und C“ */
export function aufzaehlen(teile: string[]): string {
  if (teile.length <= 1) return teile.join('')
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
}

// ---------- Rechnung nach dem Anhang KiBV (nur Anzeige von Modellwerten, keine eigene Rechnung) ----------


const zweiStellen = (n: number) => genau.format(n)
const ganz = (n: number) => gerundet.format(n)
const kurz = zahlFormat({ maximumFractionDigits: 2 })
const kurz3 = zahlFormat({ maximumFractionDigits: 3 })

export function rechnungZeilen(r: Rechnung): string[] {
  const t = texte.warum.formel
  const f = (n: number | null, fmt: (n: number) => string) => (n === null ? t.fehlt : fmt(n))
  const zeilen = [
    t.b(f(r.maxV, zweiStellen), f(r.z1, zweiStellen), f(r.me, ganz), f(r.minMe, ganz), f(r.maxMe, ganz), f(r.z2, zweiStellen), f(r.bProStunde, zweiStellen)),
  ]
  const stunden = t.stunden(
    f(r.bProStunde, zweiStellen),
    f(r.stundenMonat, zweiStellen),
    f(r.tageProWoche, (n) => kurz.format(n)),
    f(r.stundenProTag, (n) => kurz.format(n)),
    f(r.wochenProMonat, (n) => kurz3.format(n)),
  )
  if (r.kostendeckelGreift === false && r.beitragTotal !== null) {
    zeilen.push(`${stunden} ${t.ergebnis(chf(r.beitragTotal))}`)
    if (r.kostenMonat !== null) zeilen.push(t.deckelGreiftNicht(chf(r.kostenMonat)))
  } else {
    zeilen.push(stunden)
    if (r.kostendeckelGreift === true && r.beitragTotal !== null) zeilen.push(t.deckelGreift(chf(r.beitragTotal)))
    else if (r.beitragTotal !== null) zeilen.push(t.ergebnis(chf(r.beitragTotal)))
  }
  return zeilen
}

/** Wert einer Variable für die Anzeige (Einheit, Ja/Nein, Datum, Enum-Bezeichnung). */
const anzeigeZahl = zahlFormat({ maximumFractionDigits: 2 })

export function wertText(name: string, wert: unknown): string {
  if (wert === undefined || wert === null) return texte.ergebnis.nichtErmittelt
  if (typeof wert === 'boolean') return wert ? texte.frage.ja : texte.frage.nein
  const def: VariablenDef | undefined = (VARIABLEN as Record<string, VariablenDef>)[name]
  if (typeof wert === 'number') {
    if (def?.einheit?.startsWith('CHF')) return def.einheit === 'CHF/h' ? `${chf(wert)} ${texte.einheiten.proStunde}` : chf(wert)
    const einheit = def?.einheit && (texte.einheiten.vertrag[def.einheit] ?? def.einheit)
    return einheit ? `${anzeigeZahl.format(wert)} ${einheit}` : anzeigeZahl.format(wert)
  }
  if (typeof wert === 'string') {
    if (name === V.wohngemeinde && !istSonderwert(wert)) return gemeindeName(wert)
    if (def?.typ === 'date') return datum(wert)
    const o = texte.optionen as Record<string, Record<string, string>>
    for (const gruppe of Object.values(o)) if (wert in gruppe) return gruppe[wert]
    return texte.werte[wert] ?? wert
  }
  return JSON.stringify(wert)
}

/** „03.2025“ oder „3.2025“ → „2025-03“; sonst null. */
export function monatJahrAusText(text: string): string | null {
  const m = /^\s*(\d{1,2})\s*[./]\s*(\d{4})\s*$/.exec(text)
  if (!m) return null
  const monat = Number(m[1])
  return monat >= 1 && monat <= 12 ? `${m[2]}-${String(monat).padStart(2, '0')}` : null
}
