FROM node:18-alpine AS node

WORKDIR /app

COPY . .

RUN npm i

EXPOSE 8080

ENTRYPOINT ["npm", "start"]