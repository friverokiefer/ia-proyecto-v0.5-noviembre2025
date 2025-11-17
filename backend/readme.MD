# Email Studio – Backend (Emails v2)

Backend Node/Express para el módulo **Email 2.0** de “Email Studio”.Su responsabilidad principal es:

- Orquestar la generación de **sets de contenido de email** (subject, preheader, body, CTA) usando un **IA Engine externo** (servicio Python).
- Generar y normalizar **imágenes hero** vía OpenAI (modo cover, 16:9).
- Persistir todo el batch (JSON + imágenes) en **Google Cloud Storage** bajo `emails_v2/{batchId}/`.
- Exponer endpoints para:
  - Generar nuevos batches (`/api/generate-emails-v2`)
  - Editar el contenido (`/api/emails-v2/:batchId`)
  - Exponer catálogo de campañas / clusters (`/api/email-v2/meta`)
  - Listar histórico de batches (`/api/history`)
  - Crear **borradores de email en Salesforce Marketing Cloud** (`/api/sfmc/draft-email`)

Este backend está diseñado para convivir con:

- Un **frontend React/Vite** (`frontend/` en el mono-repo).
- Un **IA Engine Python (FastAPI)** en `ia-engine/`.

---

## Tech stack

- **Node.js** 20 (runtime)
- **TypeScript** (fuente en `src/`, build en `dist/`)
- **Express** como framework HTTP
- **Google Cloud Storage** (`@google-cloud/storage`) para persistencia de assets y JSON
- **OpenAI** para generación de imágenes (y eventualmente textos fallback)
- **Salesforce Marketing Cloud** (API REST) para creación de assets y borradores de email
- **IA Engine externo** (FastAPI en Python) para la generación de texto controlada y centralizada

---

## Estructura de carpetas (backend)

```text
backend/
├── Dockerfile              # Imagen de backend para Cloud Run / contenedores
├── package.json            # Scripts y dependencias
├── tsconfig.json
├── readme.MD               # Este archivo
├── src
│   ├── server.ts           # Punto de entrada del backend (Express)
│   ├── routes              # Definición de rutas HTTP
│   │   ├── emailV2Meta.ts  # GET /api/email-v2/meta (catálogo campañas/clusters)
│   │   ├── metaEmailV2.ts  # GET /api/emails-v2/meta (alias plural)
│   │   ├── generateEmailV2.ts
│   │   │   - POST /api/generate-emails-v2
│   │   │   - PUT  /api/emails-v2/:batchId
│   │   ├── history.ts      # GET /api/history?type=emails_v2
│   │   ├── generated.ts    # /api/generated + /generated (redirect/JSON GCS)
│   │   └── sfmc.ts         # POST /api/sfmc/draft-email
│   ├── services
│   │   ├── gcpStorage.ts   # Helpers para firmar URLs y subir JSON/archivos a GCS
│   │   ├── image.ts        # Generación de hero images vía OpenAI
│   │   ├── openai.ts       # Cliente OpenAI (textos/imágenes)
│   │   ├── iaEngine.ts     # Cliente para IA Engine (/ia/generate)
│   │   ├── emailTemplate.ts# Render HTML email 2.0 (para SFMC y previews)
│   │   ├── promptKit.ts    # Prompts y helpers para textos (legacy/minimal)
│   │   ├── textGen.ts      # Generación de texto legacy/local (fallback)
│   │   └── sfmc.service.ts # Integración con Salesforce Marketing Cloud
│   ├── lib
│   │   ├── ia-engine.client.ts       # Cliente HTTP para IA Engine (textos)
│   │   ├── ia-engine.meta.client.ts  # Cliente + caché para /ia/meta
│   │   └── ia-engine.schema.ts       # Tipos y validaciones relacionadas
│   └── utils
│       ├── constants.ts    # Catálogos legacy (CAMPAIGNS, CLUSTERS)
│       └── validate.ts     # Validaciones de campaña/cluster
├── dist                    # Build compilado (no editar a mano)
│   └── ...
├── test
│   ├── iaEngine.test.ts    # Test de integración contra IA Engine (versión nueva)
│   └── iaEngine.ts         # Test de integración legacy contra IA Engine
├── test-gcp.ts             # Script para validar conexión a GCP (Storage)
└── tmp/generated           # Carpeta temporal para imágenes en local
```

Configuración de entorno (.env)

OPENAI_API_KEY=OPENAI_TEXT_JSON=gpt-4o
OPENAI_TEXT_LITE=gpt-4o-mini
OPENAI_TEXT_QUALITY=gpt-4o
OPENAI_IMAGE=gpt-image-1
PROMPT_BLOG_VERSION=v1=== GOOGLE CLOUD ===GCP_PROJECT_ID=
GCP_BUCKET_NAME=
GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json
GCP_PUBLIC_READ=true
GCP_PREFIX=GENERATED_BASE_PATH=./backend/dist/public/generated

## Endpoints principales

