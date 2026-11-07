"""Rechtsschicht: massgebendes Einkommen und Vermögen (KiBG-5, KiBV-8 bis 11)."""

from openfisca_core.model_api import max_, where
from openfisca_core.periods import MONTH
from openfisca_core.variables import Variable

from openfisca_ch_sg.entities import Familie, Person
from openfisca_ch_sg.quellen import GESETZ_URL, KIBV_URL
from openfisca_ch_sg.variables.kibg.enums import HaushaltForm, Partnerschaft


class partner_gefestigt(Variable):
    value_type = bool
    entity = Person
    definition_period = MONTH
    label = (
        "Partner/in lebt mit der antragstellenden EB in gefestigter Lebensgemeinschaft"
    )
    reference = KIBV_URL
    documentation = "KiBV-8.2.a | Art. 8 Abs. 2 lit. a und b KiBV | Ehe/eingetragene Partnerschaft oder Konkubinat seit wenigstens zwei Jahren | Quellentyp: VERORDNUNG_ENTWURF"

    def formula_2028_08_01(person, period, parameters):
        p = parameters(period).kibv.einkommen
        art = person("partnerschaft", period)
        ehe = art == Partnerschaft.EHE_ODER_EINGETRAGENE_PARTNERSCHAFT  # lit. a
        konkubinat = (art == Partnerschaft.KONKUBINAT) * (  # lit. b
            person("konkubinat_jahre", period) >= p.konkubinat_mindestjahre
        )
        return person("ist_partner", period) * (ehe + konkubinat)


class me_veranlagung_familie(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Massgebendes Einkommen und Vermögen der Gesuchseinheit laut Veranlagung (Jahresbetrag, CHF)"
    reference = KIBV_URL
    documentation = (
        "KiBV-8.1.a | Art. 8 Abs. 1 lit. a und b KiBV | gemeinsamer Haushalt: beide EB; "
        "getrennt: antragstellende EB und gefestigte/r Partner/in | Quellentyp: VERORDNUNG_ENTWURF"
    )

    def formula_2028_08_01(familie, period, parameters):
        me = familie.members("me_veranlagung", period)
        gefestigt = familie.members("partner_gefestigt", period)
        getrennt = familie("haushalt_form", period) == HaushaltForm.GETRENNTER_HAUSHALT
        me_eb = familie.sum(me, role=Familie.ERZIEHUNGSBERECHTIGTER)  # lit. a bzw. b
        me_partner = familie.sum(me * gefestigt, role=Familie.PARTNER)  # nur lit. b
        return me_eb + getrennt * me_partner


class me_massgebend(Variable):
    value_type = float
    entity = Familie
    definition_period = MONTH
    unit = "currency-CHF"
    label = "Massgebendes Einkommen und Vermögen ME (Jahresbetrag, CHF)"
    reference = GESETZ_URL
    documentation = (
        "KiBG-5.1 | Art. 5 Abs. 1–4 KiBG, Art. 11 Abs. 1–2 KiBV | Veranlagung, bei Antrag und Rückgang "
        "um wenigstens 25 % aktuelle Gegebenheiten (A-05) | Quellentyp: GESETZ"
    )

    def formula_2028_08_01(familie, period, parameters):
        p = parameters(period).kibv.einkommen
        veranlagung = familie("me_veranlagung_familie", period)
        aktuell = familie("me_aktuell", period)
        antrag = familie("antrag_aktuelle_gegebenheiten", period)  # KiBV-11.1
        # KiBV-11.2, A-05: nur ein Rückgang zählt, gemessen an der Veranlagung
        abweichung = (veranlagung - aktuell) / max_(veranlagung, 1)
        return where(
            antrag * (abweichung >= p.schwelle_abweichung), aktuell, veranlagung
        )
