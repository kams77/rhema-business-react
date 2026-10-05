# Image de production : compile l'application puis la sert avec Nginx.
#   docker build -t rhema-business .
#   docker run -d -p 8080:80 --name rhema rhema-business
# Mode démo : ajoutez --build-arg VITE_DEMO_MODE=true au build.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
