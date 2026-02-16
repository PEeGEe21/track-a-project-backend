FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 5000

CMD ["sh", "-c", "npm run migration:run:prod && node dist/main"]
