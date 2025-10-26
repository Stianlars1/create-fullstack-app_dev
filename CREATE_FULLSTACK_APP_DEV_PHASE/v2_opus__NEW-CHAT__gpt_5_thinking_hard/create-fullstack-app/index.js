#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('create-fullstack-app')
  .description('Generate a production-ready Next.js + Spring Boot application')
  .version('1.1.0');

program
  .argument('[project-name]', 'Name of your project')
  .option('--skip-db', 'Skip database setup')
  .option('--use-external-db', 'Use external database (Neon/Supabase)')
  .option('--skip-ci', 'Skip CI/CD setup')
  .action(async (cliProjectName, options) => {
    console.log(chalk.cyan.bold('\n🚀 Create Fullstack App by @stianlarsen\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: cliProjectName || 'my-app',
        validate: (input) => /^[a-z0-9-]+$/.test(input) || 'Use lowercase letters, numbers, and hyphens only'
      },
      {
        type: 'list',
        name: 'deploymentTarget',
        message: 'Where will you deploy?',
        choices: [
          { name: 'AWS Lightsail (VPS)', value: 'lightsail' },
          { name: 'Any VPS (DigitalOcean, Linode, Hetzner)', value: 'vps' },
          { name: 'Local development only', value: 'local' }
        ]
      },
      {
        type: 'input',
        name: 'domain',
        message: 'Domain (e.g., myapp.dev):',
        default: (a) => `${a.projectName}.dev`,
        when: (a) => a.deploymentTarget !== 'local'
      },
      {
        type: 'input',
        name: 'serverIp',
        message: 'Server IP address:',
        when: (a) => a.deploymentTarget !== 'local',
        validate: (input) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(input) || 'Enter a valid IPv4 address'
      },
      {
        type: 'list',
        name: 'databaseOption',
        message: 'Database setup:',
        choices: [
          { name: 'PostgreSQL in Docker (recommended)', value: 'docker' },
          { name: 'External database (Neon/Supabase)', value: 'external' },
          { name: 'Skip for now (add later)', value: 'skip' }
        ],
        when: !options.skipDb
      },
      {
        type: 'input',
        name: 'databaseUrl',
        message: 'Database URL:',
        when: (a) => a.databaseOption === 'external'
      },
      {
        type: 'confirm',
        name: 'includeCiCd',
        message: 'Setup GitHub Actions CI/CD?',
        default: true,
        when: (a) => a.deploymentTarget !== 'local' && !options.skipCi
      },
      {
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository (e.g., username/repo):',
        when: (a) => a.includeCiCd === true
      }
    ]);

    const spinner = ora('Creating your fullstack application...').start();

    try {
      const projectPath = path.join(process.cwd(), answers.projectName);
      await fs.ensureDir(projectPath);

      spinner.text = 'Copying templates...';
      await copyTemplates(projectPath);

      spinner.text = 'Generating configurations...';
      await generateConfigurations(projectPath, answers);

      if (answers.databaseOption && answers.databaseOption !== 'skip') {
        spinner.text = 'Configuring database...';
        await setupDatabase(projectPath, answers);
      }

      if (answers.includeCiCd) {
        spinner.text = 'Setting up CI/CD...';
        await setupCiCd(projectPath, answers);
      }

      spinner.text = 'Initializing git repository...';
      await initializeGit(projectPath);

      spinner.succeed(chalk.green('✨ Fullstack app created successfully!'));

      console.log(chalk.cyan('\nNext steps:'));
      console.log(`  cd ${answers.projectName}`);
      console.log('  docker compose up -d    # Start locally');
      if (answers.deploymentTarget !== 'local') {
        console.log('\nFirst deploy to VPS (from your Mac):');
        console.log(`  scp -r . ubuntu@${answers.serverIp}:/home/ubuntu/${answers.projectName}`);
        console.log(`  ssh ubuntu@${answers.serverIp} 'cd ${answers.projectName} && sudo ./scripts/host-init.sh ${answers.domain}'`);
        if (answers.includeCiCd) {
          console.log('\nThen push to deploy:');
          console.log('  git push origin main');
        }
      }
      console.log('');
    } catch (e) {
      spinner.fail(chalk.red('Failed to create application'));
      console.error(e);
      process.exit(1);
    }
  });

program
  .command('add-database')
  .description('Add or configure a database to an existing project')
  .action(() => {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'add-database.js')], { stdio: 'inherit' });
    process.exit(result.status ?? 0);
  });

program.parse();

/* helpers */

async function copyTemplates(projectPath) {
  // expect ./templates/base, ./templates/frontend, ./templates/backend to exist in the package
  const templateDir = path.join(__dirname, 'templates');
  await fs.copy(path.join(templateDir, 'base'), projectPath);
  await fs.copy(path.join(templateDir, 'frontend'), path.join(projectPath, 'frontend'));
  await fs.copy(path.join(templateDir, 'backend'), path.join(projectPath, 'backend'));
  await fs.ensureDir(path.join(projectPath, 'scripts'));
}

