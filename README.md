# email-gcp-sfmc-v2-octubre2025

# 📧 Email Studio – GCP + SFMC (v2 Octubre 2025)

Aplicación **full-stack** (React + Node.js + OpenAI + GCP) para generar, editar y administrar contenidos de marketing automatizados — como emails, blogs, anuncios o creatividades — con almacenamiento en Google Cloud y compatibilidad con Salesforce Marketing Cloud (SFMC).

---

## 🧭 Flujo de trabajo Git (GitFlow-lite)

- `main` → rama siempre desplegable a Producción (Cloud Run/CDN). Solo recibe merges desde `release/*` o `hotfix/*`.
- `develop` → integración continua para Staging. Toda rama de trabajo parte desde aquí y vuelve mediante PR.
- `feature/*` → una rama por tarea o bug planificado. Se crea desde `develop` (`git switch develop && git switch -c feature/nombre-tarea`), se desarrolla y se abre PR contra `develop`.
- `release/*` → rama temporal para estabilizar una versión candidata. Se crea desde `develop` al congelar el alcance, se corrigen issues menores y se mergea a `main`. Luego se back-mergea a `develop`.
- `hotfix/*` → uso excepcional para arreglos críticos directamente sobre `main`. Tras publicar, se back-mergea a `main` y `develop`.

### Convenciones básicas

1. Mantén `main` protegido (PR + CI) y sincronizado con producción.
2. `develop` acumula el trabajo listo para QA; actualízalo frecuentemente desde `main` tras cada release u hotfix.
3. Prefija las ramas con el tipo y un identificador (`feature/email-preview-redesign`, `hotfix/fix-download-null`).
4. Cada PR debe revisarse y aprobarse antes de mergear; considera `squash` para mantener histórico claro.
5. Cuando un release esté listo, mergea `release/x.y.z` → `main`, etiqueta la versión y luego `main` → `develop`.

---

## 🧠 Visión General

**Email Studio** permite a equipos de marketing generar contenidos de alta calidad utilizando IA (texto + imágenes), guardarlos de manera estructurada y desplegarlos automáticamente.

El proyecto está dividido en dos módulos principales:

- **Frontend (React + Vite + TypeScript)** → interfaz de usuario donde se generan y editan los contenidos.
- **Backend (Node.js + Express + TypeScript)** → motor que coordina las llamadas a los modelos de IA (OpenAI), gestiona imágenes, sube resultados a Google Cloud y expone endpoints RESTful.

---

## 🧩 Arquitectura General

Frontend (React)

│

│─── UI/UX Components (Sidebar, Workspace, Fields, Progress, etc.)

│

▼

API Calls → Backend Express Server (Node.js)

│

│─── Routes: /generateEmailV2, /uploadToGCP, /history, /export

│─── Services: OpenAI (text + image), GCP Storage

│─── Utils: Validación y constantes

│

▼

Google Cloud Platform

│─── Cloud Run (backend desplegado)

│─── Cloud Storage (archivos generados e imágenes)

│─── BigQuery (historial y analítica, opcional)

---

## ⚙️ Backend

**Ruta:** `/backend`

### 🧱 Stack

- Node.js + Express + TypeScript
- OpenAI SDK
- Sharp (procesamiento de imágenes)
- Google Cloud SDK (`@google-cloud/storage`)

### 📂 Estructura de carpetas

---

backend/

├── Dockerfile # Imagen para Cloud Run

├── package.json # Dependencias y scripts

├── src/

│ ├── routes/ # Endpoints de la API

│ │ ├── generateEmailV2.ts # Generación de emails con IA

│ │ ├── uploadToGCP.ts # Subida a Cloud Storage

│ │ ├── history.ts # Historial de generados

│ │ └── export.ts # Exportación de resultados

│ ├── services/ # Lógica de negocio

│ │ ├── openai.ts # Config y manejo de modelos OpenAI

│ │ ├── image.ts # Normalización y generación de imágenes

│ │ ├── textGen.ts # Generación textual (fallback / JSON)

│ │ ├── gcpStorage.ts # Carga y descarga desde GCS

│ │ ├── promptKit.ts # Construcción dinámica de prompts

