FROM python:3.12-slim
WORKDIR /app
COPY app.py /app/app.py
COPY static /app/static
RUN mkdir -p /app/data && useradd -r -u 10001 izakhono && chown -R izakhono:izakhono /app
USER izakhono
ENV IZA_AUTOMATIONS_HOST=0.0.0.0 IZA_AUTOMATIONS_PORT=8787 IZA_AUTOMATIONS_DB=/app/data/automations.db IZA_AUTOMATIONS_TZ=Africa/Johannesburg
VOLUME ["/app/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=3)"
CMD ["python3","/app/app.py"]
