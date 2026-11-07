/** Eine geprüfte Bestimmung: Status, Regel-ID, verwendete Angaben, Kurztext und aufklappbarer Wortlaut. */
import type { Fakt, RegelZeile as RegelZeileDaten } from '../api/trace'
import { texte } from '../texte/de'
import { personName, wertText } from '../texte/format'
import { NormZitat } from './NormZitat'

function FaktZeile({ f }: { f: Fakt }) {
  const label = texte.variablen[f.name] ?? (f.name in texte.flags ? texte.flags[f.name as keyof typeof texte.flags] : f.name)
  return (
    <li>
      {label}
      {f.person && ` (${personName(f.person)})`}: <strong>{wertText(f.name, f.wert)}</strong>
    </li>
  )
}

export function RegelZeile({ zeile, mitKind }: { zeile: RegelZeileDaten; mitKind: boolean }) {
  const s = texte.warum.status[zeile.status]
  const fakten = zeile.fakten.filter((f) => f.wert !== undefined)
  return (
    <li className={`regelzeile regelzeile--${zeile.status.toLowerCase()}`}>
      <p className="regelzeile__kopf">
        <span className="regelzeile__symbol" aria-hidden="true">
          {s.symbol}
        </span>
        <span className="regelzeile__status">{s.text}</span>
        {mitKind && zeile.kind && <span className="regelzeile__kind">{texte.warum.fuer(personName(zeile.kind))}</span>}
      </p>
      {fakten.length > 0 && (
        <ul className="regelzeile__fakten" aria-label={texte.warum.verwendet}>
          {fakten.map((f, i) => (
            <FaktZeile key={i} f={f} />
          ))}
        </ul>
      )}
      <NormZitat id={zeile.regelId} />
    </li>
  )
}
