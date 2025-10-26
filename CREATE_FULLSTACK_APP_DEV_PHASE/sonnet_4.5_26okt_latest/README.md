# @stianlarsen/create-fullstack-app

> Zero-config fullstack generator with complete automation - Next.js 15 + Spring Boot 3 + PostgreSQL

[![npm version](https://img.shields.io/npm/v/@stianlarsen/create-fullstack-app.svg)](https://www.npmjs.com/package/@stianlarsen/create-fullstack-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

```bash
npx @stianlarsen/create-fullstack-app my-app
```

Answer a few prompts, and you'll have a production-ready fullstack application in **5 minutes**!

## ✨ What You Get

- **Frontend**: Next.js 15 with TypeScript, React 19, App Router, SCSS modules
- **Backend**: Spring Boot 3 with Kotlin, JPA, Spring Security, JWT
- **Database**: PostgreSQL 16 (Docker or external like Neon/Supabase)
- **Reverse Proxy**: Caddy with automatic SSL/TLS certificates
- **CI/CD**: GitHub Actions configured for push-to-deploy
- **Docker**: Multi-stage builds for optimal production images
- **Security**: HTTPS, security headers, JWT authentication, non-root containers

## 📋 Prerequisites

- **Node.js** 20.0.0 or higher
- **npm** 10.0.0 or higher
- **Docker** (for local development and deployment)
- **Git** (optional, for version control)

## 🎯 Usage

### Create New Project

```bash
# Interactive mode (recommended)
npx @stianlarsen/create-fullstack-app

# With project name
npx @stianlarsen/create-fullstack-app my-awesome-app

# Skip database setup (add later)
npx @stianlarsen/create-fullstack-app my-app --skip-db

# Skip CI/CD setup
npx @stianlarsen/create-fullstack-app my-app --skip-ci
```

### Add Database to Existing Project

```bash
cd my-app
npx @stianlarsen/create-fullstack-app add-database
```

## 🏗️ Project Structure

```
my-app/
├── frontend/                  # Next.js 15 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx    # Root layout
│   │   │   ├── page.tsx      # Home page
│   │   │   ├── globals.scss  # Global styles with HSL variables
│   │   │   └── page.module.scss
│   │   ├── components/       # React components
│   │   └── lib/              # Utilities
│   ├── Dockerfile            # Multi-stage production build
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
├── backend/                   # Spring Boot 3 application
│   ├── src/
│   │   └── main/
│   │       ├── kotlin/       # Kotlin source code
│   │       └── resources/
│   │           └── application.properties
│   ├── Dockerfile            # Multi-stage production build
│   ├── build.gradle.kts      # Gradle configuration
│   └── settings.gradle.kts
├── scripts/
│   ├── bootstrap-server.sh   # First-time server setup
│   ├── deploy.sh             # Deployment script
│   ├── deploy-from-mac.sh    # Deploy from local machine
│   └── dev.sh                # Start local development
├── .github/
│   └── workflows/
│       ├── deploy.yml        # Auto-deploy on push
│       └── ci.yml            # CI tests on PRs
├── docker-compose.yml         # All services configuration
├── Caddyfile                  # Reverse proxy + SSL config
├── .env                       # Environment variables (auto-generated)
├── .env.example               # Example configuration
└── .gitignore                 # Git ignore rules
```

## 🖥️ Local Development

```bash
# Start all services
cd my-app
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

**Access your app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Database: localhost:5432

## 🚀 Deployment

### First Deployment

1. **Create a VPS** (AWS Lightsail, DigitalOcean, Hetzner, etc.)

2. **Point your domain** to the server IP

3. **Copy project to server:**
```bash
scp -r my-app ubuntu@YOUR_SERVER_IP:/srv/apps/
```

4. **SSH to server:**
```bash
ssh ubuntu@YOUR_SERVER_IP
```

5. **Bootstrap server (first time only):**
```bash
cd /srv/apps/my-app
sudo ./scripts/bootstrap-server.sh
```

6. **Deploy:**
```bash
./scripts/deploy.sh
```

Your app is now live at `https://your-domain.com`! 🎉

### Automated Deployments

After initial setup, configure GitHub Actions:

1. Go to **Settings → Secrets → Actions** in your GitHub repository

2. Add these secrets:
   - `HOST`: Your server IP address
   - `USERNAME`: SSH username (usually `ubuntu`)
   - `SSH_KEY`: Your private SSH key

3. **Deploy by pushing:**
```bash
git push origin main
```

That's it! GitHub Actions will automatically deploy your changes.

## 🗄️ Database Management

### PostgreSQL in Docker (Default)

```bash
# Connect to database
docker exec -it my-app-db psql -U my_app_user -d my_app

# Backup database
docker exec my-app-db pg_dump -U my_app_user my_app > backup.sql

# Restore database
docker exec -i my-app-db psql -U my_app_user my_app < backup.sql
```

### External Database (Neon, Supabase, AWS RDS)

If you chose external database, update `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Then restart containers:
```bash
docker compose down
docker compose up -d
```

## 🔒 Security

### Environment Variables

**Never commit `.env` to version control!** It contains:
- Database passwords
- JWT secrets
- API keys

The `.env` file is automatically added to `.gitignore`.

### Secure Defaults

- ✅ Non-root Docker containers
- ✅ Automatic HTTPS with Let's Encrypt
- ✅ Security headers (HSTS, CSP, X-Frame-Options)
- ✅ JWT authentication ready
- ✅ PostgreSQL password auto-generated

## 📊 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 15.0+ |
| Frontend Framework | React | 19.0+ |
| Language (Frontend) | TypeScript | 5.6+ |
| Styling | SCSS Modules | Latest |
| Backend | Spring Boot | 3.2+ |
| Language (Backend) | Kotlin | 1.9+ |
| Database | PostgreSQL | 16+ |
| Reverse Proxy | Caddy | 2.0+ |
| Container | Docker | Latest |
| Build Tool | Gradle | 8.5+ |
| JDK | Amazon Corretto | 21 |

## 🛠️ Customization

### Styling with SCSS Modules

Your frontend uses SCSS modules with HSL CSS variables (shadcn format):

```scss
// globals.scss defines variables
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
}

// component.module.scss uses them
.button {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}
```

### Adding API Endpoints

1. Create controller in `backend/src/main/kotlin/`
2. Frontend can access at `/api/your-endpoint`
3. Caddy automatically routes `/api/*` to backend

### Environment Variables

Add variables in `.env`:
```env
MY_VAR=value
```

Use in frontend:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

Use in backend:
```kotlin
@Value("\${MY_VAR}")
private val myVar: String
```

## 🐛 Troubleshooting

### Containers not starting

```bash
docker compose logs
docker compose down
docker compose up -d
```

### Database connection issues

```bash
# Check if database is running
docker compose ps

# Check environment variables
cat .env | grep DB_
```

### Port already in use

```bash
# Find what's using port 80
sudo lsof -i :80

# Or change ports in docker-compose.yml
ports:
  - "8080:80"  # Use port 8080 instead
```

### SSL not working

Make sure:
1. Domain is pointed to your server IP
2. Ports 80 and 443 are open
3. Caddy container is running

```bash
docker compose logs caddy
```

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [Docker Documentation](https://docs.docker.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT © [Stian Larsen](https://github.com/stianlarsen)

## 🆘 Support

- **GitHub Issues**: [Report bugs](https://github.com/stianlarsen/create-fullstack-app/issues)
- **Discussions**: [Ask questions](https://github.com/stianlarsen/create-fullstack-app/discussions)

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Made with ❤️ by developers, for developers**
