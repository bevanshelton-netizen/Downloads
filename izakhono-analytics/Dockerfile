FROM python:3.13-alpine
WORKDIR /app
COPY server.py /app/server.py
RUN mkdir -p /data && adduser -D -u 10001 analytics && chown -R analytics:analytics /app /data
USER analytics
ENV ANALYTICS_PORT=8080
ENV ANALYTICS_DB_PATH=/data/analytics.db
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=5 CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["python3","/app/server.py"]
