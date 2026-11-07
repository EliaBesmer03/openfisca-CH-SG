"""Rechtsschicht: Wohnsitz und Zusatzbeiträge der Wohngemeinde (KiBG-4.1, KiBG-20.2, KiBV-2.1, KiBV-24.1).

zusatzbeitrag_z1/_z2 kommen aus parameters/gemeinden/ (heute 0, AN-04). Werden sie in der
Situation mitgeschickt, gilt der eingegebene Wert statt der Formel (OpenFisca-Standardverhalten).
"""

from numpy import select
from openfisca_core.indexed_enums import Enum
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL
from openfisca_ch_sg.variables.kibg.enums import JaNeinUnbekannt, Wohngemeinde


class wohnsitz_sg(Variable):
    value_type = Enum
    possible_values = JaNeinUnbekannt
    default_value = JaNeinUnbekannt.UNBEKANNT
    entity = Familie
    definition_period = MONTH
    label = "Zivilrechtlicher Wohnsitz der antragstellenden EB im Kanton St.Gallen"
    reference = GESETZ_URL
    documentation = (
        "KiBG-4.1 | Art. 4 Abs. 1 KiBG | aus wohngemeinde: eine der 75 Gemeinden → JA, "
        "AUSSERKANTONAL → NEIN, UNBEKANNT → UNBEKANNT | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(familie, period, parameters):
        wg = familie("wohngemeinde", period)
        return select(
            [wg == Wohngemeinde.UNBEKANNT, wg == Wohngemeinde.AUSSERKANTONAL],
            [JaNeinUnbekannt.UNBEKANNT, JaNeinUnbekannt.NEIN],
            default=JaNeinUnbekannt.JA,
        )


class zusatzbeitrag_z1_pro_stunde(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Einkommensabhängiger Zusatzbeitrag der Wohngemeinde je Kind und Betreuungsstunde (Z1)"
    reference = KIBV_URL
    documentation = (
        "KiBG-20.2 | Art. 20 Abs. 2 KiBG, Art. 24 Abs. 1 und Anhang (Z1) KiBV | "
        "Parameter gemeinden.zusatzbeitrag_z1 je Wohngemeinde, heute 0 (AN-04), überschreibbar; A-15 | Quellentyp: ANNAHME_TEAM"
    )

    def formula_2028_08_01(familie, period, parameters):
        wg = familie("wohngemeinde", period)
        return parameters(period).gemeinden.zusatzbeitrag_z1[wg]


class zusatzbeitrag_z2_pro_stunde(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Einkommensunabhängiger Zusatzbeitrag der Wohngemeinde je Kind und Betreuungsstunde (Z2)"
    reference = KIBV_URL
    documentation = (
        "KiBG-20.2 | Art. 20 Abs. 2 KiBG, Art. 24 Abs. 1 und Anhang (Z2) KiBV | "
        "Parameter gemeinden.zusatzbeitrag_z2 je Wohngemeinde, heute 0 (AN-04), überschreibbar; A-10, A-15 | Quellentyp: ANNAHME_TEAM"
    )

    def formula_2028_08_01(familie, period, parameters):
        wg = familie("wohngemeinde", period)
        return parameters(period).gemeinden.zusatzbeitrag_z2[wg]
