FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["node", "dist/main"]
