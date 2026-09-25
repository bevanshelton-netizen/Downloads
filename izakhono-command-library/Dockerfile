FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY test ./test
RUN npm run verify
ENV HOST=0.0.0.0 PORT=8788 NODE_ENV=production
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8788/healthz || exit 1
CMD ["node","src/server.mjs"]
