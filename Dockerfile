# syntax=docker/dockerfile:1

# 정적 산출물(dist)을 Docker 안에서 빌드한다. 호스팅은 S3 이므로 런타임 이미지는 없다.
#   docker buildx build --target dist --output type=local,dest=out --build-arg VITE_API_BASE_URL=... .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm test && npm run build

FROM scratch AS dist
COPY --from=build /app/dist /
