# ia-engine/app/utils/copy_meta.py
"""
Catálogo de copy para campañas y clusters del IA Engine.

Centraliza:
- BENEFITS: beneficios por campaña canónica.
- CTAS: llamados a la acción por campaña canónica.
- SUBJECTS: ejemplos de asuntos por campaña canónica.
- CLUSTER_TONE: indicaciones de tono por cluster canónico.

IMPORTANTE:
- Las keys de campaña DEBEN alinearse con los nombres canónicos
  de `CAMPAIGNS_TONE` (app.utils.campaigns).
- Las keys de cluster DEBEN alinearse con `CLUSTERS` (app.utils.clusters).
"""

from typing import Any, Dict, List


# ============================================================
#  Beneficios por campaña (keys canónicas)
# ============================================================

BENEFITS: Dict[str, List[str]] = {
    "Crédito de consumo - Persona": [
        # Antes: "Crédito de Consumo BICE"
        "tasa competitiva para clientes Banco BICE",
        "cuotas y plazos flexibles según tu ingreso",
        "proceso 100% online y sin papeleo excesivo",
        "abono rápido del dinero en tu cuenta corriente",
        "posibilidad de prepago parcial o total según condiciones vigentes",
        # Antes: "Aumento línea de crédito"
        "mayor flexibilidad para manejar imprevistos en el mes",
        "alternativa para ordenar gastos de corto plazo",
        "complemento a otros productos de financiamiento",
    ],
    "Crédito de consumo - Empresa": [
        "liquidez para gastos operativos y capital de trabajo",
        "opción de financiar activos productivos y tecnología",
        "plazos y montos ajustables según el flujo del negocio",
        "evaluación especializada para empresas y emprendedores",
    ],
    "DAP (Depósito a plazo)": [
        # Antes: "DAP (Depósito a Plazo)"
        "tasa fija conocida desde el inicio",
        "plazos según tu horizonte de inversión",
        "producto conservador y de bajo riesgo",
        "renovación simple desde canales digitales",
        # Guiño conservador para complementar un portafolio
        "puede complementar otras alternativas de inversión como parte conservadora de tu portafolio",
    ],
    "Crédito hipotecario": [
        "tasas competitivas para clientes Banco BICE",
        "financiamiento para primera vivienda o inversión",
        "plazos largos para ordenar tu dividendo",
        "asesoría especializada en cada etapa de la compra",
        "opciones de portabilidad y refinanciamiento",
    ],
    "Refinanciar deuda": [
        # Antes: "Consolidación de deudas" + "Ordena tus deudas"
        "posibilidad de bajar la cuota mensual total",
        "unificar deudas en menos productos para simplificar el pago",
        "ordenar el flujo de caja mes a mes",
        "ajustar el plazo a tu capacidad de pago",
        "acompañamiento para entender el nuevo esquema de pagos",
        "unificar varios compromisos en una estructura más clara",
        "reordenar plazos y montos para aliviar la carga mensual",
        "tener una fecha de pago más predecible",
        "reducir la probabilidad de atrasos y recargos",
    ],
    "Apertura producto - Tarjeta de crédito": [
        # Antes: "Tarjeta de crédito"
        "beneficios en comercios y programas de puntos",
        "compras en cuotas en Chile y el extranjero",
        "seguro asociado según producto contratado",
        "gestión 100% digital de la tarjeta",
        "herramientas para seguir y ordenar tus gastos",
        # Antes: "Aumento cupo TC"
        "mayor holgura para compras grandes o viajes",
        "posibilidad de concentrar gastos en una tarjeta",
        "acceso a más beneficios asociados a tu tarjeta",
    ],
    "Apertura producto - Cuenta corriente": [
        # Antes: "Cuenta corriente PyME" (adaptado a uso general)
        "medios de pago para el día a día",
        "acceso a canales digitales y servicios de recaudación",
        "posibilidad de complementar con líneas de crédito y otros productos",
        "facilita ordenar ingresos y gastos en una sola cuenta",
    ],
    "Seguros": [
        # Antes: "Seguros"
        "protección frente a eventos imprevistos",
        "coberturas ajustables según tu necesidad",
        "asistencia y soporte especializado",
        "respaldo de Banco BICE y sus aliados",
        # Antes: "Seguros de auto"
        "protección del vehículo frente a accidentes y robos",
        "asistencia en ruta y servicios complementarios",
        "distintas coberturas para adaptarse a tu uso del auto",
        # Antes: "Seguros de vida"
        "protección económica para tu familia ante imprevistos",
        "opciones de cobertura según etapa de vida",
        "posibilidad de complementar con otros seguros",
    ],
}


