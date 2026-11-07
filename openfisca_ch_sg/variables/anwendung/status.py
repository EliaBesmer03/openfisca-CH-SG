"""Anwendungsschicht: Prüfstatus und Summen (A7). Nicht Teil des Rechts.

Der Status pro Kind folgt der Prioritätenliste in A7: die erste zutreffende Zeile gilt.
Vor Vollzugsbeginn gilt der Standardwert NICHT_IN_KRAFT (keine Formel vor 2028-08).
"""

from numpy import select
from openfisca_core.indexed_enums import Enum
from openfisca_core.model_api import min_
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.variables.kibg.enums import Pruefstatus

K = Familie.KIND

# Wirkung der Flags (A6, Spalte „Wirkung“)
KEIN_FAMILIE = [
    "flag_wohnsitz_nicht_sg",
    "flag_ausnahme_kein_grund",
    "flag_ausnahme_abgelehnt",
]
KEIN_KIND = [
    "flag_kind_zu_jung",
    "flag_kind_zu_alt",
    "flag_angebot_nicht_anerkannt",
    "flag_angebot_nicht_angemeldet",
    "flag_kein_hoechstbeitrag",
]
FEHLT_FAMILIE = [
    "flag_wohnsitz_unbekannt",
    "flag_pensum_unbekannt",
    "flag_haushalt_inkonsistent",
    "flag_me_unbekannt",
]
FEHLT_KIND = ["flag_angebot_anmeldung_unbekannt"]
PRUEFUNG_FAMILIE = ["flag_ausnahme_offen"]


def _irgendein(person, period, flags_familie, flags_kind):
    ergebnis = person("ist_kind", period) * False
    for flag in flags_familie:
        ergebnis = ergebnis + person.familie(flag, period)
    for flag in flags_kind:
        ergebnis = ergebnis + person(flag, period)
    return ergebnis


class pruefstatus_kind(Variable):
    value_type = Enum
    possible_values = Pruefstatus
    default_value = Pruefstatus.NICHT_IN_KRAFT
    entity = Person
    definition_period = MONTH
    label = "Prüfstatus pro Kind (für Nicht-Kinder NICHT_IN_KRAFT, ignorieren)"
    documentation = "ANWENDUNG | erklärt KiBG-3, KiBG-4 | nicht Teil des Rechts | A7"

    def formula_2028_08_01(person, period, parameters):
        return select(
            [
                ~person("ist_kind", period),
                _irgendein(person, period, KEIN_FAMILIE, KEIN_KIND),
                _irgendein(person, period, FEHLT_FAMILIE, FEHLT_KIND),
                _irgendein(person, period, PRUEFUNG_FAMILIE, []),
            ],
            [
                Pruefstatus.NICHT_IN_KRAFT,
                Pruefstatus.KEIN_ANSPRUCH,
                Pruefstatus.ANGABEN_FEHLEN,
                Pruefstatus.PRUEFUNG_DURCH_GEMEINDE,
            ],
            default=Pruefstatus.ANSPRUCH,
        )


class pruefstatus(Variable):
    value_type = Enum
    possible_values = Pruefstatus
    default_value = Pruefstatus.NICHT_IN_KRAFT
    entity = Familie
    definition_period = MONTH
    label = "Gesamtstatus der Familie"
    documentation = "ANWENDUNG | erklärt KiBG-3, KiBG-4 | nicht Teil des Rechts | A7"

    def formula_2028_08_01(familie, period, parameters):
        status = familie.members("pruefstatus_kind", period)
        return select(
            [
                familie.any(status == Pruefstatus.ANSPRUCH, role=K),
                familie.any(status == Pruefstatus.PRUEFUNG_DURCH_GEMEINDE, role=K),
                familie.any(status == Pruefstatus.ANGABEN_FEHLEN, role=K),
            ],
            [
                Pruefstatus.ANSPRUCH,
                Pruefstatus.PRUEFUNG_DURCH_GEMEINDE,
                Pruefstatus.ANGABEN_FEHLEN,
            ],
            default=Pruefstatus.KEIN_ANSPRUCH,
        )


class schaetzung_beitrag_total_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Geschätzter Beitrag, falls die Gemeinde die Ausnahme bewilligt (CHF)"
    documentation = "ANWENDUNG | erklärt KiBG-4.2 | nicht Teil des Rechts | nur bei PRUEFUNG_DURCH_GEMEINDE > 0"

    def formula_2028_08_01(person, period, parameters):
        pruefung = (
            person("pruefstatus_kind", period) == Pruefstatus.PRUEFUNG_DURCH_GEMEINDE
        )
        roh = person("beitrag_pro_stunde_total", period) * person(
            "subventionierte_stunden_monat", period
        )
        return pruefung * min_(roh, person("kosten_monat", period))


class restkosten_kind(Variable):
    value_type = float
    entity = Person
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Restkosten der Eltern pro Monat für das Kind (CHF)"
    documentation = "ANWENDUNG | erklärt KiBG-6.2, KiBG-20.3 | nicht Teil des Rechts | kosten_monat − beitrag_total_kind"

    def formula_2028_08_01(person, period, parameters):
        return person("ist_kind", period) * (
            person("kosten_monat", period) - person("beitrag_total_kind", period)
        )


class beitrag_mindest_familie(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Mindestbeiträge der Familie pro Monat (CHF)"
    documentation = (
        "ANWENDUNG | erklärt KiBG-6.1 | nicht Teil des Rechts | Summe über Kinder"
    )

    def formula_2028_08_01(familie, period, parameters):
        return familie.sum(familie.members("beitrag_mindest_kind", period), role=K)


class beitrag_total_familie(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Beiträge total der Familie pro Monat (CHF)"
    documentation = (
        "ANWENDUNG | erklärt KiBG-20.2 | nicht Teil des Rechts | Summe über Kinder"
    )

    def formula_2028_08_01(familie, period, parameters):
        return familie.sum(familie.members("beitrag_total_kind", period), role=K)


class restkosten_familie(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Restkosten der Familie pro Monat (CHF)"
    documentation = (
        "ANWENDUNG | erklärt KiBG-6.2 | nicht Teil des Rechts | Summe über Kinder"
    )

    def formula_2028_08_01(familie, period, parameters):
        return familie.sum(familie.members("restkosten_kind", period), role=K)
