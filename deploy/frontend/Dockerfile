FROM node:24.22.0-bookworm-slim AS builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
ARG RELEASE_SHA
LABEL org.opencontainers.image.source="https://github.com/JephyrWing/SyncArch"
LABEL org.opencontainers.image.revision="${RELEASE_SHA}"
USER root
COPY --from=builder /app/frontend/dist/ /usr/share/nginx/html/
COPY deploy/frontend/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 deploy/frontend/40-release.sh /docker-entrypoint.d/40-release.sh
RUN chown -R 1000:1000 /etc/nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx
ENV API_UPSTREAM=http://syncarch-api:5000 NGINX_ENVSUBST_FILTER=API_UPSTREAM RELEASE_SHA=${RELEASE_SHA}
USER 1000:1000
EXPOSE 8080
