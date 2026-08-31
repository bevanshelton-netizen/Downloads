FROM python:3.12-alpine
WORKDIR /app
COPY server.py /app/server.py
EXPOSE 8080
USER 65532:65532
CMD ["python", "/app/server.py"]
