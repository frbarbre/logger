# Use Node.js 22 as the base image
FROM node:22-alpine

# Install Docker CLI and curl
RUN apk add --no-cache docker-cli curl

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript
RUN npm run build

# Expose the port your app runs on
EXPOSE 8000

# Start the application from the compiled JavaScript in dist
CMD [ "npm", "run", "start" ]