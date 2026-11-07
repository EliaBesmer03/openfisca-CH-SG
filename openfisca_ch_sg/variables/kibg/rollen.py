"""Rechtsschicht: Rollen in der Gesuchseinheit (KiBG-2.1)."""

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
    documentation = (
        "KiBG-2.1 | Art. 2 Abs. 1 KiBG | Kind in der Obhut der Erziehungsberechtigten, "
        "für das Beiträge geltend gemacht werden (Rolle kinder) | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(person, period, parameters):
        return person.has_role(Familie.KIND)


class ist_erziehungsberechtigt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Person ist erziehungsberechtigt (Rolle erziehungsberechtigte)"
    reference = GESETZ_URL
    documentation = "KiBG-2.1 | Art. 2 Abs. 1 KiBG | Person, die für ein Kind in ihrer Obhut Beiträge geltend macht | Quellentyp: GESETZ"

    def formula_2028_08_01(person, period, parameters):
        return person.has_role(Familie.ERZIEHUNGSBERECHTIGTER)


class ist_partner(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = (
        "Person ist Partnerin oder Partner der antragstellenden EB (Rolle partnerinnen)"
    )
    reference = KIBV_URL
    documentation = "KiBG-2.1 | Art. 2 Abs. 1 KiBG, Art. 8 Abs. 1 lit. b KiBV | nicht erziehungsberechtigte Person im gleichen Haushalt | Quellentyp: VERORDNUNG_ENTWURF"

    def formula_2028_08_01(person, period, parameters):
        return person.has_role(Familie.PARTNER)
