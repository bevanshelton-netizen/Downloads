FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .

# These are explicit non-secret Alpha build sentinels. Production credentials are never baked into the image.
# Repository-level release/money/migration policy remains in KORA CI; this container gate proves the deployable app.
RUN export NEXT_PUBLIC_APP_NAME=KORA \
    NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
    NEXT_PUBLIC_SUPABASE_URL=https://alpha-placeholder.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=alpha-placeholder-anon-key \
    SUPABASE_SERVICE_ROLE_KEY=alpha-placeholder-service-role-key \
    VIDEO_PROVIDER=mock \
    PAYFAST_MERCHANT_ID=10000100 \
    PAYFAST_MERCHANT_KEY=alpha-placeholder-merchant-key \
    PAYFAST_PASSPHRASE=alpha-placeholder-passphrase \
    PAYFAST_SANDBOX=true \
    KORA_TICKET_CHECKOUT_MODE=off \
    KORA_TICKET_LIVE_APPROVED=false \
    KORA_INTERNAL_API_SECRET=alpha-placeholder-internal-secret-long-enough-for-build \
 && npm run typecheck \
 && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
