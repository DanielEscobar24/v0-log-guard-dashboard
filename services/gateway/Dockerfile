FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm install --production

# Copy application code
COPY server.js ./

# Expose the gateway port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