# ============================================================
#  CTAs por campaña (keys canónicas)
# ============================================================

CTAS: Dict[str, List[str]] = {
    "Crédito de consumo - Persona": [
        # Antes: "Crédito de Consumo BICE"
        "Simular mi crédito",
        "Ver mi oferta",
        "Hablar con un ejecutivo",
        # Antes: "Aumento línea de crédito"
        "Solicitar evaluación",
        "Ver alternativas",
    ],
    "Crédito de consumo - Empresa": [
        "Solicitar evaluación para mi empresa",
        "Hablar con un ejecutivo",
        "Conocer alternativas de financiamiento",
    ],
    "DAP (Depósito a plazo)": [
        # Antes: "DAP (Depósito a Plazo)"
        "Simular mi depósito",
        "Ver tasas vigentes",
        "Abrir depósito a plazo",
        # Antes: "Fondos mutuos / Inversión" (adaptado)
        "Conocer alternativas de inversión",
    ],
    "Crédito hipotecario": [
        "Simular mi dividendo",
        "Pedir asesoría hipotecaria",
        "Conocer mi oferta",
    ],
    "Refinanciar deuda": [
        # Antes: "Consolidación de deudas" + "Ordena tus deudas"
        "Evaluar mi consolidación",
        "Simular nueva cuota",
        "Hablar con un ejecutivo",
        "Ordenar mis deudas",
        "Simular nueva estructura",
        "Solicitar asesoría",
    ],
    "Apertura producto - Tarjeta de crédito": [
        # Antes: "Tarjeta de crédito"
        "Solicitar tarjeta",
        "Conocer beneficios",
        "Ver requisitos",
        # Antes: "Aumento cupo TC"
        "Pedir aumento de cupo",
        "Evaluar mi tarjeta",
    ],
    "Apertura producto - Cuenta corriente": [
        # Antes: "Cuenta corriente PyME"
        "Abrir cuenta corriente",
        "Conocer requisitos",
        "Agendar llamada",
    ],
    "Seguros": [
        # Antes: "Seguros"
        "Cotizar seguro",
        "Conocer coberturas",
        "Hablar con ejecutivo",
        # Antes: "Seguros de auto"
        "Cotizar seguro de auto",
        # Antes: "Seguros de vida"
        "Cotizar seguro de vida",
        "Calcular prima",
        "Hablar con asesor",
    ],
}


# ============================================================
#  Subjects de referencia por campaña (keys canónicas)
# ============================================================

