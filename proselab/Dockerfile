FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build-time variables for Vite
ARG VITE_OLLAMA_MODEL
ARG VITE_OPENAI_KEY
ARG VITE_GEMINI_KEY
ENV VITE_OLLAMA_MODEL=$VITE_OLLAMA_MODEL
ENV VITE_OPENAI_KEY=$VITE_OPENAI_KEY
ENV VITE_GEMINI_KEY=$VITE_GEMINI_KEY

RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
