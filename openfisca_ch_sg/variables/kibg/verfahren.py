"""Rechtsschicht: Verfahren (KiBG-9, 11; KiBV-16, 25)."""

from datetime import date

import numpy as np
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Person
from openfisca_ch_sg.hilfen import (
    KEIN_DATUM,
    VOLLZUGSBEGINN,
    datum_plus_monate,
    gesuchsfristen,
    monatsgrenzen,
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
    documentation = (
        "KiBG-9.2 | Art. 9 Abs. 2 KiBG | rückwirkend bei Gesuch innert 30 Tagen, sonst ab Gesuch; nie vor Vollzugsbeginn. "
        "Übergangsregel Art. 25 KiBV nicht modelliert (Rechtsteam) | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(person, period, parameters):
        frist = parameters(period).kibg.verfahren.frist_rueckwirkung_tage
        beginn, gesuch, tage = gesuchsfristen(person, period, parameters)
        # KiBG-9.2: innert 30 Tagen rückwirkend bis zur Inanspruchnahme, sonst ab Gesuch
        ab_regel = np.where(tage <= frist, beginn, gesuch)
        # vor Vollzugsbeginn gibt es keine Beiträge (Gesetz nicht in Kraft)
        ab = np.maximum(ab_regel, VOLLZUGSBEGINN)
        return np.where(
            person("ist_kind", period), ab, np.datetime64("1970-01-01", "D")
        )


class jahr_schulpflicht(Variable):
    value_type = int
    entity = Person
    definition_period = MONTH
    label = "Kalenderjahr, in dem das Kind schulpflichtig wird (Eintritt in den Kindergarten)"
    reference = KIBV_URL
    documentation = (
        "KiBV-16.1 | Art. 16 Abs. 1 KiBV | Jahr, in dem das Kind bis 31. Juli vier Jahre alt wird (AN-06, AN-02); "
        "ohne geburtsdatum aus alter_monate geschätzt | Quellentyp: VERORDNUNG_ENTWURF"
    )

    def formula_2028_08_01(person, period, parameters):
        alter = int(parameters(period).anwendung.schuleintritt_alter_jahre)  # AN-06
        ende = int(parameters(period).anwendung.schuljahresende_monat)  # AN-02
        start, _ = monatsgrenzen(period)
        geb = person("geburtsdatum", period).astype("datetime64[D]")
        geschaetzt = datum_plus_monate(
            np.full(geb.shape, start), -person("alter_monate", period)
        )
        geb = np.where(geb != KEIN_DATUM, geb, geschaetzt)
        geburtstag = datum_plus_monate(geb, 12 * alter)
        jahr = geburtstag.astype("datetime64[Y]").astype("int64") + 1970
        monat = geburtstag.astype("datetime64[M]").astype("int64") % 12 + 1
        # Geburtstag nach dem Stichtag (31. Juli) → erst im Folgejahr schulpflichtig
        return person("ist_kind", period) * (jahr + (monat > ende))


class verfuegung_dauer_monate(Variable):
    value_type = int
    entity = Person
    definition_period = MONTH
    unit = "month"
    label = "Dauer der Beitragsverfügung in Monaten"
    reference = GESETZ_URL
    documentation = (
        "KiBG-11.2 | Art. 11 Abs. 2 KiBG, Art. 16 Abs. 1–2 KiBV | i. d. R. 12 Monate; im Kalenderjahr der Schulpflicht "
        "bis Beginn des Schuljahres; eingeschulte Kinder bis Ende Schuljahr (A-13, AN-02, AN-06) | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(person, period, parameters):
        regel = parameters(period).kibg.verfahren.verfuegung_dauer_monate
        ende = int(parameters(period).anwendung.schuljahresende_monat)  # AN-02
        bis_schuljahresende = (ende - period.start.month) % 12 + 1
        eingeschult = person("altersstufe", period) == Altersstufe.EINGESCHULT
        # KiBV-16.1 Satz 2: Verfügung im Kalenderjahr, in dem das Kind schulpflichtig wird,
        # gilt bis zum Beginn des Schuljahres (A-13)
        jahr_der_schulpflicht = (
            person("jahr_schulpflicht", period) == period.start.year
        ) * (period.start.month <= ende)
        # KiBV-16.2: eingeschulte Kinder bis Ende des laufenden Schuljahres
        bis_schule = eingeschult + jahr_der_schulpflicht
        return person("ist_kind", period) * np.where(
            bis_schule, bis_schuljahresende, regel
        )
