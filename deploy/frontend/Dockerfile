FROM nginxinc/nginx-unprivileged:1.28-alpine
ARG RELEASE_SHA
LABEL org.opencontainers.image.source="https://github.com/JephyrWing/SyncArch"
LABEL org.opencontainers.image.revision="${RELEASE_SHA}"
USER root
COPY frontend/dist/ /usr/share/nginx/html/
COPY deploy/frontend/default.conf.template /etc/nginx/templates/default.conf.template
RUN test -f /usr/share/nginx/html/release.json \
    && chown -R 1000:1000 /etc/nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx
ENV API_UPSTREAM=http://backend:5000 NGINX_ENVSUBST_FILTER=API_UPSTREAM
USER 1000:1000
EXPOSE 8080
