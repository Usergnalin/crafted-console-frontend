FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80