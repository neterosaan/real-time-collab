# Use a lightweight, official Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for layer caching
# This prevents re-installing dependencies on every code change
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your server's source code
COPY server/ ./

# Expose the port your app will run on
EXPOSE 4000

# The command to run your application
CMD [ "npm", "start" ]