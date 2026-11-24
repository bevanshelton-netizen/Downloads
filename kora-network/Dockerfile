FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .

# NEXT_PUBLIC_* values are compiled into the Next.js client bundle. They must
# therefore be supplied as build args, not only as container runtime variables.
# All defaults below are non-secret placeholders for CI/package validation.
ARG NEXT_PUBLIC_APP_NAME=KORA
ARG NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
ARG NEXT_PUBLIC_SUPABASE_URL=https://alpha-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=alpha-placeholder-anon-key
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_KORA_DB_SCHEMA=kora
ARG VIDEO_PROVIDER=mock

# Build-time sentinels are intentionally non-secret. Production service-role,
# payment, Stream and internal API credentials are injected only at runtime.
RUN export NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME}" \
    NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}" \
    NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}}" \
    NEXT_PUBLIC_KORA_DB_SCHEMA="${NEXT_PUBLIC_KORA_DB_SCHEMA}" \
    SUPABASE_SERVICE_ROLE_KEY=alpha-placeholder-service-role-key \
    VIDEO_PROVIDER="${VIDEO_PROVIDER}" \
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
