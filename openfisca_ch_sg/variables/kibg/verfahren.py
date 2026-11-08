"""Verfahren: Beginn der Beiträge und Dauer der Verfügung (Art. 9 und 11 KiBG, Art. 16 KiBV)."""

from datetime import date

import numpy as np
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Person
from openfisca_ch_sg.hilfen import (
    KEIN_DATUM,
    VOLLZUGSBEGINN,
    datum_plus_monate,
    erster_tag,
    tage_vom_beginn_bis_gesuch,
)
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL
from openfisca_ch_sg.variables.kibg.enums import Altersstufe


class beitrag_ab_datum(Variable):
    value_type = date
    default_value = date(1970, 1, 1)
    entity = Person
    definition_period = MONTH
    label = "Beiträge werden ausgerichtet ab"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        frist = parameters(period).kibg.verfahren.frist_rueckwirkung_tage
        beginn = person("betreuungsbeginn", period).astype("datetime64[D]")
        gesuch = person.familie("gesuchsdatum", period).astype("datetime64[D]")
        # Art. 9 Abs. 2 KiBG: Gesuch innert 30 Tagen → rückwirkend ab Inanspruchnahme, sonst ab Gesuch.
        # Die Übergangsregel Art. 25 Abs. 1 KiBV ist nicht modelliert.
        ab = np.where(
            tage_vom_beginn_bis_gesuch(person, period) <= frist, beginn, gesuch
        )
        # Vor dem Vollzugsbeginn gibt es keine Beiträge.
        ab = np.maximum(ab, VOLLZUGSBEGINN)
        return np.where(person("ist_kind", period), ab, KEIN_DATUM)


class jahr_schulpflicht(Variable):
    value_type = int
    entity = Person
    definition_period = MONTH
    label = "Kalenderjahr, in dem das Kind schulpflichtig wird (Eintritt in den Kindergarten)"
    reference = KIBV_URL

    def formula_2028_08_01(person, period, parameters):
        # Art. 45 Abs. 1 und Art. 17 Abs. 2 lit. a Volksschulgesetz: schulpflichtig am 1. August nach dem 4. Geburtstag
        alter = int(parameters(period).anwendung.schuleintritt_alter_jahre)
        letzter_monat_schuljahr = int(
            parameters(period).anwendung.schuljahresende_monat
        )

        geburtsdatum = person("geburtsdatum", period).astype("datetime64[D]")
        # Ohne Geburtsdatum aus dem eingegebenen Alter geschätzt
        aus_alter = datum_plus_monate(
            np.full(geburtsdatum.shape, erster_tag(period)),
            -person("alter_monate", period),
        )
        geburtsdatum = np.where(geburtsdatum != KEIN_DATUM, geburtsdatum, aus_alter)

        geburtstag = datum_plus_monate(geburtsdatum, 12 * alter)
        jahr = geburtstag.astype("datetime64[Y]").astype("int64") + 1970
        monat = geburtstag.astype("datetime64[M]").astype("int64") % 12 + 1
        # Wer erst nach Ende des Schuljahres 4 Jahre alt wird, ist erst im Folgejahr schulpflichtig.
        return person("ist_kind", period) * (jahr + (monat > letzter_monat_schuljahr))


class verfuegung_dauer_monate(Variable):
    value_type = int
    entity = Person
    definition_period = MONTH
    label = "Dauer der Beitragsverfügung in Monaten"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        in_der_regel = parameters(period).kibg.verfahren.verfuegung_dauer_monate
        letzter_monat_schuljahr = int(
            parameters(period).anwendung.schuljahresende_monat
        )
        monate_bis_schuljahresende = (
            letzter_monat_schuljahr - period.start.month
        ) % 12 + 1

        # Art. 16 Abs. 1 Satz 2 KiBV: im Kalenderjahr, in dem das Kind schulpflichtig wird, bis Schulbeginn (A-13)
        jahr_der_schulpflicht = (
            person("jahr_schulpflicht", period) == period.start.year
        ) * (period.start.month <= letzter_monat_schuljahr)
        # Art. 16 Abs. 2 KiBV: eingeschulte Kinder bis Ende des laufenden Schuljahres
        eingeschult = person("altersstufe", period) == Altersstufe.EINGESCHULT
        bis_schuljahresende = eingeschult + jahr_der_schulpflicht
        dauer = np.where(bis_schuljahresende, monate_bis_schuljahresende, in_der_regel)
        return person("ist_kind", period) * dauer
