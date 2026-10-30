FROM node:24

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

COPY prisma ./prisma

# Install dependencies
RUN npm i

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]