SUBJECTS: Dict[str, List[str]] = {
    "Crédito de consumo - Persona": [
        # Antes: "Crédito de Consumo BICE"
        "Tu próximo proyecto, con un crédito a tu medida",
        "Financia lo que necesitas con el Crédito de Consumo BICE",
        "Haz realidad tus planes con cuotas claras y tasa competitiva",
        "Tu crédito 100% online, en pocos pasos",
        "Da el siguiente paso con un crédito pensado para ti",
        # Antes: "Aumento línea de crédito"
        "Evalúa aumentar tu línea de crédito",
        "Más flexibilidad para tu día a día",
        "Revisa alternativas para manejar tus imprevistos",
    ],
    "Crédito de consumo - Empresa": [
        "Financiamiento para las necesidades de tu empresa",
        "Evalúa un crédito para el día a día de tu negocio",
        "Haz crecer tu empresa con apoyo financiero BICE",
    ],
    "DAP (Depósito a plazo)": [
        # Antes: "DAP (Depósito a Plazo)" + "Fondos mutuos / Inversión" (adaptado)
        "Haz que tu ahorro trabaje con una tasa conocida",
        "Evalúa un Depósito a Plazo para tus excedentes",
        "Una alternativa conservadora para tu dinero",
        "Da el siguiente paso en tus inversiones",
        "Evalúa alternativas de inversión con Banco BICE",
        "Diversifica tu ahorro con una solución conservadora",
    ],
    "Crédito hipotecario": [
        "Da el siguiente paso hacia tu nueva vivienda",
        "Evalúa tu crédito hipotecario con Banco BICE",
        "Tu próxima propiedad, con asesoría especializada",
    ],
    "Refinanciar deuda": [
        # Antes: "Consolidación de deudas" + "Ordena tus deudas"
        "Evalúa unificar tus deudas en una sola cuota",
        "Menos estrés: una cuota, mejores condiciones",
        "Ordena tus deudas y alivia tu mes",
        "Revisa si puedes mejorar tu carga financiera",
        "Es momento de ordenar tus deudas",
        "Revisa una forma más simple de pagar mes a mes",
        "Un solo plan de pago para tus deudas actuales",
        "Evalúa un nuevo esquema de cuotas para tu tranquilidad",
    ],
    "Apertura producto - Tarjeta de crédito": [
        # Antes: "Tarjeta de crédito" + "Aumento cupo TC"
        "Conoce los beneficios de tu tarjeta BICE",
        "Evalúa una tarjeta pensada para tu estilo de vida",
        "Organiza tus compras con una tarjeta a tu medida",
        "Evalúa aumentar el cupo de tu tarjeta",
        "Más espacio para tus planes con tu tarjeta BICE",
        "Revisa si puedes ampliar tu cupo hoy",
    ],
    "Apertura producto - Cuenta corriente": [
        # Antes: "Cuenta corriente PyME" (adaptado)
        "Ordena tus finanzas con una cuenta corriente en Banco BICE",
        "Evalúa una cuenta pensada para tu día a día",
        "Soluciones bancarias para tu actividad financiera",
    ],
    "Seguros": [
        # Antes: "Seguros" + "Seguros de auto" + "Seguros de vida"
        "Revisa cómo proteger lo que más valoras",
        "Evalúa tus coberturas de seguros con Banco BICE",
        "Protección y tranquilidad para ti y tu familia",
        "Protege tu auto con un seguro a tu medida",
        "Evalúa un seguro para tu vehículo",
        "Más tranquilidad cada vez que manejes",
        "Piensa hoy en la protección de tu familia",
        "Evalúa un seguro de vida según tu etapa",
        "Un plan de protección pensado para quienes más quieres",
    ],
}


# ============================================================
#  Tono por cluster (canon: CLUSTERS de app.utils.clusters)
# ============================================================

CLUSTER_TONE: Dict[str, str] = {
    # Clusters de Crédito de consumo - Persona
    "Auto familiar": (
        "Destaca seguridad, comodidad y espacio para la familia al renovar el auto."
    ),
    "Auto soltero": (
        "Tono aspiracional; enfócate en estilo de vida, independencia y libertad."
    ),
    "Cambio de moto": (
        "Resalta movilidad ágil, economía y mejora respecto al vehículo actual."
    ),
    "Mejora del hogar": (
        "Conecta con ideas de renovación, confort y valorización de la vivienda."
    ),
    "Proyectos familiares": (
        "Enfoca en bienestar del grupo familiar, estudios, salud y experiencias compartidas."
    ),
    "Proyectos personales": (
        "Habla de desarrollo personal, estudios, hobbies y cambios de vida."
    ),
    "Reorganizar finanzas joven": (
        "Tono empático y sin juicio; foco en alivio de carga mensual y orden financiero."
    ),
    "Reorganizar finanzas senior": (
        "Tono claro y respetuoso; prioriza estabilidad, simplicidad y tranquilidad."
    ),
    "Viajes familiares": (
        "Invita a vivir experiencias en familia, planificar con anticipación y viajar tranquilos."
    ),
    "Viajes solteros": (
        "Tono más lúdico y motivador; habla de destinos, experiencias intensas y flexibilidad."
    ),
}


# ============================================================
#  Helper de export
# ============================================================

def get_copy_meta() -> Dict[str, Any]:
    """
    Devuelve un diccionario con los catálogos de copy.

    Estructura:
        {
          "benefits": { campaign: [..] },
          "ctas": { campaign: [..] },
          "subjects": { campaign: [..] },
          "clusterTone": { cluster: "..." }
        }
    """
    return {
        "benefits": BENEFITS,
        "ctas": CTAS,
        "subjects": SUBJECTS,
        "clusterTone": CLUSTER_TONE,
    }


__all__ = ["BENEFITS", "CTAS", "SUBJECTS", "CLUSTER_TONE", "get_copy_meta"]
