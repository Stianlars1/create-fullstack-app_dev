# Backend Dockerfile - Simple multi-stage build
FROM gradle:8.10-jdk21 AS build
WORKDIR /app

# Copy Gradle files first
COPY build.gradle.kts settings.gradle.kts ./

# Download dependencies with debug output and refresh
RUN gradle dependencies --refresh-dependencies --no-daemon --info 2>&1 | tail -20 || true

# Copy source and build
COPY src src
RUN gradle bootJar --no-daemon

# Runtime stage
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
# Create a non-root application user with Ubuntu-compatible tooling.
# --system keeps the UID/GID in the system range and avoids login shells by default.
RUN groupadd --system spring \
    && useradd --system --gid spring --shell /usr/sbin/nologin --create-home spring
COPY --from=build /app/build/libs/*.jar app.jar
RUN chown -R spring:spring /app
USER spring:spring
EXPOSE 8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
