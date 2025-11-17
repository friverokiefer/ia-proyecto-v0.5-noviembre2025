# Email Studio – IA Engine (Python / FastAPI)

Microservicio Python que actúa como **motor de texto** para el proyecto _Email Studio_ (Banco BICE).

Su responsabilidad principal es generar **sets de contenido de email** (subject, preheader, title, subtitle, body, cta) a partir de:

- Una **campaña** (producto/uso comercial).
- Un **cluster** (segmento / driver de comunicación).
- Opcionalmente, **feedback** del usuario.
- Reglas de tono, compliance y entregabilidad centralizadas en el propio motor.

> Nota: a nivel de negocio hablamos solo de **sets de contenido**. No existe ya el concepto de “trios”.

---

## 1. Arquitectura y organización

Estructura principal:

```txt
ia-engine/
├── Dockerfile
├── app
│   ├── main.py
│   ├── models
│   │   ├── request.py
│   │   └── response.py
│   ├── routers
│   │   ├── generate.py
│   │   └── meta.py
│   ├── services
│   │   ├── openai_client.py
│   │   └── text_engine.py
│   └── utils
│       ├── campaigns.py
│       ├── clusters.py
│       ├── copy_meta.py
│       ├── meta.py
│       ├── prompts.py
│       └── validators.py
├── pyproject.toml
├── poetry.lock
└── requirements.txt
```

### Componentes clave

- `app/main.py`
  - Inicializa la app **FastAPI** .
  - Registra los routers:
    - `/ia/generate` → generación de texto.
    - `/ia/meta` → catálogo de campañas/clusters/meta.
- `app/models/request.py`
  - `GenerateRequest`: payload de entrada para `/ia/generate`.
  - `EmailFeedback`: hints opcionales del usuario (subject, preheader, bodyContent/body).
- `app/models/response.py`
  - `GeneratedVariant`: representación tipada de un **set de contenido** .
  - `BodyBlock`: título, subtítulo y contenido del cuerpo.
- `app/routers/generate.py`
  - Endpoint HTTP que:
    - Valida y castea el `GenerateRequest`.
    - Llama a `text_engine.generate_sets`.
    - Devuelve:
      - `engine`: nombre lógico del motor (`"openai"`).
      - `variants`: lista de sets generados.
      - `metadata`: info adicional opcional.
- `app/routers/meta.py`
  - Endpoint `/ia/meta` que expone el catálogo estático:
    - campañas
    - clusters
    - campaignClusters
    - benefits, ctas, subjects, clusterTone
- `app/services/openai_client.py`
  - Cliente **OpenAI** de bajo nivel:
    - Lee configuración desde env (`OPENAI_API_KEY`, modelos, sampling, timeouts).
    - Expone `chat_json(system, user, **kwargs)`:
      - Maneja el llamado a `chat.completions.create` con `response_format=json_object`.
      - Implementa **reintentos** y **timeout** configurables.
      - Devuelve un `dict` (JSON parseado) o levanta error si no se pudo.
- `app/services/text_engine.py`
  - Núcleo de negocio del motor de texto:
    - `generate_sets(request: GenerateRequest) -> List[GeneratedVariant]`
    - Alias semántico: `generate_email_sets(...)`.
  - Responsabilidades:
    - Normalizar campaña/cluster con `soft_validate_campaign_cluster`.
    - Clampear cantidad de sets (1..5).
    - Para cada set:
      - Construir `system` + `user` con `build_email_prompt(...)`.
      - Llamar a `chat_json(...)` (OpenAI).
      - Mapear la respuesta JSON a `GeneratedVariant`.
    - En caso de error por set:
      - Logea el error.
      - Devuelve un **stub** (`_stub_variant`) legible, para no romper el flujo.
- `app/utils/campaigns.py`
  - `CAMPAIGNS_TONE`: campañas canónicas + descripción de tono/posicionamiento.
  - `CAMPAIGN_ALIASES`: alias antiguos → nombre canónico.
  - `normalize_campaign(...)` y `describe_campaign(...)`.
- `app/utils/clusters.py`
  - `CLUSTERS`: clusters canónicos (drivers/segmentos) + descripción base.
  - `CAMPAIGN_CLUSTERS`: mapa campaña → clusters permitidos.
  - `describe_cluster(...)` y `clusters_for_campaign(...)`.
- `app/utils/copy_meta.py`
  - Catálogo de copy por campaña/cluster:
    - `BENEFITS`: beneficios sugeridos.
    - `CTAS`: llamados a la acción sugeridos.
    - `SUBJECTS`: ejemplos de asuntos.
    - `CLUSTER_TONE`: tono por cluster.
  - `get_copy_meta()` para consolidar.
