import { texte } from '../texte/de'

export function RechtsstandBanner() {
  return (
    <div className="banner" role="note">
      <span aria-hidden="true">⚠ </span>
      {texte.banner}
    </div>
  )
}
