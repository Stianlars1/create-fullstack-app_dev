#!/usr/bin/env node

/**
 * @stianlarsen/create-fullstack-app
 * Production-ready fullstack generator with zero manual configuration
 * Automates: Database setup, Docker configs, CI/CD, SSL, deployments
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('create-fullstack-app')
  .description('Generate production-ready Next.js + Spring Boot + PostgreSQL stack')
  .version('2.0.0')
  .argument('[project-name]', 'Project name (lowercase, hyphens)')
  .option('--skip-db', 'Skip database setup (add later with add-database)')
  .option('--skip-ci', 'Skip CI/CD setup')
  .option('--no-interactive', 'Use defaults for all prompts')
  .action(async (projectNameArg, options) => {
    console.log(chalk.cyan.bold('\n🚀 Create Fullstack App v2.0\n'));
    console.log(chalk.gray('Next.js 15 + Spring Boot 3 + PostgreSQL + Docker + Caddy\n'));

    // Interactive prompts
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: projectNameArg || 'my-fullstack-app',
        validate: (input) => {
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Use lowercase letters, numbers, and hyphens only';
          }
          return true;
        },
        when: options.interactive !== false
      },
      {
        type: 'input',
        name: 'domain',
        message: 'Production domain:',
        default: (answers) => `${answers.projectName || projectNameArg}.dev`,
        validate: (input) => {
          if (!/^[a-z0-9-]+\.[a-z]{2,}$/.test(input)) {
            return 'Enter valid domain (e.g., myapp.dev)';
          }
          return true;
        },
        when: options.interactive !== false && !options.skipCi
      },
      {
        type: 'list',
        name: 'deploymentTarget',
        message: 'Deployment target:',
        choices: [
          { name: 'AWS Lightsail (recommended)', value: 'lightsail' },
          { name: 'Any VPS (DigitalOcean, Hetzner, etc)', value: 'vps' },
          { name: 'Local development only', value: 'local' }
        ],
        default: 'vps',
        when: options.interactive !== false
      },
      {
        type: 'input',
        name: 'serverIp',
        message: 'Server IP address:',
        when: (answers) => options.interactive !== false && answers.deploymentTarget !== 'local',
        validate: (input) => {
          if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(input)) {
            return 'Enter valid IP address';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'databaseOption',
        message: 'Database setup:',
        choices: [
          { name: 'PostgreSQL in Docker (recommended)', value: 'docker' },
          { name: 'External PostgreSQL (Neon/Supabase/etc)', value: 'external' },
          { name: 'Skip for now (add later)', value: 'skip' }
        ],
        default: 'docker',
        when: options.interactive !== false && !options.skipDb
      },
      {
        type: 'input',
        name: 'databaseUrl',
        message: 'Database connection URL:',
        when: (answers) => answers.databaseOption === 'external',
        validate: (input) => {
          if (!input.startsWith('postgresql://') && !input.startsWith('postgres://')) {
            return 'Enter valid PostgreSQL connection URL';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'includeCiCd',
        message: 'Setup GitHub Actions CI/CD?',
        default: true,
        when: (answers) => options.interactive !== false && !options.skipCi && answers.deploymentTarget !== 'local'
      },
      {
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository (username/repo):',
        when: (answers) => answers.includeCiCd,
        validate: (input) => {
          if (!/^[\w-]+\/[\w-]+$/.test(input)) {
            return 'Format: username/repository';
          }
          return true;
        }
      }
    ]);

    // Use defaults if non-interactive
    const config = {
      projectName: answers.projectName || projectNameArg || 'my-fullstack-app',
      domain: answers.domain || `${answers.projectName || projectNameArg}.dev`,
      deploymentTarget: answers.deploymentTarget || 'vps',
      serverIp: answers.serverIp || null,
      databaseOption: options.skipDb ? 'skip' : (answers.databaseOption || 'docker'),
      databaseUrl: answers.databaseUrl || null,
      includeCiCd: options.skipCi ? false : (answers.includeCiCd ?? true),
      githubRepo: answers.githubRepo || null
    };

    const spinner = ora('Initializing project...').start();

    try {
      const projectPath = path.join(process.cwd(), config.projectName);

      // Check if directory exists
      if (await fs.pathExists(projectPath)) {
        spinner.fail(chalk.red(`Directory "${config.projectName}" already exists`));
        process.exit(1);
      }

      await fs.ensureDir(projectPath);

      // Step 1: Copy templates
      spinner.text = 'Copying frontend template...';
      await copyFrontendTemplate(projectPath, config);

      spinner.text = 'Copying backend template...';
      await copyBackendTemplate(projectPath, config);

      // Step 2: Generate configurations
      spinner.text = 'Generating Docker configurations...';
      await generateDockerCompose(projectPath, config);
      await generateCaddyfile(projectPath, config);
      await generateDockerfiles(projectPath, config);

      spinner.text = 'Generating environment configuration...';
      await generateEnvFile(projectPath, config);

      // Step 3: Setup database if needed
      if (config.databaseOption !== 'skip') {
        spinner.text = 'Configuring database...';
        await setupDatabase(projectPath, config);
      }

      // Step 4: Setup CI/CD
      if (config.includeCiCd) {
        spinner.text = 'Setting up CI/CD...';
        await setupCiCd(projectPath, config);
      }

      // Step 5: Create deployment scripts
      spinner.text = 'Creating deployment scripts...';
      await createDeploymentScripts(projectPath, config);

      // Step 6: Initialize git
      spinner.text = 'Initializing git repository...';
      await initializeGit(projectPath, config);

      spinner.succeed(chalk.green('✨ Fullstack app created successfully!\n'));

      // Display summary
      displaySummary(config);

    } catch (error) {
      spinner.fail(chalk.red('Failed to create application'));
      console.error(chalk.red('\nError:'), error.message);
      if (error.stack) {
        console.error(chalk.gray('\nStack trace:'), error.stack);
      }
      process.exit(1);
    }
  });

/**
 * Copy frontend Next.js template
 */