- `app/utils/meta.py`
  - `get_meta()` arma el objeto que entrega `/ia/meta`:
    - `campaigns`, `clusters`, `campaignClusters`, `benefits`, `ctas`, `subjects`, `clusterTone`.
- `app/utils/prompts.py`
  - Construcción del prompt para el modelo:
    - Regla de idioma y tono (Chile, Banco BICE).
    - Reglas de compliance y “no prometer aprobaciones”.
    - Entregabilidad (evitar palabras spam, mayúsculas sostenidas, emojis).
    - Límites de longitud recomendados.
    - Estructura del body (texto plano, bullets con `- `, sin HTML).
    - Contraste entre subject/preheader/title/subtitle (deduplicación semántica).
    - Instrucciones de salida: **únicamente JSON** con campos esperados.
- `app/utils/validators.py`
  - Normalización y validación “suave”:
    - `normalize_campaign_name(...)`.
    - `is_known_campaign(...)`, `is_known_cluster(...)`.
    - `allowed_clusters_for_campaign(...)`.
    - `soft_validate_campaign_cluster(...)` y `strict_validate_campaign_cluster(...)`.
  - Usa `CAMPAIGNS_TONE` y `CLUSTERS` como fuente de verdad.

---

## 2. Contrato de API

### 2.1. POST `/ia/generate`

Genera **N sets de contenido** para un email.

#### Request (JSON)

<pre class="overflow-visible!" data-start="5274" data-end="5584"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"engine"</span><span>:</span><span></span><span>"openai"</span><span>,</span><span>
  </span><span>"campaign"</span><span>:</span><span></span><span>"Crédito de consumo - Persona"</span><span>,</span><span>
  </span><span>"cluster"</span><span>:</span><span></span><span>"Viajes solteros"</span><span>,</span><span>
  </span><span>"sets"</span><span>:</span><span></span><span>3</span><span>,</span><span>
  </span><span>"feedback"</span><span>:</span><span></span><span>{</span><span>
    </span><span>"subject"</span><span>:</span><span></span><span>"algo más juvenil"</span><span>,</span><span>
    </span><span>"preheader"</span><span>:</span><span></span><span>"enfocado en viajes y experiencias"</span><span>,</span><span>
    </span><span>"bodyContent"</span><span>:</span><span></span><span>"quiero un tono fresco pero sobrio"</span><span>,</span><span>
    </span><span>"body"</span><span>:</span><span></span><span>null</span><span>
  </span><span>}</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

Campos:

- `engine` (string, opcional): por ahora `"openai"` (placeholder para futuro multi-motor).
- `campaign` (string, requerido): nombre de campaña canónica o alias.
- `cluster` (string, requerido): cluster canónico (driver segmentado).
- `sets` (int, opcional): 1..5 (se clampea internamente).
- `feedback` (opcional):
  - `subject`, `preheader`: hints de copy.
  - `bodyContent` / `body`: hint de texto largo.

#### Response (JSON)

<pre class="overflow-visible!" data-start="6025" data-end="6842"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"engine"</span><span>:</span><span></span><span>"openai"</span><span>,</span><span>
  </span><span>"variants"</span><span>:</span><span></span><span>[</span><span>
    </span><span>{</span><span>
      </span><span>"id"</span><span>:</span><span></span><span>1</span><span>,</span><span>
      </span><span>"subject"</span><span>:</span><span></span><span>"Tu próximo viaje, con un crédito a tu medida"</span><span>,</span><span>
      </span><span>"preheader"</span><span>:</span><span></span><span>"Evalúa financiar tus experiencias sin desordenar tus finanzas"</span><span>,</span><span>
      </span><span>"body"</span><span>:</span><span></span><span>{</span><span>
        </span><span>"title"</span><span>:</span><span></span><span>"Viaja hoy con un crédito pensado para ti"</span><span>,</span><span>
        </span><span>"subtitle"</span><span>:</span><span></span><span>"Organiza tus viajes sin perder el control de tu presupuesto"</span><span>,</span><span>
        </span><span>"content"</span><span>:</span><span></span><span>"..."</span><span>
      </span><span>}</span><span>,</span><span>
      </span><span>"cta"</span><span>:</span><span></span><span>"Simular mi crédito"</span><span>
    </span><span>}</span><span>,</span><span>
    </span><span>{</span><span>
      </span><span>"id"</span><span>:</span><span></span><span>2</span><span>,</span><span>
      </span><span>"subject"</span><span>:</span><span></span><span>"Más experiencias, con cuotas claras"</span><span>,</span><span>
      </span><span>"preheader"</span><span>:</span><span></span><span>"Conoce alternativas para financiar tus viajes con Banco BICE"</span><span>,</span><span>
      </span><span>"body"</span><span>:</span><span></span><span>{</span><span>
        </span><span>"title"</span><span>:</span><span></span><span>"Planifica tu próximo destino con tranquilidad"</span><span>,</span><span>
        </span><span>"subtitle"</span><span>:</span><span></span><span>null</span><span></span><span>,</span><span>
        </span><span>"content"</span><span>:</span><span></span><span>"..."</span><span>
      </span><span>}</span><span>,</span><span>
      </span><span>"cta"</span><span>:</span><span></span><span>"Ver mi oferta"</span><span>
    </span><span>}</span><span>
  </span><span>]</span><span>,</span><span>
  </span><span>"metadata"</span><span>:</span><span></span><span>{</span><span>}</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

