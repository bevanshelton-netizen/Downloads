FROM node:22-alpine
WORKDIR /app
COPY server.mjs /app/server.mjs
COPY public /app/public
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","/app/server.mjs"]