async function copyFrontendTemplate(projectPath, config) {
  const templateDir = path.join(__dirname, 'templates/frontend');
  const targetDir = path.join(projectPath, 'frontend');

  await fs.ensureDir(targetDir);
  await fs.copy(templateDir, targetDir);

  // Update package.json with project name
  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  packageJson.name = `${config.projectName}-frontend`;
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
}

/**
 * Copy backend Spring Boot template
 */
async function copyBackendTemplate(projectPath, config) {
  const templateDir = path.join(__dirname, 'templates/backend');
  const targetDir = path.join(projectPath, 'backend');

  await fs.ensureDir(targetDir);
  await fs.copy(templateDir, targetDir);

  // Update settings.gradle.kts
  const settingsPath = path.join(targetDir, 'settings.gradle.kts');
  await fs.writeFile(settingsPath, `rootProject.name = "${config.projectName}-backend"\n`);
}

/**
 * Generate docker-compose.yml with all services
 */
async function generateDockerCompose(projectPath, config) {
  const includeDb = config.databaseOption === 'docker';
  
  const compose = `# Generated by @stianlarsen/create-fullstack-app
# Project: ${config.projectName}

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: runner
    container_name: ${config.projectName}-frontend
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://\${DOMAIN}/api
      - NEXT_TELEMETRY_DISABLED=1
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${config.projectName}-backend
    environment:
      - SPRING_PROFILES_ACTIVE=production
      - SPRING_DATASOURCE_URL=\${DATABASE_URL:-jdbc:postgresql://${includeDb ? 'db' : 'external'}:5432/\${DB_NAME}}
      - SPRING_DATASOURCE_USERNAME=\${DB_USER}
      - SPRING_DATASOURCE_PASSWORD=\${DB_PASSWORD}
      - JWT_SECRET=\${JWT_SECRET}
      - SERVER_PORT=8080
    restart: unless-stopped${includeDb ? '\n    depends_on:\n      - db' : ''}
    networks:
      - app-network
${includeDb ? `
  db:
    image: postgres:16-alpine
    container_name: ${config.projectName}-db
    environment:
      - POSTGRES_DB=\${DB_NAME}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER} -d \${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
` : ''}
  caddy:
    image: caddy:2-alpine
    container_name: ${config.projectName}-caddy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    environment:
      - DOMAIN=\${DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped
    depends_on:
      - frontend
      - backend
    networks:
      - app-network

volumes:${includeDb ? '\n  postgres_data:' : ''}
  caddy_data:
  caddy_config:

networks:
  app-network:
    driver: bridge
`;

  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), compose);
}

