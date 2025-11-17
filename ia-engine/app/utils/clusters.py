# ia-engine/app/utils/clusters.py
"""Definiciones de clusters (drivers) para Banco BICE.

Estas descripciones se usan para contextualizar al modelo según el driver/cluster
seleccionado en Email Studio.

IMPORTANTE:
- Las keys de CLUSTERS deben coincidir con backend/src/utils/constants.ts::CLUSTERS.
- CAMPAIGN_CLUSTERS debe reflejar backend/src/utils/constants.ts::CAMPAIGN_CLUSTERS.
"""

from typing import Dict, List, Optional

from app.utils.campaigns import normalize_campaign

# Descripción base por cluster (independiente de campaña).
# Importante: los nombres deben coincidir con backend/src/utils/constants.ts::CLUSTERS
CLUSTERS: Dict[str, str] = {
    # Crédito de consumo - Persona
    "Auto familiar": (
        "Clientes que están evaluando cambiar o comprar un auto para uso familiar. "
        "Valoran seguridad, espacio, comodidad y confiabilidad en el vehículo, "
        "buscando proteger y facilitar la vida diaria de su grupo familiar."
    ),
    "Auto soltero": (
        "Clientes solteros que quieren cambiar o comprar un auto para uso personal. "
        "Buscan estilo, independencia y libertad de movimiento, sin exceso de estridencia, "
        "manteniendo un tono aspiracional pero sobrio."
    ),
    "Cambio de moto": (
        "Clientes que actualmente usan moto y están evaluando renovarla o cambiarla. "
        "Valoran movilidad ágil, economía en combustible y mejoras de seguridad y tecnología."
    ),
    "Mejora del hogar": (
        "Clientes que desean remodelar, ampliar o mejorar su vivienda actual. "
        "Buscan más confort, mejor distribución o valorizar la propiedad, "
        "con foco en proyectos concretos (cocina, terraza, home office, etc.)."
    ),
    "Proyectos familiares": (
        "Clientes que evalúan tomar un crédito para proyectos asociados a la familia: "
        "educación, salud, cambios de vivienda, experiencias compartidas, entre otros."
    ),
    "Proyectos personales": (
        "Clientes que planean usar el crédito para metas individuales: estudios, postgrados, "
        "cursos, emprendimientos personales, hobbies o cambios de estilo de vida."
    ),
    "Reorganizar finanzas joven": (
        "Clientes de perfil más joven, con varias deudas o productos de crédito activos, "
        "que necesitan ordenar pagos, consolidar y bajar su carga mensual."
    ),
    "Reorganizar finanzas senior": (
        "Clientes de mayor edad con deudas dispersas o estructuras de pago complejas, "
        "que buscan simplificar, ganar estabilidad y planificar mejor su flujo de caja."
    ),
    "Viajes familiares": (
        "Clientes que planifican viajes en familia, dentro o fuera de Chile. "
        "Valoran seguridad, anticipación, comodidad y poder financiar parte del viaje "
        "sin desordenar completamente sus finanzas."
    ),
    "Viajes solteros": (
        "Clientes que planifican viajes individuales o con amistades, normalmente con destinos "
        "más juveniles o experiencias intensas. Buscan flexibilidad y aprovechar la oportunidad "
        "sin sobredimensionar el riesgo financiero."
    ),

    # Crédito de consumo - Empresa
    "Capital de trabajo": (
        "Empresas o emprendedores que requieren liquidez para gastos operativos: pago a proveedores, "
        "sueldos, stock, entre otros. El foco está en continuidad del negocio y estabilidad de caja."
    ),
    "Inversión en activos": (
        "Empresas que buscan financiar la compra o renovación de activos productivos: maquinaria, "
        "tecnología, infraestructura o flota. El mensaje debe vincular el crédito con crecimiento "
        "y eficiencia del negocio."
    ),
    "Ordenar pasivos empresa": (
        "Empresas con varias deudas o líneas de crédito dispersas que quieren simplificar su "
        "estructura de pasivos, mejorando plazos, tasas o visibilidad del endeudamiento."
    ),
    "Expansión del negocio": (
        "Empresas que planean abrir nuevas sucursales, expandirse a nuevas ciudades/países o "
        "incorporar nuevas líneas de negocio. El crédito se presenta como apoyo al crecimiento."
    ),
    "Capital para impuestos": (
        "Empresas que necesitan liquidez puntual para cumplir obligaciones tributarias, "
        "evitando tensiones de caja y manteniendo orden en sus finanzas."
    ),

    # DAP (Depósito a plazo)
    "Ahorro objetivo": (
        "Clientes que quieren reservar un monto con un objetivo concreto (viaje, estudio, "
        "proyecto futuro), usando un instrumento conservador y de plazo definido."
    ),
    "Fondo de emergencia": (
        "Clientes que buscan constituir o reforzar un fondo de emergencia, priorizando liquidez "
        "y seguridad por sobre retornos extremos."
    ),
    "Inversión conservadora": (
        "Clientes con perfil más conservador o parte de un portafolio donde se desea estabilidad, "
        "priorizando preservación de capital y retornos predecibles."
    ),
    "Plan de corto plazo": (
        "Clientes que desean invertir excedentes por unos meses, manteniendo visibilidad del retorno "
        "y fecha de vencimiento del depósito."
    ),
    "Plan de largo plazo": (
        "Clientes con horizonte de varios años, que prefieren definir plazos más largos para "
        "aprovechar mejores condiciones o mayor disciplina de ahorro."
    ),

    # Crédito hipotecario
    "Primera vivienda": (
        "Clientes que buscan financiar su primera vivienda, combinando logro personal con estabilidad "
        "de largo plazo. El tono debe ser aspiracional pero responsable."
    ),
    "Mejora de vivienda actual": (
        "Clientes que quieren cambiarse a una vivienda mejor ubicada, más amplia o de mejor estándar, "
        "manteniendo orden en su carga financiera."
    ),
    "Inversión inmobiliaria": (
        "Clientes que buscan adquirir una propiedad como inversión, pensando en arriendo, plusvalía "
        "y expansión de su patrimonio."
    ),
    "Refinanciar hipotecario": (
        "Clientes que ya tienen un crédito hipotecario y quieren evaluar condiciones mejores "
        "en tasa, plazo o estructura de pagos."
    ),

    # Refinanciar deuda
    "Consolidar deudas consumo": (
        "Clientes con varios créditos de consumo o préstamos dispersos que necesitan unificarlos "
        "en una estructura más simple, con una o pocas cuotas."
    ),
    "Bajar dividendo hipotecario": (
        "Clientes que buscan revisar su crédito hipotecario actual para bajar la cuota mensual, "
        "entendiendo el impacto en plazo y costo total."
    ),
    "Reorganizar tarjetas de crédito": (
        "Clientes con múltiples tarjetas o saldos altos, que necesitan orden, menor carga de interés "
        "y una estructura de pago más clara."
    ),
    "Ordenar líneas y sobregiros": (
        "Clientes que usan líneas de crédito y sobregiros como financiamiento permanente y buscan "
        "reemplazarlo por una deuda más ordenada y estructurada."
    ),

    # Apertura producto - Cuenta corriente
    "Cuenta sueldo": (
        "Clientes que quieren recibir su sueldo en Banco BICE para ordenar mejor sus finanzas "
        "and acceder a beneficios asociados."
    ),
    "Cuenta para PyME": (
        "Empresas o emprendedores que necesitan una cuenta para operar el día a día: pagos, recaudación "
        "y relación con proveedores, con soporte especializado."
    ),
    "Cuenta alta renta": (
        "Clientes de renta alta que buscan una relación bancaria con servicio más personalizado, "
        "acceso a productos avanzados e integración con inversión y crédito."
    ),
    "Cuenta para profesional independiente": (
        "Profesionales independientes que necesitan separar finanzas personales y del negocio, "
        "ordenar ingresos variables y mejorar su estructura de pagos."
    ),

    # Apertura producto - Tarjeta de crédito
    "Viajes internacionales": (
        "Clientes que viajan fuera de Chile y valoran seguridad, beneficios en viajes y flexibilidad "
        "para compras en el extranjero."
    ),
    "Compras diarias": (
        "Clientes que usan la tarjeta en su gasto cotidiano y necesitan visibilidad y control "
        "del presupuesto mensual."
    ),
    "Compras online": (
        "Clientes que compran frecuentemente por canales digitales y valoran seguridad, "
        "beneficios y experiencia fluida en e-commerce."
    ),
    "Segmento alta renta": (
        "Clientes de alto ingreso que buscan beneficios superiores, mejor servicio y una experiencia "
        "de tarjeta alineada a su estilo de vida."
    ),

    # Seguros
    "Seguro de auto": (
        "Clientes que quieren proteger su vehículo, con foco en asistencia en ruta, reparación y "
        "tranquilidad frente a siniestros."
    ),
    "Seguro de vida": (
        "Clientes que buscan proteger a su familia ante eventos graves, garantizando respaldo económico "
        "en momentos complejos."
    ),
    "Seguro de hogar": (
        "Clientes que quieren proteger su vivienda y contenido del hogar ante incendios, robos o daños, "
        "cuidando su patrimonio."
    ),
    "Seguro de viaje": (
        "Clientes que viajan dentro o fuera de Chile y valoran cobertura médica, asistencia y protección "
        "ante imprevistos en el trayecto."
    ),
    "Seguro de salud": (
        "Clientes que desean complementar su cobertura actual de salud, reduciendo el impacto "
        "económico de atenciones médicas o tratamientos."
    ),
}

