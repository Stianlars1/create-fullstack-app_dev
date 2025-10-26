# OPUS Solution

# Backend Dockerfile
FROM gradle:8-jdk21-alpine AS build
WORKDIR /app

# Copy gradle files
COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
COPY gradlew ./

# Download dependencies
RUN ./gradlew dependencies --no-daemon

# Copy source code
COPY src ./src

# Build application
RUN ./gradlew build --no-daemon -x test

# Runtime stage
FROM openjdk:21-jdk-slim
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 spring && \
    adduser --system --uid 1001 --gid 1001 springuser

# Copy JAR from build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Set ownership
RUN chown -R springuser:spring /app

USER springuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
