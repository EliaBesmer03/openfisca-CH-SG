/** Formularfelder mit Labels; alle per Tastatur bedienbar. */
import { useId, useState } from 'react'
import { texte } from '../texte/de'
import { monatJahrAusText } from '../texte/format'

type ZahlProps = {
  label: string
  wert: number
  onChange: (wert: number) => void
  min?: number
  max?: number
  schritt?: number
  einheit?: string
  deaktiviert?: boolean
}

export function ZahlFeld({ label, wert, onChange, min, max, schritt = 1, einheit, deaktiviert }: ZahlProps) {
  const id = useId()
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <span className="feld__eingabe">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(wert) ? wert : ''}
          min={min}
          max={max}
          step={schritt}
          disabled={deaktiviert}
          onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
        {einheit && <span className="feld__einheit">{einheit}</span>}
      </span>
    </div>
  )
}

export function DatumFeld({
  label,
  wert,
  onChange,
  typ = 'date',
}: {
  label: string
  wert: string
  onChange: (w: string) => void
  /** 'month' für Monat und Jahr (YYYY-MM) */
  typ?: 'date' | 'month'
}) {
  const id = useId()
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={typ} value={wert} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function TextFeld({
  label,
  wert,
  onChange,
  autocomplete,
}: {
  label: string
  wert: string
  onChange: (w: string) => void
  autocomplete?: string
}) {
  const id = useId()
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={wert} autoComplete={autocomplete} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export type Option<T extends string> = { wert: T; label: string }

export function AuswahlFeld<T extends string>({
  legende,
  optionen,
  wert,
  onChange,
  verborgeneLegende,
}: {
  legende: string
  optionen: readonly Option<T>[]
  wert: T | null
  onChange: (w: T) => void
  verborgeneLegende?: boolean
}) {
  const name = useId()
  return (
    <fieldset className="auswahl">
      <legend className={verborgeneLegende ? 'sr-only' : undefined}>{legende}</legend>
      {optionen.map((o) => (
        <label key={o.wert} className="auswahl__option">
          <input type="radio" name={name} checked={wert === o.wert} onChange={() => onChange(o.wert)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

export function JaNeinFeld({ legende, wert, onChange }: { legende: string; wert: boolean | null; onChange: (w: boolean) => void }) {
  const auswahl = wert === null ? null : wert ? 'ja' : 'nein'
  return (
    <AuswahlFeld
      legende={legende}
      verborgeneLegende
      optionen={[
        { wert: 'ja', label: texte.frage.ja },
        { wert: 'nein', label: texte.frage.nein },
      ]}
      wert={auswahl}
      onChange={(w) => onChange(w === 'ja')}
    />
  )
}

export function WeissNichtFeld({ wert, onChange, label = texte.frage.weissNicht }: { wert: boolean; onChange: (w: boolean) => void; label?: string }) {
  return (
    <label className="weiss-nicht">
      <input type="checkbox" checked={wert} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

const alsText = (wert: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(wert)
  return m ? `${m[2]}.${m[1]}` : ''
}

/**
 * Monat und Jahr im Schweizer Format (MM.JJJJ). Gespeichert wird „JJJJ-MM“;
 * solange die Eingabe unvollständig ist, ''.
 */
export function MonatJahrFeld({
  label,
  hinweis,
  wert,
  onChange,
}: {
  label: string
  hinweis: string
  wert: string
  onChange: (w: string) => void
}) {
  const id = useId()
  const [text, setText] = useState(() => alsText(wert))
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="MM.JJJJ"
        aria-describedby={`${id}-hinweis`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(monatJahrAusText(e.target.value) ?? '')
        }}
      />
      <p id={`${id}-hinweis`} className="hilfe">
        {hinweis}
      </p>
    </div>
  )
}
