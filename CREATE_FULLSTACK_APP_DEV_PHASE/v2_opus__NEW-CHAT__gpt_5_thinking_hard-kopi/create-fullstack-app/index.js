#!/usr/bin/env node

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
  .description('Generate a production-ready Next.js + Spring Boot application')
  .version('1.0.0')
  .argument('[project-name]', 'Name of your project')
  .option('--skip-db', 'Skip database setup')
  .option('--use-external-db', 'Use external database (Neon/Supabase)')
  .option('--skip-ci', 'Skip CI/CD setup')
  .action(async (projectName, options) => {
    console.log(chalk.cyan.bold('\n🚀 Create Fullstack App by @stianlarsen\n'));

    // Gather project information
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: projectName || 'my-app',
        validate: (input) => /^[a-z0-9-]+$/.test(input) || 'Use lowercase letters, numbers, and hyphens only'
      },
      {
        type: 'input',
        name: 'domain',
        message: 'Domain (e.g., myapp.dev):',
        default: (answers) => `${answers.projectName || projectName}.dev`,
        when: !options.skipCi
      },
      {
        type: 'list',
        name: 'deploymentTarget',
        message: 'Where will you deploy?',
        choices: [
          { name: 'AWS Lightsail (VPS)', value: 'lightsail' },
          { name: 'Any VPS (DigitalOcean, Linode, etc)', value: 'vps' },
          { name: 'Local development only', value: 'local' }
        ]
      },
      {
        type: 'input',
        name: 'serverIp',
        message: 'Server IP address:',
        when: (answers) => answers.deploymentTarget !== 'local',
        validate: (input) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(input) || 'Enter a valid IP address'
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
        when: (answers) => answers.databaseOption === 'external'
      },
      {
        type: 'confirm',
        name: 'includeCiCd',
        message: 'Setup GitHub Actions CI/CD?',
        default: true,
        when: !options.skipCi && ((answers) => answers.deploymentTarget !== 'local')
      },
      {
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository (e.g., username/repo):',
        when: (answers) => answers.includeCiCd
      }
    ]);

    const spinner = ora('Creating your fullstack application...').start();

    try {
      // Create project directory
      const projectPath = path.join(process.cwd(), answers.projectName);
      await fs.ensureDir(projectPath);

      // Copy templates
      spinner.text = 'Copying templates...';
      await copyTemplates(projectPath, answers);

      // Generate configurations
      spinner.text = 'Generating configurations...';
      await generateConfigurations(projectPath, answers);

      // Setup database if needed
      if (answers.databaseOption !== 'skip') {
        spinner.text = 'Configuring database...';
        await setupDatabase(projectPath, answers);
      }

      // Setup CI/CD if needed
      if (answers.includeCiCd) {
        spinner.text = 'Setting up CI/CD...';
        await setupCiCd(projectPath, answers);
      }

      // Initialize git repository
      spinner.text = 'Initializing git repository...';
      await initializeGit(projectPath);

      spinner.succeed(chalk.green('✨ Fullstack app created successfully!'));

      // Display next steps
      console.log(chalk.cyan('\n📋 Next steps:\n'));
      console.log(chalk.white(`  cd ${answers.projectName}`));
      console.log(chalk.white('  docker compose up -d    # Start locally'));
      
      if (answers.deploymentTarget !== 'local') {
        console.log(chalk.white(`\n  🚀 To deploy:`));
        console.log(chalk.white(`  ./scripts/deploy.sh     # First deployment`));
        
        if (answers.includeCiCd) {
          console.log(chalk.white(`\n  Then just: git push origin main`));
        }
      }

      console.log(chalk.cyan('\n📚 Documentation: https://github.com/stianlarsen/create-fullstack-app'));
      console.log(chalk.cyan('💬 Issues: https://github.com/stianlarsen/create-fullstack-app/issues\n'));

    } catch (error) {
      spinner.fail(chalk.red('Failed to create application'));
      console.error(error);
      process.exit(1);
    }
  });

async function copyTemplates(projectPath, answers) {
  const templateDir = path.join(__dirname, 'templates');
  
  // Copy base structure
  await fs.copy(path.join(templateDir, 'base'), projectPath);
  
  // Copy frontend template
  await fs.copy(path.join(templateDir, 'frontend'), path.join(projectPath, 'frontend'));
  
  // Copy backend template
  await fs.copy(path.join(templateDir, 'backend'), path.join(projectPath, 'backend'));
}

