FROM node:18-alpine

WORKDIR /app/stream-overlay

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 8090
CMD [ "npm", "start" ]