# Stage 1a: Build Angular SPA
FROM --platform=$BUILDPLATFORM node:22-alpine AS angular-builder
WORKDIR /build
COPY web-app/package.json web-app/package-lock.json ./
RUN npm ci
COPY web-app/ ./
RUN npx ng build --base-href="/app/"

# Stage 1b: Build Kotlin server
FROM --platform=$BUILDPLATFORM amazoncorretto:25 AS builder
RUN yum install -y findutils && yum clean all
WORKDIR /build
COPY gradlew gradlew.bat ./
COPY gradle/ gradle/
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
# Toolkit libraries (composite build)
COPY ../h2-kotlin-toolkit /deps/h2-kotlin-toolkit
COPY ../auth-kotlin-toolkit /deps/auth-kotlin-toolkit
RUN chmod +x gradlew && ./gradlew --no-daemon --version
COPY src/ src/
RUN ./gradlew --no-daemon --max-workers=2 installDist

# Stage 2: Runtime
FROM amazoncorretto:25-alpine
RUN apk add --no-cache curl
RUN addgroup -g 100 -S users 2>/dev/null; adduser -u 1046 -G users -S app
WORKDIR /app
COPY --from=builder --chown=app:users /build/build/install/trainer/ ./
COPY --from=angular-builder --chown=app:users /build/dist/web-app/browser/ ./spa/
RUN mkdir -p /cache && chown app:users /cache && ln -s /cache /app/data
USER app
EXPOSE 9090
CMD ["./bin/trainer", "--listen_on_all_interfaces"]