/**
 * Generate Caddyfile for reverse proxy + automatic SSL
 */
async function generateCaddyfile(projectPath, config) {
  const caddyfile = `# Generated by @stianlarsen/create-fullstack-app
# Automatic HTTPS with Let's Encrypt

{$DOMAIN:localhost} {
    # Enable compression
    encode zstd gzip

    # API routes → Spring Boot backend
    handle /api/* {
        reverse_proxy backend:8080
    }

    # Actuator endpoints (health checks)
    handle /actuator/* {
        reverse_proxy backend:8080
    }

    # Everything else → Next.js frontend
    handle {
        reverse_proxy frontend:3000
    }

    # Security headers
    header {
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Enable XSS protection
        X-XSS-Protection "1; mode=block"
        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
        # Strict transport security (HSTS)
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        # Remove server header
        -Server
    }

    # Logging
    log {
        output file /var/log/caddy/access.log
        format json
    }
}
`;

  await fs.writeFile(path.join(projectPath, 'Caddyfile'), caddyfile);
}

/**
 * Generate Dockerfiles (if templates don't have them)
 */
async function generateDockerfiles(projectPath, config) {
  // Frontend Dockerfile is in template, but ensure it exists
  const frontendDockerfile = path.join(projectPath, 'frontend/Dockerfile');
  if (!await fs.pathExists(frontendDockerfile)) {
    throw new Error('Frontend Dockerfile missing from template');
  }

  // Backend Dockerfile is in template, but ensure it exists
  const backendDockerfile = path.join(projectPath, 'backend/Dockerfile');
  if (!await fs.pathExists(backendDockerfile)) {
    throw new Error('Backend Dockerfile missing from template');
  }
}

/**
 * Generate .env file with secure credentials
 */
async function generateEnvFile(projectPath, config) {
  // Generate secure passwords and secrets
  const dbPassword = crypto.randomBytes(32).toString('base64url');
  const jwtSecret = crypto.randomBytes(64).toString('base64url');
  
  const dbName = config.projectName.replace(/-/g, '_');
  const dbUser = `${dbName}_user`;

  const env = `# Generated by @stianlarsen/create-fullstack-app
# Project: ${config.projectName}
# DO NOT commit this file to version control!

# Application
APP_NAME=${config.projectName}
DOMAIN=${config.domain}
NODE_ENV=production

# Database${config.databaseOption === 'external' ? `
DATABASE_URL=${config.databaseUrl}` : `
DB_HOST=${config.databaseOption === 'docker' ? 'db' : 'localhost'}
DB_PORT=5432
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}:\${DB_PORT}/\${DB_NAME}`}

# Security
JWT_SECRET=${jwtSecret}

# Server (if deploying)
${config.serverIp ? `SERVER_IP=${config.serverIp}` : '# SERVER_IP=your.server.ip'}
${config.githubRepo ? `GITHUB_REPO=${config.githubRepo}` : ''}
`;

  await fs.writeFile(path.join(projectPath, '.env'), env);

  // Create .env.example (without secrets)
  const envExample = `# Example environment configuration
# Copy to .env and fill in actual values

APP_NAME=${config.projectName}
DOMAIN=your-domain.com
NODE_ENV=production

DB_HOST=db
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_secure_password

JWT_SECRET=your_jwt_secret

SERVER_IP=your.server.ip
`;

  await fs.writeFile(path.join(projectPath, '.env.example'), envExample);
}

/**
 * Setup database configuration in Spring Boot
 */
