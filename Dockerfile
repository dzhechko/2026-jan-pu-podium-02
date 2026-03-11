# ============================================
# Stage: Base
# ============================================
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# ============================================
# Stage: Dependencies
# ============================================
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/api/package.json ./packages/api/
COPY packages/admin/package.json ./packages/admin/
COPY packages/pwa/package.json ./packages/pwa/
RUN npm ci

# ============================================
# Stage: API Build
# ============================================
FROM deps AS api-build
COPY packages/api/ ./packages/api/
RUN cd packages/api && npx prisma generate && npm run build

# ============================================
# Stage: Admin Build
# ============================================
FROM deps AS admin-build
COPY packages/admin/ ./packages/admin/
RUN cd packages/admin && npm run build

# ============================================
# Stage: PWA Build
# ============================================
FROM deps AS pwa-build
COPY packages/pwa/ ./packages/pwa/
RUN cd packages/pwa && npm run build

# ============================================
# Stage: API Runtime
# ============================================
FROM base AS api
COPY --from=api-build /app/packages/api/dist ./dist
COPY --from=api-build /app/packages/api/prisma ./prisma
COPY --from=api-build /app/packages/api/node_modules ./node_modules
COPY --from=api-build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "dist/app.js"]

# ============================================
# Stage: Admin (Nginx serving static)
# ============================================
FROM nginx:alpine AS admin
COPY --from=admin-build /app/packages/admin/dist /usr/share/nginx/html
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# ============================================
# Stage: PWA (Nginx serving static)
# ============================================
FROM nginx:alpine AS pwa
COPY --from=pwa-build /app/packages/pwa/dist /usr/share/nginx/html
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
