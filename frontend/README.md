# Email Studio – Frontend (React + Vite)

Frontend de Email Studio para BICE, construido con:

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui (botones, cards, dialogs)
- Lucide Icons

El objetivo es:

- Generar **sets de contenido de email** (subject + preheader + body).
- Gestionar **imágenes** generadas por la IA (GCS).
- Enviar un set + imagen seleccionados a **Salesforce Marketing Cloud (SFMC)** como borrador de email.

---

## 1. Requisitos

- Node.js **>= 20**
- npm (incluido con Node)
- Backend levantado (Node/Express) en `localhost:8080` para desarrollo, o bien `VITE_API_BASE` apuntando a un backend accesible.

---

## 2. Variables de entorno (frontend)

El frontend usa variables `VITE_...` (por estándar de Vite).
Puedes definirlas en un archivo `.env.local` en la raíz del frontend:

```env



# URL base del backend (solo necesaria en prod; en dev usamos el proxy de Vite)
# VITE_API_BASE=https://mi-backend.run.app

# Bucket de GCS donde están los batch de emails_v2
VITE_GCS_BUCKET=mi-bucket-gcs

# Prefijo dentro del bucket (por defecto "dev")
VITE_GCS_PREFIX=dev

# Categoría por defecto para SFMC (folder/categoryId donde se crean los borradores)
# Si no se define, el frontend usa un fallback interno (339292)
VITE_SFMC_CATEGORY_ID=339292
```

Notas:

- En **desarrollo** normalmente basta con:
  - Dejar el backend en `http://localhost:8080`
  - NO setear `VITE_API_BASE` (el proxy de Vite se encarga de `/api`).
- En **producción / Docker** :
  - Lo usual es compilar el frontend con `VITE_API_BASE` apuntando a tu backend público (Cloud Run, etc.).

---

## 3. Correr en local (modo desarrollo)

1. Instalar dependencias:

npm install

- Asegúrate de tener el backend levantado en `http://localhost:8080`.
- Levantar el frontend:

  npm run dev

Abrir en el navegador:

http://localhost:5173

En este modo:

- Vite sirve el frontend en `5173`.
- Las llamadas a `/api/...` se proxyean a `http://localhost:8080` (según `vite.config.ts`).

---

## 4. Build de producción (sin Docker)

Para generar el build estático:

npm run build

dist/

npm run preview

## 5. Docker: build y run con Nginx

El `Dockerfile` está preparado para:

1. Etapa de build (Node 20 + Vite)
2. Etapa de runtime (Nginx sirviendo el contenido de `dist/` como SPA)

### 5.1. Build básico

Desde la carpeta `frontend`:

docker build -t email-studio-frontend .

Esto:

- Instala dependencias (`npm ci`)
- Ejecuta `npm run build`
- Copia `/dist` dentro de una imagen Nginx

### 5.2. Build con variables de entorno de build

Si quieres fijar `VITE_API_BASE` y otros valores en el build:<

docker build
--build-arg VITE_API_BASE=https://mi-backend-publico.run.app
--build-arg VITE_GCS_BUCKET=mi-bucket-gcs
--build-arg VITE_GCS_PREFIX=dev
--build-arg VITE_SFMC_CATEGORY_ID=339292
-t email-studio-frontend .

### 5.3. Run

Levantar el contenedor:

docker run --rm -p 8080:8080 email-studio-frontend

Luego abrir:

http://localhost:8080

Notas importantes:

- El contenedor sirve solo el **frontend estático** .
- Las llamadas a `/api`:
  - Si el código fue compilado con `VITE_API_BASE`, apuntarán directamente a esa URL (no pasan por Nginx).
  - Si vas a usar proxy de Nginx a un backend Docker, debes:
    - Ajustar y descomentar el bloque `location /api/` en `nginx.conf`.
    - Asegurarte de que el nombre del servicio (`backend`) y puerto estén bien configurados en tu `docker-compose.yml`.

frontend/
├── Dockerfile
├── README.md
├── components.json
├── docs/
│ └── App.md
├── eslint.config.js
├── index.html
├── nginx.conf
├── package.json
├── postcss.config.js
├── public/
│ ├── favicon.png
│ ├── salesforce.png
│ ├── salesforce2.png
│ └── vite.svg
├── src/
│ ├── App.tsx
│ ├── assets/
│ ├── components/
│ │ ├── Email2Sidebar.tsx
│ │ ├── Email2Workspace.tsx
│ │ ├── EmailPreview.tsx
│ │ ├── Field.tsx
│ │ ├── HeaderPreviewBar.tsx
│ │ ├── InLineProgress.tsx
│ │ ├── LoadingStepper.tsx
│ │ ├── NumberStepper.tsx
│ │ ├── Sidebar.tsx
│ │ └── ui/
│ │ ├── ConfirmGenerateModal.tsx
│ │ ├── ConfirmSendModal.tsx
│ │ ├── button.tsx
│ │ ├── card.tsx
│ │ ├── dialog.tsx
│ │ ├── input.tsx
│ │ ├── label.tsx
│ │ ├── select.tsx
│ │ └── textarea.tsx
│ ├── lib/
│ │ ├── api.ts
│ │ ├── apiEmailV2.ts
│ │ ├── history.ts
│ │ ├── schemas.ts
│ │ ├── storage.ts
│ │ └── utils.ts
│ ├── main.tsx
│ └── styles/
│ └── index.css
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
