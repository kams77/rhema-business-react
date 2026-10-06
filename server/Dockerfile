# Image « serveur » : application compilée en mode serveur + API Node.js.
# Utilisée par docker-compose.yml (Synology Container Manager).

# 1) Compilation de l'application (mode serveur, sans démo)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV VITE_BACKEND=api VITE_DEMO_MODE=false
RUN npm run build

# 2) Image finale légère : Node.js + mysql2 + fichiers compilés
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 TZ=Africa/Kinshasa
WORKDIR /app
RUN apk add --no-cache tzdata \
 && npm init -y >/dev/null \
 && npm install mysql2@3 --no-audit --no-fund \
 && npm cache clean --force
COPY server/*.mjs ./server/
COPY shared/*.mjs ./shared/
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