- `engine`: motor usado (ej. `"openai"`).
- `variants`: lista de **sets de contenido** :
  - `id`: correlativo (1..N).
  - `subject`: asunto del email.
  - `preheader`: preheader/inbox preview.
  - `body.title`: título principal (H1).
  - `body.subtitle`: bajada opcional.
  - `body.content`: cuerpo en **texto plano** .
  - `cta`: texto corto de llamado a la acción (opcional).
- `metadata`: reservado para telemetría futura (trazas, modelo efectivo, etc.).

En caso de fallo de OpenAI por variante, esa posición se rellena con un **stub** que indica campaña, cluster y set.

---

### 2.2. GET `/ia/meta`

Devuelve el catálogo completo para que backend Node y frontend no tengan que hardcodear campañas/clusters.

#### Response (ejemplo simplificado)

<pre class="overflow-visible!" data-start="7595" data-end="8695"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"campaigns"</span><span>:</span><span></span><span>[</span><span>
    </span><span>"Crédito de consumo - Persona"</span><span>,</span><span>
    </span><span>"Crédito de consumo - Empresa"</span><span>,</span><span>
    </span><span>"DAP (Depósito a plazo)"</span><span>,</span><span>
    </span><span>"Crédito hipotecario"</span><span>,</span><span>
    </span><span>"Refinanciar deuda"</span><span>,</span><span>
    </span><span>"Apertura producto - Cuenta corriente"</span><span>,</span><span>
    </span><span>"Apertura producto - Tarjeta de crédito"</span><span>,</span><span>
    </span><span>"Seguros"</span><span>
  </span><span>]</span><span>,</span><span>
  </span><span>"clusters"</span><span>:</span><span></span><span>[</span><span>
    </span><span>"Auto familiar"</span><span>,</span><span>
    </span><span>"Auto soltero"</span><span>,</span><span>
    </span><span>"Viajes solteros"</span><span>,</span><span>
    </span><span>"Primera vivienda"</span><span>,</span><span>
    </span><span>"Inversión inmobiliaria"</span><span>,</span><span>
    </span><span>"Seguro de auto"</span><span>
  </span><span>]</span><span>,</span><span>
  </span><span>"campaignClusters"</span><span>:</span><span></span><span>{</span><span>
    </span><span>"Crédito de consumo - Persona"</span><span>:</span><span></span><span>[</span><span>
      </span><span>"Auto familiar"</span><span>,</span><span>
      </span><span>"Auto soltero"</span><span>,</span><span>
      </span><span>"Cambio de moto"</span><span>,</span><span>
      </span><span>"Mejora del hogar"</span><span>,</span><span>
      </span><span>"Proyectos familiares"</span><span>,</span><span>
      </span><span>"Proyectos personales"</span><span>,</span><span>
      </span><span>"Reorganizar finanzas joven"</span><span>,</span><span>
      </span><span>"Reorganizar finanzas senior"</span><span>,</span><span>
      </span><span>"Viajes familiares"</span><span>,</span><span>
      </span><span>"Viajes solteros"</span><span>
    </span><span>]</span><span>,</span><span>
    </span><span>"Crédito hipotecario"</span><span>:</span><span></span><span>[</span><span>
      </span><span>"Primera vivienda"</span><span>,</span><span>
      </span><span>"Mejora de vivienda actual"</span><span>,</span><span>
      </span><span>"Inversión inmobiliaria"</span><span>,</span><span>
      </span><span>"Refinanciar hipotecario"</span><span>
    </span><span>]</span><span>
  </span><span>}</span><span>,</span><span>
  </span><span>"benefits"</span><span>:</span><span></span><span>{</span><span></span><span>"..."</span><span>:</span><span></span><span>[</span><span>"..."</span><span>]</span><span></span><span>}</span><span>,</span><span>
  </span><span>"ctas"</span><span>:</span><span></span><span>{</span><span></span><span>"..."</span><span>:</span><span></span><span>[</span><span>"..."</span><span>]</span><span></span><span>}</span><span>,</span><span>
  </span><span>"subjects"</span><span>:</span><span></span><span>{</span><span></span><span>"..."</span><span>:</span><span></span><span>[</span><span>"..."</span><span>]</span><span></span><span>}</span><span>,</span><span>
  </span><span>"clusterTone"</span><span>:</span><span></span><span>{</span><span></span><span>"..."</span><span>:</span><span></span><span>"..."</span><span></span><span>}</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

