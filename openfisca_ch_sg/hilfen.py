"""Hilfsfunktionen, die mehrere Formeln gemeinsam brauchen.

Die Datei liegt ausserhalb von variables/, damit OpenFisca sie nicht als Variablen-Datei lädt.
Recht (variables/kibg) und Erklärung (variables/anwendung) nutzen dieselben Funktionen,
damit beide immer dasselbe prüfen.
"""

import numpy as np

from openfisca_ch_sg.entities import Familie
from openfisca_ch_sg.variables.kibg.enums import HaushaltForm

# Vollzugsbeginn des Gesetzes, den die Regierung festlegt (laut Kanton 1.8.2028).
# Muss zum Datum der Formeln (formula_2028_08_01) passen.
VOLLZUGSBEGINN = np.datetime64("2028-08-01", "D")

# Standardwert der Datums-Eingaben: „nicht angegeben“
KEIN_DATUM = np.datetime64("1970-01-01", "D")


# ---------- Gesuchseinheit ----------


def zaehlende_personen(familie, period):
    """Personen der Gesuchseinheit, deren Pensum und Einkommen zählen (je Mitglied wahr/falsch).

    Das sind die Erziehungsberechtigten (Art. 4 Abs. 1 KiBG, Art. 8 Abs. 1 KiBV). Bei getrenntem
    Haushalt zählt zusätzlich eine Partnerin oder ein Partner in gefestigter Lebensgemeinschaft:
    beim Einkommen nach Art. 8 Abs. 1 lit. b KiBV, beim Pensum nach Auslegung A-16
    (sie oder er gilt wie eine zweite Person im gemeinsamen Haushalt).
    """
    erziehungsberechtigt = familie.members.has_role(Familie.ERZIEHUNGSBERECHTIGTER)
    getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
    partner = familie.members.has_role(Familie.PARTNER)
    gefestigt = familie.members("partner_gefestigt", period)
    return erziehungsberechtigt + partner * gefestigt * familie.project(getrennt)


def haushalt_passt_zu_personen(familie, period):
    """Gemeinsamer Haushalt heisst zwei Erziehungsberechtigte, getrennter Haushalt eine (A-14)."""
    anzahl = familie.nb_persons(Familie.ERZIEHUNGSBERECHTIGTER)
    gemeinsam = familie("haushalt_form", period) == HaushaltForm.GEMEINSAMER_HAUSHALT
    return np.where(gemeinsam, anzahl == 2, anzahl == 1)


def einkommen_bekannt(familie, period):
    """Das massgebende Einkommen ist für alle Personen bekannt, deren Einkommen zählt."""
    zaehlt = zaehlende_personen(familie, period)
    bekannt = familie.members("me_bekannt", period)
    return familie.all(bekannt + ~zaehlt)


def pensum_bekannt(familie, period):
    """Das Pensum ist für alle Personen bekannt, deren Pensum zählt."""
    zaehlt = zaehlende_personen(familie, period)
    bekannt = familie.members("erwerbspensum_bekannt", period)
    return familie.all(bekannt + ~zaehlt)


def tage_vom_beginn_bis_gesuch(person, period):
    """Kalendertage vom ersten Betreuungstag bis zum Gesuch (Art. 9 Abs. 2 KiBG)."""
    beginn = person("betreuungsbeginn", period).astype("datetime64[D]")
    gesuch = person.familie("gesuchsdatum", period).astype("datetime64[D]")
    return (gesuch - beginn).astype("int64")


# ---------- Datumsrechnung für Altersgrenzen ----------
# Altersgrenzen gelten ab dem Tag, an dem das Kind 3 bzw. 18 Monate alt ist (Auslegung A-08).


def datum_plus_monate(datum, monate):
    """Datum plus n Monate. Fehlt der Tag im Zielmonat, gilt dessen letzter Tag (wie Art. 77 OR)."""
    datum = np.asarray(datum).astype("datetime64[D]")
    monat = datum.astype("datetime64[M]")
    tag_im_monat = (datum - monat.astype("datetime64[D]")).astype("int64")
    zielmonat = monat + np.asarray(monate).astype("int64").astype("timedelta64[M]")
    erster_tag = zielmonat.astype("datetime64[D]")
    tage_im_zielmonat = (
        (zielmonat + np.timedelta64(1, "M")).astype("datetime64[D]") - erster_tag
    ).astype("int64")
    return erster_tag + np.minimum(tag_im_monat, tage_im_zielmonat - 1)


def erster_tag(period):
    """Erster Tag des Monats."""
    return np.datetime64(str(period.start), "D")


def anteil_monat_ab(stichtag, period):
    """Anteil der Tage des Monats, die auf oder nach dem Stichtag liegen (0 bis 1)."""
    start = erster_tag(period)
    ende = (start.astype("datetime64[M]") + np.timedelta64(1, "M")).astype(
        "datetime64[D]"
    )
    tage_im_monat = (ende - start).astype("int64")
    tage_ab_stichtag = (ende - np.asarray(stichtag).astype("datetime64[D]")).astype(
        "int64"
    )
    return np.clip(tage_ab_stichtag, 0, tage_im_monat) / tage_im_monat


def vollendete_monate(geburtsdatum, stichtag):
    """Vollendete Lebensmonate am Stichtag."""
    geburt = np.asarray(geburtsdatum).astype("datetime64[D]")
    stichtag = np.asarray(stichtag).astype("datetime64[D]")
    monate = (stichtag.astype("datetime64[M]") - geburt.astype("datetime64[M]")).astype(
        "int64"
    )
    # Ist der Monatstag der Geburt noch nicht erreicht, ist der letzte Monat nicht vollendet.
    return monate - (datum_plus_monate(geburt, monate) > stichtag)
