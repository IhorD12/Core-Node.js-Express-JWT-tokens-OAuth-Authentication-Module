# Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies first, including devDependencies if nodemon is used for dev
# For production, a multi-stage build would be better to prune devDependencies
RUN npm install

COPY . .

USER node

EXPOSE 3000

# Default command, can be overridden by docker-compose
# This will run `node src/server.js` via npm start
CMD [ "npm", "start" ]
