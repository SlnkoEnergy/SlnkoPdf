FROM node:20-slim

# Install dependencies for Puppeteer to run Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libnss3 \
    libxss1 \
    libgtk-3-0 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /protrac/pdf

# Copy package.json and install deps
COPY package.json ./
RUN npm install

# Copy rest of the source code
COPY . .

# Puppeteer executable path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set port
ENV PORT=${PORT}
EXPOSE 8080

# Start command
CMD ["npm", "start"]
