"""Hilfsfunktionen für Formeln, die in A6 keine eigene Variable sind.

Liegt ausserhalb von variables/, damit der Loader die Datei nicht als Variablen-Datei liest.
Rechts- und Anwendungsschicht nutzen dieselben Funktionen, damit Flags und Recht nie auseinanderlaufen.
"""

import numpy as np

from openfisca_ch_sg.entities import Familie
from openfisca_ch_sg.variables.kibg.enums import HaushaltForm

# KiBG-IV.1: Die Regierung bestimmt den Vollzugsbeginn; laut Medienmitteilung 1.8.2028 (ERLAEUTERUNG).
# OpenFisca-Parameter sind numerisch, deshalb als Konstante (B7). Muss zu formula_2028_08_01 passen.
VOLLZUGSBEGINN = np.datetime64("2028-08-01", "D")


def me_aller_relevanten_personen_bekannt(familie, period):
    """KiBG-5.3, KiBV-8.1: ME ist für alle Personen bekannt, deren Einkommen zählt.

    Es zählen immer die Erziehungsberechtigten; bei getrenntem Haushalt zusätzlich
    eine Partnerin oder ein Partner in gefestigter Lebensgemeinschaft.
    """
    me_bekannt = familie.members("me_bekannt", period)
    gefestigt = familie.members("partner_gefestigt", period)
    getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
    eb_bekannt = familie.all(me_bekannt, role=Familie.ERZIEHUNGSBERECHTIGTER)
    partner_bekannt = familie.all(me_bekannt + ~gefestigt, role=Familie.PARTNER)
    return eb_bekannt * (~getrennt + partner_bekannt)


def haushalt_konsistent(familie, period):
    """KiBG-4.1.b, A-14: gemeinsamer Haushalt = genau 2 EB; getrennt = nur die antragstellende EB."""
    anzahl_eb = familie.nb_persons(Familie.ERZIEHUNGSBERECHTIGTER)
    gemeinsam = familie("haushalt_form", period) == HaushaltForm.GEMEINSAMER_HAUSHALT
    return gemeinsam * (anzahl_eb == 2) + ~gemeinsam * (anzahl_eb == 1)


def gesuchsfristen(person, period, parameters):
    """KiBG-9.2 für jedes Kind. Gibt zurück: (betreuungsbeginn, gesuchsdatum, tage_seit_beginn).

    Die Übergangsregel von Art. 25 KiBV ist nicht modelliert (Entscheid Rechtsteam):
    Das Modell rechnet nur den Regelbetrieb ab Inkrafttreten, es gilt immer die 30-Tage-Regel.
    """
    beginn = person("betreuungsbeginn", period).astype("datetime64[D]")
    gesuch = person.familie("gesuchsdatum", period).astype("datetime64[D]")
    tage = (gesuch - beginn).astype("int64")
    return beginn, gesuch, tage


# --- Datumsrechnung für Altersgrenzen (A-08: „ab dem Tag, an dem das Kind 18 Monate alt ist“) ---

KEIN_DATUM = np.datetime64("1970-01-01", "D")


def datum_plus_monate(datum, monate):
    """Datum + n Monate; fehlt der Tag im Zielmonat, gilt dessen letzter Tag (wie Art. 77 OR)."""
    datum = np.asarray(datum).astype("datetime64[D]")
    monat = datum.astype("datetime64[M]")
    tag = (datum - monat.astype("datetime64[D]")).astype("int64")
    ziel = monat + np.asarray(monate).astype("int64").astype("timedelta64[M]")
    tage_im_ziel = (
        (ziel + np.timedelta64(1, "M")).astype("datetime64[D]")
        - ziel.astype("datetime64[D]")
    ).astype("int64")
    return ziel.astype("datetime64[D]") + np.minimum(tag, tage_im_ziel - 1)


def monatsgrenzen(period):
    """Erster Tag des Monats und erster Tag des Folgemonats."""
    start = np.datetime64(str(period.start), "D")
    ende = (start.astype("datetime64[M]") + np.timedelta64(1, "M")).astype(
        "datetime64[D]"
    )
    return start, ende


def anteil_monat_ab(stichtag, period):
    """Anteil der Kalendertage des Monats, die auf oder nach dem Stichtag liegen (0 bis 1)."""
    start, ende = monatsgrenzen(period)
    tage = (ende - start).astype("int64")
    ab = np.clip(
        (ende - np.asarray(stichtag).astype("datetime64[D]")).astype("int64"), 0, tage
    )
    return ab / tage


def vollendete_monate(geburtsdatum, stichtag):
    """Vollendete Lebensmonate am Stichtag (gleiche Monatsrechnung wie datum_plus_monate)."""
    geb = np.asarray(geburtsdatum).astype("datetime64[D]")
    stich = np.asarray(stichtag).astype("datetime64[D]")
    monate = (stich.astype("datetime64[M]") - geb.astype("datetime64[M]")).astype(
        "int64"
    )
    return monate - (datum_plus_monate(geb, monate) > stich)
