FROM node:20-alpine

WORKDIR /app

# Instala o nodemon globalmente para live-reload
RUN npm install -g nodemon

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["nodemon", "src/server.js"]
