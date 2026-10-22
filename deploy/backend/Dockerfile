FROM python:3.12.6-slim-bookworm
ARG RELEASE_SHA
LABEL org.opencontainers.image.source="https://github.com/JephyrWing/SyncArch"
LABEL org.opencontainers.image.revision="${RELEASE_SHA}"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 RELEASE_SHA=${RELEASE_SHA}
WORKDIR /app/backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/wsgi.py ./wsgi.py
COPY deploy/backend/start.py ./start.py
RUN useradd --uid 1000 --create-home syncarch && chown -R 1000:1000 /app
USER 1000:1000
EXPOSE 5000
CMD ["python", "start.py"]
