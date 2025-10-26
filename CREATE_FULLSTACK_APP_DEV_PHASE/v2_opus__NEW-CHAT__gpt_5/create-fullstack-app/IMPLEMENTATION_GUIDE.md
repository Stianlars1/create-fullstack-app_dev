# Implementation Guide

This repository stores **Dockerized templates** for a Next.js frontend and a Spring Boot backend. Use these templates inside a generator or copy them into new apps.

## Structure
````

templates/
frontend/   # Next.js 13+ (App Router) with standalone Dockerfile
backend/    # Spring Boot with Gradle + JDK 21 Dockerfile
scripts/
bootstrap-server.sh  # optional VPS bootstrap

```

## Using in a generator
- Your CLI should copy `templates/frontend` and `templates/backend` into the target project.
- It should also emit a `docker-compose.yml` and optional `Caddyfile` if you proxy multiple services.

## One-off manual use
If you are not using a generator, see **Testing Guide** for a minimal `docker-compose.yml`.

## Production notes
- Frontend Dockerfile expects Next `output: 'standalone'` for minimal runtime image.
- Backend Dockerfile builds a fat jar via `bootJar` and runs on a slim JRE.
- Add a `.env.example` to your generated apps. Do not commit secrets.

## Server bootstrap (optional)
Use `scripts/bootstrap-server.sh` once on a fresh Ubuntu VPS to install Docker and open ports 80/443/22. Then place your app under `/srv/apps/<name>` and run:
```

docker compose up -d

```
````