async function generateConfigurations(projectPath, answers) {
  const dbPassword = crypto.randomBytes(32).toString('hex');
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  const domain = answers.domain || 'localhost';

  const envContent = `
# Application
APP_NAME=${answers.projectName}
DOMAIN=${domain}
NODE_ENV=production

# Database
DB_HOST=${answers.databaseOption === 'docker' ? 'db' : 'external'}
DB_PORT=5432
DB_NAME=${answers.projectName}
DB_USER=${answers.projectName}_user
DB_PASSWORD=${dbPassword}
${answers.databaseUrl ? `DATABASE_URL=${answers.databaseUrl}` : ''}

# Security
JWT_SECRET=${jwtSecret}

# Server
SERVER_IP=${answers.serverIp || 'localhost'}
`.trim();

  await fs.writeFile(path.join(projectPath, '.env'), envContent);

  const compose = generateDockerCompose(answers);
  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), compose);

  const caddy = generateCaddyfile(domain);
  await fs.writeFile(path.join(projectPath, 'Caddyfile'), caddy);
}

function generateDockerCompose(answers) {
  const includeDb = answers.databaseOption === 'docker';
  const name = answers.projectName;

  return `version: '3.8'

services:
  frontend:
    build: ./frontend
    container_name: ${name}-frontend
    environment:
      - NEXT_PUBLIC_API_URL=https://\${DOMAIN:-localhost}/api
    restart: unless-stopped
    networks: [app-network]
    healthcheck:
      test: ["CMD", "wget","-q","-O","-","http://localhost:3000"]
      interval: 10s
      timeout: 5s
      retries: 6

  backend:
    build: ./backend
    container_name: ${name}-backend
    environment:
      - SPRING_PROFILES_ACTIVE=production
      - SPRING_DATASOURCE_URL=\${DATABASE_URL:-jdbc:postgresql://db:5432/${name}}
      - SPRING_DATASOURCE_USERNAME=\${DB_USER}
      - SPRING_DATASOURCE_PASSWORD=\${DB_PASSWORD}
      - JWT_SECRET=\${JWT_SECRET}
      - SERVER_PORT=8080
    ${includeDb ? 'depends_on:\n      - db' : ''}
    restart: unless-stopped
    networks: [app-network]
    healthcheck:
      test: ["CMD", "wget","-q","-O","-","http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 6
${includeDb ? `
  db:
    image: postgres:15-alpine
    container_name: ${name}-db
    environment:
      - POSTGRES_DB=${name}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks: [app-network]
` : ''}
  caddy:
    image: caddy:2-alpine
    container_name: ${name}-caddy
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [frontend, backend]
    restart: unless-stopped
    networks: [app-network]

volumes:
${includeDb ? '  postgres_data:\n' : ''}  caddy_data:
  caddy_config:

networks:
  app-network:
    driver: bridge
`;
}

function generateCaddyfile(domain) {
  return `${domain} {
  handle_path /api/* {
    reverse_proxy backend:8080
  }

  handle {
    reverse_proxy frontend:3000
  }

  encode gzip

  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    X-XSS-Protection "1; mode=block"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
}
`;
}

async function setupDatabase(projectPath, answers) {
  const backendPropsPath = path.join(projectPath, 'backend/src/main/resources/application.properties');
  if (!await fs.pathExists(backendPropsPath)) return;

  let properties = await fs.readFile(backendPropsPath, 'utf-8');
  const block = `
# Database Configuration
spring.datasource.url=\${SPRING_DATASOURCE_URL}
spring.datasource.username=\${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=\${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
`;
  if (!properties.includes('spring.datasource.url')) {
    properties += block;
    await fs.writeFile(backendPropsPath, properties);
  }
}

async function setupCiCd(projectPath, answers) {
  const workflowDir = path.join(projectPath, '.github/workflows');
  await fs.ensureDir(workflowDir);

  const deployYaml = `name: Deploy to Server
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: SSH deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.HOST }}
          username: \${{ secrets.USERNAME }}
          key: \${{ secrets.SSH_KEY }}
          script: |
            cd /home/ubuntu/${answers.projectName}
            ./scripts/deploy-server.sh
`;
  await fs.writeFile(path.join(workflowDir, 'deploy.yml'), deployYaml);

  const scriptsDir = path.join(projectPath, 'scripts');
  await fs.ensureDir(scriptsDir);

  const hostInit = `#!/usr/bin/env bash
set -euo pipefail
DOMAIN="\${1:?Usage: sudo ./scripts/host-init.sh <domain>}"
apt-get update
apt-get -y upgrade
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
apt-get -y install docker-compose-plugin ufw wget
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable
docker compose pull || true
docker compose build || true
docker compose up -d
echo "App at https://\${DOMAIN}"
`;
  await fs.writeFile(path.join(scriptsDir, 'host-init.sh'), hostInit);
  await fs.chmod(path.join(scriptsDir, 'host-init.sh'), 0o755);

  const deployServer = `#!/usr/bin/env bash
set -euo pipefail
git pull origin main || true
docker compose pull || true
docker compose build || true
docker compose up -d
docker system prune -f || true
`;
  await fs.writeFile(path.join(scriptsDir, 'deploy-server.sh'), deployServer);
  await fs.chmod(path.join(scriptsDir, 'deploy-server.sh'), 0o755);
}

async function initializeGit(projectPath) {
  try {
    process.chdir(projectPath);
    await fs.writeFile('.gitignore', `
# Node
node_modules/
.pnp
.pnp.js
.next/
out/
dist/
build/

# Env
.env
.env.local
.env.*.local

# IDE/OS
.idea/
.vscode/
*.iml
.DS_Store
Thumbs.db

# Java/Gradle
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar

# Docker
*.log
`.trim());

    execSync('git init', { stdio: 'ignore' });
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit from create-fullstack-app"', { stdio: 'ignore' });
  } catch {}
}
