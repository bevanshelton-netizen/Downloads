FROM python:3.12-slim
WORKDIR /app
COPY app.py portfolio.json ./
RUN useradd --system --uid 10001 --create-home watch && mkdir -p /app/data && chown -R watch:watch /app
USER watch
ENV IZA_WATCH_HOST=0.0.0.0
ENV IZA_WATCH_PORT=8860
ENV IZA_WATCH_DB=/app/data/portfolio-watch.db
EXPOSE 8860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8860/health', timeout=3).read()"
CMD ["python3","app.py"]
