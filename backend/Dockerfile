FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY backend ./backend
RUN cd backend && npm run build

COPY frontend/dist ./frontend/dist

ENV DATA_DIR=/app/data
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
