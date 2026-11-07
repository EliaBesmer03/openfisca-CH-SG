import { texte } from '../texte/de'
import { ANNAHME, RECHTSSTAND, regelnZu, type Quellentyp } from '../vertrag'

const ANNAHMEN: readonly string[] = Object.values(ANNAHME)

export function QuellenBadge({ typ }: { typ: Quellentyp }) {
  return <span className={`badge badge--${typ.toLowerCase()}`}>{texte.quellentyp[typ]}</span>
}

/**
 * Regel-ID als Marke. Mit bekannter Quelle ein Link auf Gesetz bzw. Verordnung;
 * `nurText` z. B. innerhalb von <summary>, wo ein Link die Bedienung stört.
 */
export function RegelId({ id, nurText }: { id: string; nurText?: boolean }) {
  const regel = regelnZu(id)[0]
  const exakt = regel?.id === id ? regel : undefined
  if (!nurText && exakt?.url) {
    return (
      <a
        className="regel-id regel-id--link"
        href={exakt.url}
        target="_blank"
        rel="noopener noreferrer"
        title={exakt.fundstelle}
        aria-label={texte.frage.quelleOeffnen(id, exakt.fundstelle)}
      >
        {id}
      </a>
    )
  }
  return (
    <span className="regel-id" title={regel?.fundstelle}>
      {id}
    </span>
  )
}

/** Fundstelle, Kurztext und aufklappbarer Originalwortlaut aus contract/regeln.json. */
export function NormZitat({ id }: { id: string }) {
  if (ANNAHMEN.includes(id)) {
    return (
      <p className="norm norm--hinweis">
        <RegelId id={id} /> {texte.frage.annahme}
      </p>
    )
  }
  if (id === RECHTSSTAND) {
    return (
      <p className="norm norm--hinweis">
        <RegelId id={id} /> {texte.frage.rechtsstand}
      </p>
    )
  }
  const regeln = regelnZu(id)
  if (regeln.length === 0) {
    return (
      <p className="norm norm--hinweis">
        <RegelId id={id} /> {texte.frage.wortlautFehlt}
      </p>
    )
  }
  if (regeln.length > 3 && regeln[0].id !== id) {
    // Übergeordnete ID (z. B. KiBV-14) ohne eigene Zeile: nur die Unterbestimmungen nennen.
    return (
      <p className="norm norm--hinweis">
        <RegelId id={id} /> {texte.frage.mehrereBestimmungen(regeln.length)}{' '}
        {regeln.map((r) => (
          <RegelId key={r.id} id={r.id} />
        ))}
      </p>
    )
  }
  return (
    <>
      {regeln.map((r) => (
        <div className="norm" key={r.id}>
          <p className="norm__kopf">
            <RegelId id={r.id} /> <span>{r.fundstelle}</span> <QuellenBadge typ={r.quellentyp} />
          </p>
          <p className="norm__kurz">{r.kurztext}</p>
          {r.ambiguitaeten.length > 0 && (
            <p className="norm__amb">
              {texte.frage.mehrdeutig}: {r.ambiguitaeten.join(', ')}
            </p>
          )}
          <details>
            <summary>{texte.frage.wortlaut}</summary>
            <blockquote lang="de-CH">{r.wortlaut}</blockquote>
          </details>
        </div>
      ))}
    </>
  )
}
