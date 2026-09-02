FROM python:3.13-alpine

WORKDIR /app
COPY . /app
RUN addgroup -S doxa && adduser -S -G doxa doxa \
    && mkdir -p /var/lib/doxa-sure \
    && chown -R doxa:doxa /var/lib/doxa-sure /app

USER doxa
ENV DOXA_HOST=0.0.0.0 DOXA_PORT=8080 DOXA_DATA_DIR=/var/lib/doxa-sure
EXPOSE 8080
VOLUME ["/var/lib/doxa-sure"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

CMD ["python3", "owner_service.py"]