async function setupDatabase(projectPath, config) {
  const propsPath = path.join(projectPath, 'backend/src/main/resources/application.properties');
  
  if (!await fs.pathExists(propsPath)) {
    console.warn(chalk.yellow('⚠️  application.properties not found, creating...'));
    await fs.ensureDir(path.dirname(propsPath));
  }

  let properties = await fs.readFile(propsPath, 'utf-8').catch(() => '');

  // Remove existing database config
  properties = properties.replace(/# Database Configuration[\s\S]*?(?=\n#|\n\n|$)/g, '');

  // Add comprehensive database configuration
  const dbConfig = `
# Database Configuration (auto-generated)
spring.datasource.url=\${SPRING_DATASOURCE_URL}
spring.datasource.username=\${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=\${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA/Hibernate Configuration
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation=true
spring.jpa.open-in-view=false

# Connection Pool (HikariCP)
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
`;

  properties += dbConfig;
  await fs.writeFile(propsPath, properties);
}

/**
 * Setup GitHub Actions CI/CD
 */
async function setupCiCd(projectPath, config) {
  const workflowDir = path.join(projectPath, '.github/workflows');
  await fs.ensureDir(workflowDir);

  const deployYaml = `name: Deploy to Production

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.HOST }}
          username: \${{ secrets.USERNAME }}
          key: \${{ secrets.SSH_KEY }}
          script: |
            set -e
            cd /srv/apps/${config.projectName}
            
            # Pull latest code
            git pull origin main
            
            # Pull latest images (if using pre-built)
            docker compose pull || true
            
            # Build and restart
            docker compose build
            docker compose up -d
            
            # Clean up old images
            docker system prune -f
            
            # Show status
            docker compose ps
            
            echo "✅ Deployment complete!"
`;

  await fs.writeFile(path.join(workflowDir, 'deploy.yml'), deployYaml);

  // Create CI workflow for testing
  const ciYaml = `name: CI

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Build
        run: npm run build

  test-backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
          cache: 'gradle'
      
      - name: Make gradlew executable
        run: chmod +x ./gradlew
      
      - name: Build
        run: ./gradlew build
      
      - name: Test
        run: ./gradlew test
`;

  await fs.writeFile(path.join(workflowDir, 'ci.yml'), ciYaml);

  // Create README with setup instructions
  const ciReadme = `# CI/CD Setup

This project uses GitHub Actions for automated deployments.

## Required Secrets

Add these secrets to your GitHub repository:
\`Settings → Secrets and variables → Actions → New repository secret\`

1. **HOST**: Your server IP address (${config.serverIp || 'e.g., 123.45.67.89'})
2. **USERNAME**: SSH username (usually \`ubuntu\`)
3. **SSH_KEY**: Your private SSH key

## Getting Your SSH Key

\`\`\`bash
# On your local machine
cat ~/.ssh/id_rsa

# Copy the entire output (including BEGIN and END lines)
\`\`\`

## Manual Deployment

If you need to deploy manually:

\`\`\`bash
./scripts/deploy.sh
\`\`\`

## Workflow Files

- **deploy.yml**: Runs on every push to main
- **ci.yml**: Runs on pull requests for testing
`;

  await fs.writeFile(path.join(workflowDir, 'README.md'), ciReadme);
}

/**
 * Create deployment scripts
 */
async function createDeploymentScripts(projectPath, config) {
  const scriptsDir = path.join(projectPath, 'scripts');
  await fs.ensureDir(scriptsDir);

  // Server bootstrap script (run once on new server)
  const bootstrapScript = `#!/usr/bin/env bash
# Bootstrap script for new server setup
# Run once: sudo ./scripts/bootstrap-server.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "❌ Run as root: sudo ./scripts/bootstrap-server.sh"
  exit 1
fi

echo "🚀 Bootstrapping server for ${config.projectName}..."

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  
  # Add ubuntu user to docker group
  usermod -aG docker ubuntu
else
  echo "✓ Docker already installed"
fi

# Install Docker Compose
if ! docker compose version >/dev/null 2>&1; then
  echo "🐳 Installing Docker Compose plugin..."
  apt-get install -y docker-compose-plugin
else
  echo "✓ Docker Compose already installed"
fi

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 443/udp  # HTTP/3
ufw --force enable

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /srv/apps/${config.projectName}
chown -R ubuntu:ubuntu /srv/apps

# Set up automatic security updates
echo "🔐 Enabling automatic security updates..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

echo "✅ Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Copy your project files to /srv/apps/${config.projectName}"
echo "2. Run: cd /srv/apps/${config.projectName} && ./scripts/deploy.sh"
`;

  await fs.writeFile(path.join(scriptsDir, 'bootstrap-server.sh'), bootstrapScript);
  await fs.chmod(path.join(scriptsDir, 'bootstrap-server.sh'), 0o755);

  // Deployment script (for server)
  const deployScript = `#!/usr/bin/env bash
# Deploy script - run on server after git pull
# Usage: ./scripts/deploy.sh

set -euo pipefail

echo "🚀 Deploying ${config.projectName}..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  echo "Copy .env.example to .env and configure it first."
  exit 1
fi

# Pull latest images (if using registry)
echo "📦 Pulling latest images..."
docker compose pull || true

# Build containers
echo "🔨 Building containers..."
docker compose build

# Start services
echo "▶️  Starting services..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check status
echo "📊 Service status:"
docker compose ps

# Clean up
echo "🧹 Cleaning up..."
docker system prune -f

echo "✅ Deployment complete!"
echo ""
echo "Your app is running at: https://${config.domain}"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          # View logs"
echo "  docker compose ps               # Check status"
echo "  docker compose restart backend  # Restart service"
`;

  await fs.writeFile(path.join(scriptsDir, 'deploy.sh'), deployScript);
  await fs.chmod(path.join(scriptsDir, 'deploy.sh'), 0o755);

  // Deploy from local machine script
  const deployFromMacScript = `#!/usr/bin/env bash
# Deploy from local machine to server
# Usage: SERVER=ubuntu@123.45.67.89 ./scripts/deploy-from-mac.sh

set -euo pipefail

SERVER="\${SERVER:-ubuntu@${config.serverIp || 'YOUR_SERVER_IP'}}"
APP_DIR="/srv/apps/${config.projectName}"

echo "🚀 Deploying ${config.projectName} to \${SERVER}..."

# Ensure server directory exists
echo "📁 Creating directory on server..."
ssh "\${SERVER}" "mkdir -p \${APP_DIR}"

# Sync files (excluding node_modules, .git, etc.)
echo "📤 Syncing files..."
rsync -avz --delete \\
  --exclude 'node_modules' \\
  --exclude '.next' \\
  --exclude 'build' \\
  --exclude '.gradle' \\
  --exclude '.git' \\
  --exclude '.env' \\
  ./ "\${SERVER}:\${APP_DIR}/"

# Run deployment on server
echo "🔧 Running deployment on server..."
ssh "\${SERVER}" "cd \${APP_DIR} && ./scripts/deploy.sh"

echo "✅ Deployment complete!"
`;

  await fs.writeFile(path.join(scriptsDir, 'deploy-from-mac.sh'), deployFromMacScript);
  await fs.chmod(path.join(scriptsDir, 'deploy-from-mac.sh'), 0o755);

  // Local development script
  const devScript = `#!/usr/bin/env bash
# Start local development environment
# Usage: ./scripts/dev.sh

set -euo pipefail

echo "🚀 Starting local development environment..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env not found, copying from .env.example..."
  cp .env.example .env
  echo "✏️  Please edit .env with your configuration"
fi

# Start services
echo "▶️  Starting Docker containers..."
docker compose up -d

echo "✅ Development environment ready!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:8080"
echo "🗄️  Database: localhost:5432"
echo ""
echo "📋 Useful commands:"
echo "  docker compose logs -f          # View all logs"
echo "  docker compose logs -f frontend # View frontend logs"
echo "  docker compose logs -f backend  # View backend logs"
echo "  docker compose down             # Stop all services"
`;

  await fs.writeFile(path.join(scriptsDir, 'dev.sh'), devScript);
  await fs.chmod(path.join(scriptsDir, 'dev.sh'), 0o755);
}

/**
 * Initialize git repository
 */
async function initializeGit(projectPath, config) {
  const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
/build
/dist
/.next/
/out/
.next/
standalone/

# Environment variables
.env
.env*.local
.env.production

# IDE
.idea/
.vscode/
*.iml
*.ipr
*.iws
.DS_Store

# Java/Gradle
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar
bin/
out/

# Docker
*.log

# Testing
coverage/
.nyc_output/

# Temporary files
*.swp
*.swo
*~
.tmp/

# OS
Thumbs.db
Desktop.ini
`;

  await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);

  // Initialize git
  try {
    process.chdir(projectPath);
    execSync('git init', { stdio: 'ignore' });
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit from @stianlarsen/create-fullstack-app"', { stdio: 'ignore' });
    
    if (config.githubRepo) {
      const repoUrl = `https://github.com/${config.githubRepo}.git`;
      execSync(`git remote add origin ${repoUrl}`, { stdio: 'ignore' });
    }
  } catch (error) {
    // Git might not be installed, that's okay
    console.warn(chalk.yellow('⚠️  Could not initialize git repository'));
  }
}