#: Mapa campaña -> lista de clusters permitidos (debe reflejar constants.ts del backend)
CAMPAIGN_CLUSTERS: Dict[str, List[str]] = {
    "Crédito de consumo - Persona": [
        "Auto familiar",
        "Auto soltero",
        "Cambio de moto",
        "Mejora del hogar",
        "Proyectos familiares",
        "Proyectos personales",
        "Reorganizar finanzas joven",
        "Reorganizar finanzas senior",
        "Viajes familiares",
        "Viajes solteros",
    ],
    "Crédito de consumo - Empresa": [
        "Capital de trabajo",
        "Inversión en activos",
        "Ordenar pasivos empresa",
        "Expansión del negocio",
        "Capital para impuestos",
    ],
    "DAP (Depósito a plazo)": [
        "Ahorro objetivo",
        "Fondo de emergencia",
        "Inversión conservadora",
        "Plan de corto plazo",
        "Plan de largo plazo",
    ],
    "Crédito hipotecario": [
        "Primera vivienda",
        "Mejora de vivienda actual",
        "Inversión inmobiliaria",
        "Refinanciar hipotecario",
    ],
    "Refinanciar deuda": [
        "Consolidar deudas consumo",
        "Bajar dividendo hipotecario",
        "Reorganizar tarjetas de crédito",
        "Ordenar líneas y sobregiros",
    ],
    "Apertura producto - Cuenta corriente": [
        "Cuenta sueldo",
        "Cuenta para PyME",
        "Cuenta alta renta",
        "Cuenta para profesional independiente",
    ],
    "Apertura producto - Tarjeta de crédito": [
        "Viajes internacionales",
        "Compras diarias",
        "Compras online",
        "Segmento alta renta",
    ],
    "Seguros": [
        "Seguro de auto",
        "Seguro de vida",
        "Seguro de hogar",
        "Seguro de viaje",
        "Seguro de salud",
    ],
}