│ │ └── emailTemplate.ts # Plantillas base HTML/JSON

│ ├── utils/ # Utilidades

│ │ ├── constants.ts # Constantes globales

│ │ └── validate.ts # Validaciones (cluster, campaign, etc.)

│ ├── public/ # Archivos estáticos

│ └── server.ts # App Express principal

└── test-gcp.ts # Script de prueba de conexión a GCP

### 🧩 Principales endpoints

| Ruta               | Método | Descripción                                                                            |
| ------------------ | ------ | -------------------------------------------------------------------------------------- |
| `/generateEmailV2` | POST   | Genera texto e imagen del email a partir de campos (campaign, cluster, feedback, etc.) |
| `/uploadToGCP`     | POST   | Sube los resultados a un bucket de Google Cloud Storage                                |
| `/history`         | GET    | Devuelve historial de contenidos generados                                             |
| `/export`          | GET    | Descarga los resultados (JSON o CSV)                                                   |

---

## 💻 Frontend

**Ruta:** `/frontend`

### 🧱 Stack

- React + Vite + TypeScript
- TailwindCSS + shadcn/ui + lucide-react
- Zod (validación de inputs)

### 📂 Estructura principal

frontend/

├── src/

│ ├── components/

│ │ ├── Sidebar.tsx # Navegación principal

│ │ ├── Email2Workspace.tsx # Zona principal de trabajo

│ │ ├── Field.tsx # Campos controlados

│ │ ├── LoadingStepper.tsx # Indicador de carga por pasos

│ │ ├── HeaderPreviewBar.tsx # Previsualización del contenido

│ │ ├── InLineProgress.tsx # Barra de progreso durante la generación

│ │ ├── ui/ # Componentes reutilizables (Button, Card, Input, etc.)

│ ├── lib/

│ │ ├── api.ts # Config global de API

│ │ ├── apiEmailV2.ts # Llamadas específicas al backend

│ │ ├── history.ts # Gestión de historial local

│ │ ├── storage.ts # Manejador de archivos

│ │ ├── utils.ts, validators.ts # Helpers

│ ├── App.tsx # Estructura principal

│ ├── main.tsx # Punto de entrada de la app

│ └── styles/index.css # Estilos globales

---

## 🔗 Conexión Front ↔ Backend

- El **frontend** se comunica con el backend mediante `fetch` o `axios` configurado en `src/lib/apiEmailV2.ts`.
- Las URLs base pueden definirse en un `.env` (ejemplo en `/backend/.env.example`):

```bash
VITE_API_BASE_URL=https://email-studio-backend-xxxxxx-uc.a.run.app
---


* Cuando el usuario hace clic en “Generar”, se construye un **prompt dinámico** y se envía al endpoint `/generateEmailV2`.
* El backend genera el contenido (texto + imagen), lo guarda en `/backend/src/public/generated/`, y lo sube a Cloud Storage.

## ☁️ Despliegue en Google Cloud

El despliegue se realiza mediante **Cloud Build + Cloud Run** usando el archivo `cloudbuild.yaml`:







steps:

- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/$PROJECT_ID/email-studio-backend', './backend']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/$PROJECT_ID/email-studio-backend']
- name: 'gcr.io/cloud-builders/gcloud'
  args: [
  'run','deploy','email-studio-backend',
  '--image','gcr.io/$PROJECT_ID/email-studio-backend',
  '--platform','managed',
  '--region','us-central1',
  '--allow-unauthenticated',
  '--port','8080'
  ]

## 🚀 Scripts útiles

### Backend

cd backend
npm install
npm run dev       # Desarrollar localmente
npm run build     # Compilar TypeScript
npm start         # Ejecutar versión compilada

**Frontend**
cd frontend
npm install
npm run dev       # Modo desarrollo (Vite)
npm run build     # Compilar para producción
npm run preview   # Previsualizar build





## 📊 Futuras Extensiones

* Integración con **SFMC API** para crear borradores de emails automáticos.
* Análisis en **BigQuery** de performance y uso de prompts.
* Editor visual con variantes A/B y feedback basado en engagement.
```
