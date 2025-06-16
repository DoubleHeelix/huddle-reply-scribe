# Stage 1: Build the application
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Build the application
# Set build-time arguments
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Build the application
RUN bun run build

# Stage 2: Serve the application
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Expose port 80 and start nginx
EXPOSE 80
HEALTHCHECK --interval=5s --timeout=5s --retries=3 CMD curl --fail http://localhost:80 || exit 1
CMD ["nginx", "-g", "daemon off;"]
