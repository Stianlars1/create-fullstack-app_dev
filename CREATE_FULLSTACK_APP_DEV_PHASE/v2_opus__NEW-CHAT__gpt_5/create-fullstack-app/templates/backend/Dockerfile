# CHAT_GPT_5_SOLUTION
# path: ..root/template/backend/Dockerfile

# ---- build ----
FROM gradle:8.10.2-jdk17 AS build
WORKDIR /workspace
# if you have these files, copy them; missing ones will be skipped
COPY build.gradle.kts settings.gradle.kts gradle.properties* ./
COPY src ./src
RUN gradle --no-daemon clean build

# ---- run ----
FROM eclipse-temurin:17-jre
WORKDIR /app
# adjust jar name/pattern if your build differs
COPY --from=build /workspace/build/libs/*-all.jar /app/app.jar
# fallback if you don’t build a fat jar:
# COPY --from=build /workspace/build/libs/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
