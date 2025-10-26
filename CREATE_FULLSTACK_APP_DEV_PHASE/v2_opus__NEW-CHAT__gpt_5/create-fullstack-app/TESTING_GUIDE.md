# Testing Guide

This repo holds **templates** only. Test them with a throwaway app folder.

## Prereqs
- macOS with Node 18+ and Docker Desktop.

## 1) Create a temp app
```bash
APP=my-app-test
mkdir -p "$APP"/{frontend,backend}
cp -R templates/frontend/* "$APP/frontend/"
cp -R templates/backend/* "$APP/backend/"
````

## 2) Add a minimal docker-compose.yml

```bash
cat > "$APP/docker-compose.yml" << 'YAML'
services:
  frontend:
    build: ./frontend
    environment:
      - PORT=3000
    ports:
      - "3000:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      - PORT=8080
    ports:
      - "8080:8080"
YAML
```

## 3) Build and run

```bash
cd "$APP"
docker compose build
docker compose up -d
docker compose ps
```

## 4) Verify

* Frontend: [http://localhost:3000](http://localhost:3000)
* Backend:  [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) (if actuator is enabled) or your API base.

## 5) Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## 6) Clean up

```bash
cd ..
docker compose -f "$APP/docker-compose.yml" down --rmi local
rm -rf "$APP"
```