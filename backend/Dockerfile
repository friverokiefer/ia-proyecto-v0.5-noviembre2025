# =========================
# backend/Dockerfile
# =========================

# ---- Etapa de build ----
FROM node:20-alpine AS build
WORKDIR /app

# Instala deps de producción y dev para compilar TypeScript
COPY package*.json ./
RUN npm ci

# Copia el código fuente y compila
COPY . .
RUN npm run build

# ---- Etapa runtime (producción) ----
FROM node:20-alpine
WORKDIR /app

# Entorno básico del servidor
ENV NODE_ENV=production
ENV PORT=8080

# Mantén la ruta que tu app espera (según tu .env actual)
# No copiaremos credenciales; solo declaramos la ruta y creamos la carpeta.
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/.secrets/service-account.json

# Prepara carpeta para secretos y para assets generados
RUN mkdir -p /app/.secrets \
    && mkdir -p /app/dist/public/generated

# Instala solo deps de producción
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# Copia el build ya compilado
COPY --from=build /app/dist ./dist

EXPOSE 8080

# Importante: las credenciales se montan en runtime:
#   -v "$PWD/.secrets:/app/.secrets:ro"
CMD ["node","dist/server.js"]
