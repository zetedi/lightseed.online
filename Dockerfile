# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
# default config mounted at runtime; fallback to baked config.json inside image if present
# you can mount a custom config.json: -v $(pwd)/public/config.main.json:/usr/share/nginx/html/config.json:ro
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]