/**
 * Display success summary
 */
function displaySummary(config) {
  console.log(chalk.cyan.bold('📋 Project Summary\n'));
  console.log(chalk.white(`  Name:         ${config.projectName}`));
  console.log(chalk.white(`  Domain:       ${config.domain}`));
  console.log(chalk.white(`  Database:     ${config.databaseOption === 'docker' ? 'PostgreSQL (Docker)' : config.databaseOption === 'external' ? 'External' : 'Not configured'}`));
  console.log(chalk.white(`  CI/CD:        ${config.includeCiCd ? 'Enabled (GitHub Actions)' : 'Disabled'}`));
  
  console.log(chalk.cyan.bold('\n🎯 Next Steps\n'));
  
  console.log(chalk.white(`  1. ${chalk.cyan(`cd ${config.projectName}`)}`));
  console.log(chalk.white(`  2. ${chalk.cyan('docker compose up -d')} ${chalk.gray('# Start locally')}`));
  console.log(chalk.white(`  3. Visit ${chalk.cyan('http://localhost')}\n`));

  if (config.deploymentTarget !== 'local') {
    console.log(chalk.cyan.bold('🚀 To Deploy to Production\n'));
    
    if (config.serverIp) {
      console.log(chalk.white(`  1. Copy to server:`));
      console.log(chalk.cyan(`     scp -r ${config.projectName} ubuntu@${config.serverIp}:/srv/apps/`));
      console.log(chalk.white(`  2. SSH to server:`));
      console.log(chalk.cyan(`     ssh ubuntu@${config.serverIp}`));
      console.log(chalk.white(`  3. Bootstrap (first time only):`));
      console.log(chalk.cyan(`     cd /srv/apps/${config.projectName} && sudo ./scripts/bootstrap-server.sh`));
      console.log(chalk.white(`  4. Deploy:`));
      console.log(chalk.cyan(`     ./scripts/deploy.sh\n`));
    }

    if (config.includeCiCd) {
      console.log(chalk.yellow.bold('⚙️  Configure GitHub Secrets\n'));
      console.log(chalk.white(`  Settings → Secrets → Actions → New repository secret`));
      console.log(chalk.cyan(`  HOST:     ${config.serverIp || 'your.server.ip'}`));
      console.log(chalk.cyan(`  USERNAME: ubuntu`));
      console.log(chalk.cyan(`  SSH_KEY:  (your private key)\n`));
      console.log(chalk.gray(`  Then just: ${chalk.white('git push origin main')} to auto-deploy!\n`));
    }
  }

  if (config.databaseOption === 'skip') {
    console.log(chalk.yellow.bold('💡 Add Database Later\n'));
    console.log(chalk.white(`  Run: ${chalk.cyan(`npx @stianlarsen/create-fullstack-app add-database`)}\n`));
  }

  console.log(chalk.cyan.bold('📚 Documentation\n'));
  console.log(chalk.white(`  View README: ${chalk.cyan(`cat ${config.projectName}/README.md`)}`));
  console.log(chalk.white(`  GitHub:      ${chalk.cyan('https://github.com/stianlarsen/create-fullstack-app')}\n`));
}

program.parse();