### 1. Catálogo campañas / clusters

**GET `/api/email-v2/meta`**

(Frontend usa este endpoint)

Devuelve:

{
"campaigns": ["Crédito de consumo - Persona", "..."],
"clusters": ["Viajes solteros", "..."],
"campaignClusters": {
"Crédito de consumo - Persona": ["Viajes solteros", "Proyectos personales"],
"Hipotecario": ["Compra primera vivienda", "Refinanciamiento"]
}
}

### 2. Generar Email 2.0

**POST `/api/generate-emails-v2`**

Body esperado:

{
"campaign": "Crédito de consumo - Persona",
"cluster": "Viajes solteros",
"sets": 3,
"images": 2,
"feedback": {
"subject": "algo más juvenil",
"preheader": "que complemente el asunto",
"bodyContent": "menciona cuotas flexibles y proceso 100% online"
}
}

Flujo interno (`generateEmailV2.ts`):

1. **Valida** `campaign` y `cluster`.
2. Genera `batchId` y carpeta temporal `tmp/generated/{batchId}`.
3. Genera `images` imágenes hero:
   - Llama a `generateHeroPNG` (OpenAI) con modo `cover 16:9`.
   - Guarda los JPG/PNG localmente.
   - Sube cada imagen a GCS → `emails_v2/{batchId}/{fileName}`.
   - Construye `heroUrl` directa (`https://storage.googleapis.com/...`).
4. Llama al **IA Engine** (`/ia/generate`) para obtener los **sets de contenido** :
   - Pasa `campaign`, `cluster`, `trioCount = sets`.
   - Inyecta la URL de la primera imagen como contexto.
5. Normaliza y sanitiza los textos:
   - Anti-spam básico (remueve emojis y ciertas palabras).
   - Clamps de largo para subject / preheader.
   - Títulos y subtítulos con sentence-case.
6. Construye y sube a GCS:
   - `emails_v2/{batchId}/batch.json`
   - `emails_v2/{batchId}/_manifest.json`
7. Responde al cliente:

{
"batchId": "2025-11-15_152233",
"createdAt": "2025-11-15T18:22:33.123Z",
"bucketRoot": "gs://.../emails_v2/2025-11-15_152233/",
"jsonUrl": "https://console.cloud.google.com/.../batch.json",
"manifestUrl": "https://console.cloud.google.com/.../_manifest.json",
"sets": [ /_ EmailContentSet[] _/ ],
"images": [ /_ EmailV2Image[] _/ ]
}

### 3. Guardar ediciones

**PUT `/api/emails-v2/:batchId`**

Body:

{
"sets": [ /_ EmailContentSet[] _/ ]
}

Flujo:

1. Sanitiza los sets con `sanitizeContentSets`.
2. Intenta leer `emails_v2/{batchId}/batch.json` de GCS.
3. Si no existe:
   - Intenta reconstruir desde `_manifest.json` (rehidrata imágenes).
   - Si tampoco puede leer manifest → devuelve `409` para evitar perder imágenes.
4. Sobrescribe `sets` y añade `updatedAt`.
5. Sube el nuevo `batch.json` a GCS.

Respuesta:

{
"ok": true,
"batchId": "2025-11-15_152233",
"setCount": 3,
"imageCount": 2,
"updatedAt": "2025-11-15T18:31:10.000Z"
}

### 4. Historial

**GET `/api/history?type=emails_v2`**

Devuelve una lista simplificada de batches:

[
{ "batchId": "2025-11-15_152233", "count": 3, "createdAt": "..." },
{ "batchId": "2025-11-14_200101", "count": 2, "createdAt": "..." }
]

### 5. SFMC – Borrador de Email

**POST `/api/sfmc/draft-email`**

Payload (simplificado):

{
"categoryId": 339292,
"image": {
"name": "hero_email_2025-11-15_152233_12345678.jpg",
"extension": "jpg",
"gcsUrl": "https://storage.googleapis.com/..."
},
"email": {
"name": "email_2025-11-15_152233_1731700000000",
"subject": "Asunto limpio",
"preheader": "Preheader limpio",
"htmlTemplate": "`<html>`... {{IMAGE_URL}} ...`</html>`"
},
"batch": {
"id": "2025-11-15_152233",
"meta": {
"setIndex": 0,
"setId": 1
}
},
"dryRun": false
}

El servicio:

1. Sube la imagen a SFMC como **asset de Content Builder** .
2. Reemplaza `{{IMAGE_URL}}` con la `publishedURL` del asset.
3. Crea un borrador de email en SFMC (ID + CustomerKey).
4. Opcionalmente persiste metadatos en el JSON o en algún log.

Respuesta típica:

{
"ok": true,
"result": {
"step": {
"uploadImage": { "id": 1234, "publishedURL": "https://image.s10.sfmc-content.com/..." },
"createEmailDraft": { "id": 5678, "customerKey": "EMAIL*2025_11_15*..." },
"persisted": true
}
}
}
