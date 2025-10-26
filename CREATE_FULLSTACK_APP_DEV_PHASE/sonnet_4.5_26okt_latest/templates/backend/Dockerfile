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
RUN groupadd -r spring && useradd -r -g spring spring
COPY --from=build /app/build/libs/*.jar app.jar
RUN chown spring:spring app.jar
USER spring:spring
EXPOSE 8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