---

## 3. Configuración (variables de entorno)

Variables clave:

<pre class="overflow-visible!" data-start="8764" data-end="9160"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-env"><span># Obligatoria
OPENAI_API_KEY=sk-...

# Opcional: endpoint privado (por ejemplo, gateway interno o proxy)
OPENAI_BASE_URL=https://api.openai.com/v1

# Modelo principal para generación de emails en JSON
OPENAI_MODEL_EMAIL=gpt-4o-mini

# Sampling
OPENAI_TEXT_TEMP=0.6
OPENAI_TEXT_TOP_P=0.9
OPENAI_TEXT_MAX_TOKENS=900

# Timeouts / reintentos
OPENAI_REQUEST_TIMEOUT=30
OPENAI_MAX_RETRIES=2
</span></code></div></div></pre>

El puerto/host de FastAPI se controla al levantar `uvicorn` (ver siguiente sección).

El backend Node espera, por defecto, que este servicio esté en:

<pre class="overflow-visible!" data-start="9314" data-end="9365"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-env"><span>IA_ENGINE_BASE_URL=http://127.0.0.1:8001
</span></code></div></div></pre>

(eso se define en el **backend** , no aquí).

---

## 4. Ejecución local

### 4.1. Con Poetry (recomendado)

<pre class="overflow-visible!" data-start="9475" data-end="9599"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span># Desde la carpeta ia-engine</span><span>
poetry install

poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
</span></span></code></div></div></pre>

Luego puedes testear manualmente:

<pre class="overflow-visible!" data-start="9636" data-end="9871"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>curl -X POST </span><span>"http://127.0.0.1:8001/ia/generate"</span><span> \
  -H </span><span>"Content-Type: application/json"</span><span> \
  -d '{
    "engine": "openai",
    "campaign": "Crédito de consumo - Persona",
    "cluster": "Viajes solteros",
    "sets": 2
  }'
</span></span></code></div></div></pre>

Y para el catálogo:

<pre class="overflow-visible!" data-start="9894" data-end="9942"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>curl </span><span>"http://127.0.0.1:8001/ia/meta"</span><span>
</span></span></code></div></div></pre>

### 4.2. Con `requirements.txt` (sin Poetry)

<pre class="overflow-visible!" data-start="9990" data-end="10169"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>python -m venv .venv
</span><span>source</span><span> .venv/bin/activate  </span><span># (en Windows: .venv\Scripts\activate)</span><span>
pip install -r requirements.txt

uvicorn app.main:app --host 0.0.0.0 --port 8001
</span></span></code></div></div></pre>

---

## 5. Docker

El repositorio incluye un `Dockerfile` pensado para correr este servicio como microservicio en Cloud Run u otra plataforma.

Ejemplo local:

<pre class="overflow-visible!" data-start="10331" data-end="10497"><div class="contain-inline-size rounded-2xl relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span># Build</span><span>
docker build -t email-studio-ia-engine:latest .

</span><span># Run</span><span>
docker run --</span><span>rm</span><span> -p 8001:8001 \
  -e OPENAI_API_KEY=sk-... \
  email-studio-ia-engine:latest
</span></span></code></div></div></pre>

El backend Node seguirá hablando a `http://127.0.0.1:8001/ia/...` si se usa `--network=host`

(en Cloud Run se configura `IA_ENGINE_BASE_URL` con la URL pública del servicio).

---

## 6. Flujo típico end-to-end

1. **Frontend Email Studio** :

- Usuario selecciona campaña y cluster.
- Indica cantidad de **sets de contenido** (1..5).
- Opcionalmente entrega feedback (subject/preheader/body).

1. **Backend Node (`/api/generate-emails-v2`)** :

- Valida campaña/cluster contra su propio catálogo.
- Genera imágenes vía servicio de imágenes.
- Llama al IA Engine (`/ia/generate`) con:
  - `campaign`, `cluster`, `sets`, `feedback (+ heroUrl)`.

1. **IA Engine (FastAPI Python)** :

- Normaliza campaña/cluster.
- Construye prompts robustos con reglas de BICE.
- Llama a OpenAI vía `openai_client.chat_json(...)`.
- Devuelve `variants` (sets de contenido) + `metadata`.

1. **Backend Node** :

- Sanitiza textos para inbox (spam triggers, emojis, clamps).
- Guarda batch en GCS (`batch.json`, `_manifest.json`).
- Responde al frontend con sets + imágenes.

1. **Frontend** :

- Muestra las variantes (sets) y las imágenes.
- Permite refinar y re-guardar (PUT `/api/emails-v2/:batchId`).
