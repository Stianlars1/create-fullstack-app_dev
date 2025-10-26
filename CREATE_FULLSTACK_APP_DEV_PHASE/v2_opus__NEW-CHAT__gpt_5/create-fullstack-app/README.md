# @stianlarsen/create-fullstack-app

> Zero-config fullstack app generator for Next.js + Spring Boot with automatic deployment

[![npm version](https://img.shields.io/npm/v/@stianlarsen/create-fullstack-app.svg)](https://www.npmjs.com/package/@stianlarsen/create-fullstack-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

```bash
npx @stianlarsen/create-fullstack-app my-app
cd my-app
docker compose up -d
```

Your fullstack app is now running at http://localhost!

## 📦 What You Get

- **Frontend**: Next.js 14 with TypeScript, App Router, and your custom template
- **Backend**: Spring Boot with Kotlin, JWT auth, and your custom template  
- **Database**: PostgreSQL (optional, can add later)
- **Proxy**: Caddy with automatic SSL
- **CI/CD**: GitHub Actions configured for push-to-deploy
- **Docker**: Everything containerized for consistency

## 🔄 How It Changes Your Workflow

### Before (Manual Setup)
```bash
# 1. Buy domain
# 2. Setup AWS Lightsail
# 3. Install PostgreSQL, Node.js, Java
# 4. Configure Apache (100+ lines)
# 5. Setup SSL with Certbot
# 6. Configure systemd services
# 7. Manual deployments via SSH
# Time: 2-4 hours per project
```

### After (With This Tool)
```bash
# 1. Run generator
npx @stianlarsen/create-fullstack-app my-app

# 2. Deploy  
./scripts/deploy.sh

# 3. Push to deploy (CI/CD)
git push origin main
# Time: 5 minutes total
```

## 💡 Understanding Docker (Simple Explanation)

Docker packages your apps in "containers" - think of them as lightweight, portable boxes that include everything needed to run:

**Without Docker:**
- Install Node.js on server
- Install Java on server  
- Install PostgreSQL on server
- Hope versions match locally
- Debug environment differences

**With Docker:**
- Everything runs in isolated containers
- Same versions everywhere
- Update one without breaking others
- Deploy with one command

## 📋 Installation & Usage

### Generate New Project

```bash
npx @stianlarsen/create-fullstack-app my-app
```

You'll be prompted for:
- **Project name**: Your app's name (lowercase, hyphens)
- **Domain**: Your domain (e.g., myapp.dev)
- **Deployment target**: AWS Lightsail, any VPS, or local
- **Database**: Docker PostgreSQL, external, or skip
- **CI/CD**: GitHub Actions setup

### Project Structure

```
my-app/
├── docker-compose.yml    # Services configuration
├── Caddyfile            # Reverse proxy config  
├── .env                 # Environment variables
├── frontend/
│   ├── Dockerfile       # Frontend container
│   └── ... (your Next.js template)
├── backend/
│   ├── Dockerfile       # Backend container
│   └── ... (your Spring Boot template)
└── scripts/
    └── deploy.sh        # Deployment script
```

## 🗄️ Database Management

### Add Database Later

Forgot to add a database? No problem:

```bash
cd my-app
npx @stianlarsen/create-fullstack-app add-database
```

Choose from:
- PostgreSQL in Docker
- External database (Neon/Supabase)
- MySQL in Docker
- MongoDB in Docker

### Database Access

```bash
# Access database
docker exec -it my-app-db psql -U my-app_user -d my-app

# Backup database
docker exec my-app-db pg_dump -U my-app_user my-app > backup.sql

# Restore database
docker exec -i my-app-db psql -U my-app_user my-app < backup.sql
```

## 🚀 Deployment

### First Deployment

1. **Create VPS** (AWS Lightsail, DigitalOcean, etc.)
2. **Point domain** to server IP
3. **Deploy**:

```bash
# Copy to server
scp -r my-app ubuntu@SERVER_IP:/home/ubuntu/

# SSH to server
ssh ubuntu@SERVER_IP

# Run setup (first time only)
cd my-app
sudo ./scripts/deploy.sh myapp.dev

# Your app is live! 🎉
```

### Daily Development Workflow

```bash
# Make changes locally
npm run dev         # Frontend dev server
./gradlew bootRun  # Backend dev server

# Test with Docker
docker compose up -d
# Visit http://localhost

# Deploy changes
git add .
git commit -m "Add new feature"
git push origin main
# GitHub Actions auto-deploys! ✨
```

### Manual Deploy (if not using CI/CD)

```bash
ssh ubuntu@SERVER_IP
cd my-app
git pull
docker compose build
docker compose up -d
```

## 🔧 Configuration

### Environment Variables

Edit `.env` file:

```bash
# Application
APP_NAME=my-app
DOMAIN=myapp.dev
NODE_ENV=production

# Database  
DB_HOST=db
DB_PORT=5432
DB_NAME=my-app
DB_USER=my-app_user
DB_PASSWORD=<generated>

# Security
JWT_SECRET=<generated>
```

### Updating Services

```bash
# Update only frontend
docker compose build frontend
docker compose up -d frontend

# Update only backend
docker compose build backend  
docker compose up -d backend

# View logs
docker compose logs -f frontend
docker compose logs -f backend
```

## 🛠️ Common Tasks

### SSL Certificates

Caddy handles SSL automatically! No configuration needed.

### Multiple Apps on Same Server

Each app uses different ports internally. Caddy routes by domain:

```bash
# App 1
npx @stianlarsen/create-fullstack-app app1
# Configure with domain: app1.com

# App 2  
npx @stianlarsen/create-fullstack-app app2
# Configure with domain: app2.com

# Both run on same server!
```

### Monitoring

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f

# Resource usage
docker stats

# Restart service
docker compose restart backend
```

### Rollback Deployment

```bash
# If something goes wrong
git revert HEAD
git push origin main
# CI/CD will deploy previous version
```

## 📊 Comparison: Old vs New

| Task | Old Way | New Way |
|------|---------|---------|
| **New Project Setup** | 2-4 hours | 5 minutes |
| **Deploy Frontend Change** | SSH, pull, build, restart | `git push` |
| **Deploy Backend Change** | SSH, pull, gradle, restart | `git push` |
| **Add Database** | Install, configure, migrate | Run `add-database` |
| **SSL Certificate** | Certbot, manual renewal | Automatic |
| **Update Dependencies** | Manual, risky | Update Dockerfile |
| **Rollback** | Complex, manual | `git revert && push` |

## 🎯 Commands Reference

```bash
# Create new app
npx @stianlarsen/create-fullstack-app my-app

# Add database to existing app
npx @stianlarsen/create-fullstack-app add-database

# Local development
docker compose up -d      # Start all services
docker compose down       # Stop all services
docker compose logs -f    # View logs
docker compose ps         # Check status

# Deployment
git push origin main      # Auto-deploy via CI/CD
./scripts/deploy.sh       # Manual deploy
```

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT © [Stian Larsen](https://github.com/stianlarsen)

## 🙋 FAQ

**Q: Do I need to know Docker?**  
A: No! The generator handles everything. Just run the commands.

**Q: Can I use my existing templates?**  
A: Yes! Replace the `frontend/` and `backend/` folders with your templates.

**Q: What if I don't have a domain yet?**  
A: Use the server IP initially, add domain later by updating `.env` and Caddyfile.

**Q: Can I add more services?**  
A: Yes! Edit `docker-compose.yml` to add Redis, ElasticSearch, etc.

**Q: How do I update Node.js or Java versions?**  
A: Edit the `FROM` lines in respective Dockerfiles.

## 🐛 Troubleshooting

### Containers not starting
```bash
docker compose logs      # Check error messages
docker compose down      # Stop everything
docker compose up -d     # Start fresh
```

### Database connection issues
```bash
# Check if database is running
docker compose ps

# Test connection
docker exec -it my-app-db psql -U my-app_user
```

### Port already in use
```bash
# Find process using port 80
sudo lsof -i :80

# Stop it or change ports in docker-compose.yml
```

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/stianlarsen/create-fullstack-app/issues)
- Twitter: [@stianlarsen](https://twitter.com/stianlarsen)
