# syntax=docker/dockerfile:1

# --------------------------------------------------------------- build stage --
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# -------------------------------------------------------------- runtime stage --
FROM nginx:1.29-alpine

# nginx:alpine renders every /etc/nginx/templates/*.template file with envsubst
# into NGINX_ENVSUBST_OUTPUT_DIR at container start.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/config.json.template /etc/nginx/templates/config.json.template
COPY --from=build /app/dist/cursus-frontend/browser /usr/share/nginx/html

RUN rm /usr/share/nginx/html/config.json \
    && chown -R 101:101 /usr/share/nginx/html /var/cache/nginx /var/run

ENV API_BASE_URL=http://localhost:8072 \
    KEYCLOAK_URL=http://localhost:8081 \
    KEYCLOAK_REALM=gl5 \
    KEYCLOAK_CLIENT_ID=cursus-frontend \
    NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
