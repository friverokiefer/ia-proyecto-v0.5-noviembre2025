# ia-engine/app/utils/campaigns.py
"""Utilidades para campañas (productos) Banco BICE.

Define:
- Nombre canónico de campañas.
- Descripción de tono/posicionamiento.
- Aliases para compatibilidad con nombres antiguos.

IMPORTANTE:
- Las keys de CAMPAIGNS_TONE deben coincidir con:
    backend/src/utils/constants.ts::CAMPAIGNS
- El frontend y el backend deben usar estos nombres canónicos.
"""

from typing import Dict, List

# Nombre canónico de campañas + descripción de tono/posicionamiento
CAMPAIGNS_TONE: Dict[str, str] = {
    "Crédito de consumo - Persona": (
        "Crédito de consumo flexible orientado a financiar proyectos personales o familiares, "
        "con foco en claridad de cuotas, tasa competitiva y un proceso 100% online. "
        "Apunta a clientes que valoran un servicio sobrio, confiable y alineado con Banco BICE."
    ),
    "Crédito de consumo - Empresa": (
        "Crédito de consumo para empresas y emprendedores, pensado para capital de trabajo, "
        "inversión en activos o necesidades puntuales de liquidez. Enfatiza orden financiero y "
        "continuidad del negocio, con evaluación especializada."
    ),
    "DAP (Depósito a plazo)": (
        "Depósito a plazo para clientes que buscan una alternativa conservadora, con tasa fija "
        "conocida desde el inicio y plazos acordes a su objetivo de ahorro o inversión. "
        "Tono prudente, claro y orientado a preservación de capital."
    ),
    "Crédito hipotecario": (
        "Crédito hipotecario para primera vivienda, mejora de vivienda o inversión inmobiliaria. "
        "Enfatiza estabilidad, planificación de largo plazo y asesoría especializada, "
        "manteniendo el estilo sobrio propio de Banco BICE."
    ),
    "Refinanciar deuda": (
        "Oferta orientada a revisar y reestructurar deudas existentes, ya sea de consumo, "
        "tarjetas o hipotecarias, buscando mejorar condiciones, orden y flujo de caja mensual. "
        "El tono debe ser empático, sin juicio y muy claro en implicancias."
    ),
    "Apertura producto - Cuenta corriente": (
        "Apertura de cuenta corriente para personas o empresas que buscan un banco confiable, "
        "con buenos canales digitales, medios de pago y acceso a productos de inversión y crédito. "
        "Foco en orden, experiencia de servicio y relación de largo plazo."
    ),
    "Apertura producto - Tarjeta de crédito": (
        "Tarjeta de crédito asociada a beneficios, programas de puntos y compras en cuotas, "
        "con foco en uso responsable, visibilidad del gasto y experiencia fluida tanto en Chile "
        "como en el extranjero."
    ),
    "Seguros": (
        "Oferta de seguros (auto, vida, hogar, viaje, salud) vinculada a la protección del cliente "
        "y su familia, con coberturas claras y respaldo de Banco BICE y sus aliados. "
        "El tono debe ser empático, transparente y centrado en tranquilidad."
    ),
}

# Alias para compatibilidad con payloads antiguos
CAMPAIGN_ALIASES: Dict[str, str] = {
    # Nombres antiguos de campañas de consumo
    "Crédito de Consumo BICE": "Crédito de consumo - Persona",
    "Consolidación de deudas": "Refinanciar deuda",
    "Ordena tus deudas": "Refinanciar deuda",
    # Productos que ahora son subcasos
    "Tarjeta de crédito": "Apertura producto - Tarjeta de crédito",
    "Cuenta corriente PyME": "Apertura producto - Cuenta corriente",
    # Variantes de DAP / inversión
    "DAP (Depósito a Plazo)": "DAP (Depósito a plazo)",
    "DAP (Deposito a plazo)": "DAP (Depósito a plazo)",
    "Fondos mutuos / Inversión": "DAP (Depósito a plazo)",
    # Seguros específicos pasan a campaña genérica de seguros
    "Seguros de auto": "Seguros",
    "Seguros de vida": "Seguros",
    # Casos de aumento/ajuste que se tratan como subuso de campañas canónicas
    "Aumento línea de crédito": "Crédito de consumo - Persona",
    "Aumento cupo TC": "Apertura producto - Tarjeta de crédito",
}

#: Lista canónica de campañas (útil para validaciones ligeras)
CANONICAL_CAMPAIGNS: List[str] = list(CAMPAIGNS_TONE.keys())


def normalize_campaign(name: str) -> str:
    """
    Normaliza una campaña aplicando alias conocidos.
    """
    if not isinstance(name, str):
        return ""
    cleaned = name.strip()
    return CAMPAIGN_ALIASES.get(cleaned, cleaned)


def describe_campaign(campaign: str) -> str:
    """
    Devuelve una descripción de tono/posicionamiento para la campaña dada.
    Si no se encuentra, se genera una descripción genérica.
    """
    normalized = normalize_campaign(campaign)
    base = CAMPAIGNS_TONE.get(normalized)
    if base:
        return base

    return (
        f"Campaña financiera del Banco BICE relacionada con '{normalized}'. "
        "Enfócate en claridad, beneficios concretos y un llamado a la acción simple, "
        "manteniendo un tono sobrio y profesional."
    )