async function generateConfigurations(projectPath, answers) {
  // Generate secure passwords
  const dbPassword = crypto.randomBytes(32).toString('hex');
  const jwtSecret = crypto.randomBytes(64).toString('hex');

  // Create .env file
  const envContent = `
# Application
APP_NAME=${answers.projectName}
DOMAIN=${answers.domain || 'localhost'}
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

  // Generate docker-compose.yml
  const dockerComposeContent = generateDockerCompose(answers, dbPassword);
  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), dockerComposeContent);

  // Generate Caddyfile
  if (answers.domain) {
    const caddyContent = generateCaddyfile(answers);
    await fs.writeFile(path.join(projectPath, 'Caddyfile'), caddyContent);
  }
}

function generateDockerCompose(answers, dbPassword) {
  const includeDb = answers.databaseOption === 'docker';
  
  return `version: '3.8'

services:
  frontend:
    build: ./frontend
    container_name: ${answers.projectName}-frontend
    environment:
      - NEXT_PUBLIC_API_URL=\${DOMAIN:-http://localhost}/api
    restart: unless-stopped
    networks:
      - app-network

  backend:
    build: ./backend
    container_name: ${answers.projectName}-backend
    environment:
      - SPRING_PROFILES_ACTIVE=production
      - SPRING_DATASOURCE_URL=\${DATABASE_URL:-jdbc:postgresql://db:5432/${answers.projectName}}
      - SPRING_DATASOURCE_USERNAME=\${DB_USER}
      - SPRING_DATASOURCE_PASSWORD=\${DB_PASSWORD}
      - JWT_SECRET=\${JWT_SECRET}
      - SERVER_PORT=8080
    ${includeDb ? 'depends_on:\n      - db' : ''}
    restart: unless-stopped
    networks:
      - app-network
${includeDb ? `
  db:
    image: postgres:15-alpine
    container_name: ${answers.projectName}-db
    environment:
      - POSTGRES_DB=${answers.projectName}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - app-network
` : ''}
  caddy:
    image: caddy:2-alpine
    container_name: ${answers.projectName}-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - app-network

volumes:
${includeDb ? '  postgres_data:' : ''}
  caddy_data:
  caddy_config:

networks:
  app-network:
    driver: bridge`;
}

function generateCaddyfile(answers) {
  const domain = answers.domain || 'localhost';
  
  return `${domain} {
    # API routes
    handle /api/* {
        reverse_proxy backend:8080
    }
    
    # Frontend
    handle {
        reverse_proxy frontend:3000
    }
    
    # Compression
    encode gzip
    
    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
}`;
}

async function setupDatabase(projectPath, answers) {
  if (answers.databaseOption === 'skip') return;

  // Update backend application.properties
  const backendPropsPath = path.join(projectPath, 'backend/src/main/resources/application.properties');
  
  let properties = await fs.readFile(backendPropsPath, 'utf-8');
  
  // Add database configuration
  const dbConfig = `
# Database Configuration
spring.datasource.url=\${SPRING_DATASOURCE_URL}
spring.datasource.username=\${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=\${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA Configuration
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
`;

  properties += dbConfig;
  await fs.writeFile(backendPropsPath, properties);
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
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: \${{ secrets.HOST }}
          username: \${{ secrets.USERNAME }}
          key: \${{ secrets.SSH_KEY }}
          script: |
            cd /home/ubuntu/${answers.projectName}
            git pull origin main
            docker compose build
            docker compose up -d
            docker system prune -f
`;

  await fs.writeFile(path.join(workflowDir, 'deploy.yml'), deployYaml);

  // Create deployment script
  const deployScript = `#!/bin/bash
set -e

echo "🚀 Deploying ${answers.projectName}..."

# Pull latest changes
git pull origin main

# Build and restart containers
docker compose build
docker compose up -d

# Clean up
docker system prune -f

echo "✅ Deployment complete!"
echo "🌐 Your app is running at: https://${answers.domain}"
`;

  const scriptsDir = path.join(projectPath, 'scripts');
  await fs.ensureDir(scriptsDir);
  await fs.writeFile(path.join(scriptsDir, 'deploy.sh'), deployScript);
  await fs.chmod(path.join(scriptsDir, 'deploy.sh'), '755');
}

async function initializeGit(projectPath) {
  try {
    process.chdir(projectPath);
    execSync('git init', { stdio: 'ignore' });
    
    // Create .gitignore
    const gitignore = `
# Dependencies
node_modules/
.pnp
.pnp.js

# Production
/build
/dist
/.next/
/out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.iml

# OS
.DS_Store
Thumbs.db

# Java/Gradle
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar

# Docker
*.log
`;

    await fs.writeFile('.gitignore', gitignore.trim());
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit from create-fullstack-app"', { stdio: 'ignore' });
  } catch (error) {
    // Git might not be installed, that's okay
  }
}

program.parse();
