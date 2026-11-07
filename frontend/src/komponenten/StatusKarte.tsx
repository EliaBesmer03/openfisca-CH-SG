import type { ReactNode } from 'react'
import { texte } from '../texte/de'
import type { Pruefstatus } from '../vertrag'

/** Status mit Farbe UND Symbol (nicht nur Farbe, für Barrierefreiheit). */
export function StatusKarte({ status, children, kompakt }: { status: Pruefstatus; children?: ReactNode; kompakt?: boolean }) {
  const t = texte.status[status]
  return (
    <div className={`status status--${status.toLowerCase()}${kompakt ? ' status--kompakt' : ''}`}>
      <span className="status__symbol" aria-hidden="true">
        {t.symbol}
      </span>
      <div>
        <p className="status__titel">{t.titel}</p>
        {children}
      </div>
    </div>
  )
}

export function StatusMarke({ status }: { status: Pruefstatus }) {
  const t = texte.status[status]
  return (
    <span className={`status-marke status--${status.toLowerCase()}`}>
      <span aria-hidden="true">{t.symbol} </span>
      {t.titel}
    </span>
  )
}
