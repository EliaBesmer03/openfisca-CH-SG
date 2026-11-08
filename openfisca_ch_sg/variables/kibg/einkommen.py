"""Massgebendes Einkommen und Vermögen (Art. 5 KiBG, Art. 8 bis 11 KiBV)."""

from openfisca_core.model_api import max_, where
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.hilfen import zaehlende_personen
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL
from openfisca_ch_sg.variables.kibg.enums import Partnerschaft


class partner_gefestigt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = "Partnerin oder Partner lebt mit der antragstellenden Person in gefestigter Lebensgemeinschaft"
    reference = KIBV_URL

    def formula_2028_08_01(person, period, parameters):
        p = parameters(period).kibv.einkommen
        art = person("partnerschaft", period)
        # Art. 8 Abs. 2 KiBV: a) Ehe oder eingetragene Partnerschaft, b) seit wenigstens zwei Jahren gemeinsamer Haushalt
        ehe = art == Partnerschaft.EHE_ODER_EINGETRAGENE_PARTNERSCHAFT
        konkubinat = (art == Partnerschaft.KONKUBINAT) * (
            person("konkubinat_jahre", period) >= p.konkubinat_mindestjahre
        )
        return person("ist_partner", period) * (ehe + konkubinat)


class me_veranlagung_familie(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen der Gesuchseinheit laut Veranlagung (CHF pro Jahr)"
    reference = KIBV_URL

    def formula_2028_08_01(familie, period, parameters):
        # Art. 8 Abs. 1 KiBV: a) beide Erziehungsberechtigten, b) antragstellende Person und gefestigte Partnerin oder Partner
        einkommen = familie.members("me_veranlagung", period)
        return familie.sum(einkommen * zaehlende_personen(familie, period))


class me_massgebend(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    label = "Massgebendes Einkommen und Vermögen (CHF pro Jahr)"
    reference = GESETZ_URL

    def formula_2028_08_01(familie, period, parameters):
        p = parameters(period).kibv.einkommen
        veranlagung = familie("me_veranlagung_familie", period)
        aktuell = familie("me_aktuell", period)
        # Art. 11 KiBV: auf Antrag aktuelle Gegebenheiten, wenn das Einkommen um wenigstens 25 Prozent
        # tiefer ist als laut Veranlagung (A-05: nur ein Rückgang zählt)
        antrag = familie("antrag_aktuelle_gegebenheiten", period)
        rueckgang = (veranlagung - aktuell) / max_(veranlagung, 1)
        return where(
            antrag * (rueckgang >= p.schwelle_abweichung), aktuell, veranlagung
        )
