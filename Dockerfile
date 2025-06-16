# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
# Cache buster: 16/06/2025, 1:51:52 pm
RUN echo "Starting build at $(date)" && npm run build && echo "Finished build at $(date)"

# Stage 2: Serve the application
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 and start nginx
EXPOSE 80
HEALTHCHECK --interval=5s --timeout=5s --retries=3 CMD curl --fail http://localhost:80 || exit 1
CMD ["nginx", "-g", "daemon off;"]