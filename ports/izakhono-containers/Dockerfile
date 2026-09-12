FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz.txt || exit 1
