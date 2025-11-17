# =========================
# frontend/Dockerfile
# Build: Vite + React
# Run: Nginx sirviendo /dist como SPA
# =========================

########## Etapa 1: Build con Node ##########
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# (Opcional) variables de entorno de build para Vite
# Se pueden inyectar con:
# docker build \
#   --build-arg VITE_API_BASE=https://mi-backend \
#   --build-arg VITE_GCS_BUCKET=mi-bucket \
#   --build-arg VITE_GCS_PREFIX=dev \
#   --build-arg VITE_SFMC_CATEGORY_ID=123456 \
#   -t email-studio-frontend .
ARG VITE_API_BASE
ARG VITE_GCS_BUCKET
ARG VITE_GCS_PREFIX
ARG VITE_SFMC_CATEGORY_ID

ENV VITE_API_BASE=${VITE_API_BASE} \
    VITE_GCS_BUCKET=${VITE_GCS_BUCKET} \
    VITE_GCS_PREFIX=${VITE_GCS_PREFIX} \
    VITE_SFMC_CATEGORY_ID=${VITE_SFMC_CATEGORY_ID}

# Build de producción (Vite genera /dist)
RUN npm run build

########## Etapa 2: Runtime con Nginx ##########
FROM nginx:stable-alpine

# Copia el build estático
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./ 

# Copia la config de Nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
