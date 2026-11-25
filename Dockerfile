# DataEntry_MIS backend
# Build:  docker build -t dataentry_mis .
# Run:    docker run -d -p 5025:5025 --env-file .env --name dataentry_mis dataentry_mis

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so this layer is cached until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source (.env, node_modules, .git etc. are excluded by .dockerignore).
COPY --chown=node:node . .

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 5025

# Database settings (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) are passed
# at runtime with --env-file or -e; they are never baked into the image.
CMD ["node", "index.js"]
