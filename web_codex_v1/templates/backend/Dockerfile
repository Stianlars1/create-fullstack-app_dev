# Backend Dockerfile rebuilt from scratch for web_codex_v1
# Multi-stage build for Kotlin Spring Boot backend

# --- Build stage -----------------------------------------------------------
FROM gradle:8.10-jdk21 AS build
WORKDIR /workspace

# Copy Gradle build definition and download dependencies first for better caching.
COPY build.gradle.kts settings.gradle.kts ./
RUN gradle --no-daemon dependencies || true

# Copy application sources and create the executable JAR.
COPY src ./src
RUN gradle --no-daemon bootJar

# --- Runtime stage --------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create a dedicated non-root user using Debian/Ubuntu tooling instead of Alpine.
RUN groupadd --system spring \
    && useradd --system --gid spring --shell /usr/sbin/nologin --home /app spring

# Copy the built artifact and set ownership so the non-root user can access it.
COPY --from=build /workspace/build/libs/*.jar app.jar
RUN chown -R spring:spring /app

USER spring:spring
EXPOSE 8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