#: Overrides opcionales por campaña+cluster (cuando el contexto cambia mucho)
CAMPAIGN_CLUSTER_CONTEXT: Dict[str, Dict[str, str]] = {
    # Ejemplos – se pueden ir afinando con el tiempo
    "Crédito de consumo - Persona": {
        "Auto familiar": (
            "Presenta el crédito de consumo como una forma de renovar el auto familiar, "
            "destacando seguridad, espacio y comodidad, sin sobreprometer beneficios."
        ),
        "Auto soltero": (
            "Enfoca el crédito en renovar el auto del cliente, ligado a independencia y estilo de vida, "
            "manteniendo un tono sobrio y responsable."
        ),
        "Mejora del hogar": (
            "Plantea el crédito como herramienta para remodelar o ampliar la vivienda, "
            "con foco en confort y valorización del inmueble."
        ),
        "Reorganizar finanzas joven": (
            "Propón el crédito como forma de ordenar deudas dispersas, bajar la carga mensual "
            "y recuperar tranquilidad, con tono empático."
        ),
        "Reorganizar finanzas senior": (
            "Habla de simplificar pagos y ganar estabilidad, explicando claramente condiciones y plazos, "
            "con lenguaje muy respetuoso."
        ),
    },
    "Crédito de consumo - Empresa": {
        "Capital de trabajo": (
            "Enfatiza que el crédito apoya el ciclo operativo del negocio, cubriendo brechas de caja "
            "sin desordenar la estructura financiera."
        ),
        "Inversión en activos": (
            "Vincula el crédito con la renovación de equipos, tecnología o infraestructura que permitan "
            "hacer crecer la empresa."
        ),
    },
    # El resto de combinaciones usa el fallback genérico con la descripción base del cluster.
}


def clusters_for_campaign(campaign: str) -> list[str]:
    """
    Devuelve la lista de clusters válidos para una campaña dada
    (según la misma lógica que el backend Node).
    """
    normalized = normalize_campaign(campaign)
    return CAMPAIGN_CLUSTERS.get(normalized, [])


def describe_cluster(cluster: str, campaign: Optional[str] = None) -> str:
    """
    Devuelve una descripción amigable del cluster.
    Si se entrega campaña, intenta contextualizar el mensaje a ese producto.
    """
    base = CLUSTERS.get(cluster)
    normalized_campaign: Optional[str] = (
        normalize_campaign(campaign) if campaign else None
    )

    # 1) Contexto específico campaña+cluster (si existe override)
    if normalized_campaign:
        override = CAMPAIGN_CLUSTER_CONTEXT.get(
            normalized_campaign, {}
        ).get(cluster)
        if override:
            return override

    # 2) Descripción base + instrucción genérica de adaptación al producto
    if base and normalized_campaign:
        return (
            f"{base} En el contexto de la campaña '{normalized_campaign}', "
            "explica cómo este producto ayuda específicamente a este segmento, "
            "con foco en beneficios concretos, lenguaje claro y tono Banco BICE."
        )

    # 3) Solo descripción base del cluster
    if base:
        return base

    # 4) Fallback total
    if normalized_campaign:
        return (
            f"Segmento de clientes identificado como '{cluster}' para la campaña "
            f"'{normalized_campaign}'. Ajusta el mensaje a su contexto, necesidades "
            "financieras y etapa de vida."
        )

    return (
        f"Segmento de clientes identificado como '{cluster}'. "
        "Ajusta el mensaje a su contexto, necesidades financieras y etapa de vida."
    )
