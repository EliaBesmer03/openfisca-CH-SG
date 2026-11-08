"""Wohnsitz und Zusatzbeiträge der Wohngemeinde (Art. 4 Abs. 1 und 20 Abs. 2 KiBG, Art. 2 und 24 KiBV).

zusatzbeitrag_z1/_z2 kommen aus parameters/gemeinden/ (heute 0, noch keine Gemeinde hat beschlossen). Werden sie in der
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
    label = "Zivilrechtlicher Wohnsitz der antragstellenden Person im Kanton St.Gallen"
    reference = GESETZ_URL

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
    label = "Einkommensabhängiger Zusatzbeitrag der Wohngemeinde je Kind und Betreuungsstunde (Z1)"
    reference = KIBV_URL

    def formula_2028_08_01(familie, period, parameters):
        wg = familie("wohngemeinde", period)
        return parameters(period).gemeinden.zusatzbeitrag_z1[wg]


class zusatzbeitrag_z2_pro_stunde(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    label = "Einkommensunabhängiger Zusatzbeitrag der Wohngemeinde je Kind und Betreuungsstunde (Z2)"
    reference = KIBV_URL

    def formula_2028_08_01(familie, period, parameters):
        wg = familie("wohngemeinde", period)
        return parameters(period).gemeinden.zusatzbeitrag_z2[wg]
