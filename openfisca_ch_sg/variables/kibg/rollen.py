"""Rollen in der Gesuchseinheit (Art. 2 Abs. 1 KiBG)."""

from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL


class ist_kind(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Person ist ein betreutes Kind der Familie"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        return person.has_role(Familie.KIND)


class ist_erziehungsberechtigt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Person ist erziehungsberechtigt"
    reference = GESETZ_URL

    def formula_2028_08_01(person, period, parameters):
        return person.has_role(Familie.ERZIEHUNGSBERECHTIGTER)


class ist_partner(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Person ist Partnerin oder Partner der antragstellenden Person, aber nicht erziehungsberechtigt"
    reference = KIBV_URL

    def formula_2028_08_01(person, period, parameters):
        return person.has_role(Familie.PARTNER)
