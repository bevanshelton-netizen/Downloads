FROM node:22-bookworm-slim
WORKDIR /app
COPY owned/package.json ./owned/package.json
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && cd owned && npm install --omit=dev \
 && apt-get purge -y make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
COPY . .
ENV NODE_ENV=production APP_ENV=production HOST=0.0.0.0 PORT=18081 VIDEONOMY_DATA_DIR=/data
EXPOSE 18081
VOLUME ["/data"]
CMD ["./owned/node_modules/.bin/tsx","owned/server.mjs"]
