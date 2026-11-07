"""Entitäten für das KiBG St.Gallen.

Das Gesetz knüpft an die Erziehungsberechtigten an (Art. 2, Art. 4 KiBG),
nicht an alle Erwachsenen eines Haushalts. Deshalb eine Gruppen-Entität
"Familie" mit den Rollen Erziehungsberechtigte, Partner/in und Kinder.

See https://openfisca.org/doc/coding-the-legislation/50_entities.html
"""

from openfisca_core.entities import build_entity

Familie = build_entity(
    key="familie",
    plural="familien",
    label="Gesuchseinheit: Erziehungsberechtigte, ggf. Partner/in und die betreuten Kinder (Art. 2 KiBG, Art. 8 KiBV)",
    doc="""
    Eine Familie im Sinn des Modells ist eine Gesuchseinheit (Glossar A3):
    die antragstellende(n) erziehungsberechtigte(n) Person(en), ggf. eine
    Partnerin oder ein Partner nach Art. 8 Abs. 1 lit. b KiBV und die Kinder,
    für die Beiträge beantragt werden.
    Bei getrenntem Haushalt (z. B. Wechselmodell) stellt jede erziehungs-
    berechtigte Person ihr eigenes Gesuch, also eine eigene Familie (A-14).
    Eine Person gehört genau einer Familie an.
    """,
    roles=[
        {
            "key": "erziehungsberechtigter",
            "plural": "erziehungsberechtigte",
            "label": "Erziehungsberechtigte Person",
            "doc": "Person, die für ein Kind in ihrer Obhut Beiträge beansprucht (Art. 2 Abs. 1 KiBG).",
            "max": 2,
        },
        {
            "key": "partner",
            "plural": "partnerinnen",
            "label": "Partnerin oder Partner der antragstellenden EB",
            "doc": "Nicht erziehungsberechtigt; zählt bei getrenntem Haushalt und gefestigter Lebensgemeinschaft zum Einkommen (Art. 8 KiBV), nie zum Erwerbspensum.",
            "max": 1,
        },
        {
            "key": "kind",
            "plural": "kinder",
            "label": "Kind",
            "doc": "Betreutes Kind ab 3 Monaten bis Abschluss der Primarschule (Art. 4 Abs. 3 KiBG).",
        },
    ],
)

Person = build_entity(
    key="person",
    plural="persons",
    label="Eine Person",
    doc="Einzelne Person: erziehungsberechtigte Person, Partner/in oder Kind.",
    is_person=True,
)

entities = [Familie, Person]
