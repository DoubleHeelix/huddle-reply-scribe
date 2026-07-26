# Stage 1: Build the application
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the application
# Set build-time arguments
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Refuse to ship a bundle that fails tests, lint, or TypeScript.
RUN npm run test && npm run lint && npm run typecheck && npm run build

# Stage 2: Serve the application
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Expose port 80 and start nginx
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
