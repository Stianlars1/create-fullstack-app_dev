#!/usr/bin/env node

/**
 * Add database to existing fullstack app
 * Usage: npx @stianlarsen/create-fullstack-app add-database
 */

import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';

async function addDatabase() {
  console.log(chalk.cyan.bold('\n🗄️  Add Database to Fullstack App\n'));

  // Verify we're in a valid project
  if (!await fs.pathExists('docker-compose.yml')) {
    console.error(chalk.red('❌ No docker-compose.yml found.'));
    console.error(chalk.yellow('Are you in a fullstack app directory?\n'));
    process.exit(1);
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'databaseType',
      message: 'Choose database type:',
      choices: [
        { name: 'PostgreSQL 16 in Docker (recommended)', value: 'postgres-docker' },
        { name: 'External PostgreSQL (Neon/Supabase/AWS RDS)', value: 'postgres-external' },
        { name: 'MySQL 8 in Docker', value: 'mysql-docker' },
        { name: 'MongoDB in Docker', value: 'mongo-docker' }
      ]
    },
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Enter database connection URL:',
      when: (answers) => answers.databaseType.includes('external'),
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Connection URL is required';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'updateBackend',
      message: 'Update backend configuration automatically?',
      default: true
    }
  ]);

  const spinner = ora('Adding database...').start();

  try {
    // Read current .env
    let envContent = await fs.readFile('.env', 'utf-8').catch(() => '');
    
    // Read docker-compose.yml
    let dockerCompose = await fs.readFile('docker-compose.yml', 'utf-8');

    if (answers.databaseType === 'postgres-docker') {
      // Generate credentials
      const dbPassword = crypto.randomBytes(32).toString('base64url');
      const projectName = path.basename(process.cwd());
      const dbName = projectName.replace(/-/g, '_');
      const dbUser = `${dbName}_user`;

      spinner.text = 'Configuring PostgreSQL...';

      // Add database service to docker-compose
      if (!dockerCompose.includes('  db:')) {
        const dbService = `
  db:
    image: postgres:16-alpine
    container_name: \${APP_NAME}-db
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
`;

        // Add db service before caddy service
        dockerCompose = dockerCompose.replace(
          /(\n  caddy:)/,
          dbService + '$1'
        );

        // Add postgres_data volume
        if (!dockerCompose.includes('postgres_data:')) {
          dockerCompose = dockerCompose.replace(
            /^volumes:/m,
            'volumes:\n  postgres_data:'
          );
        }

        // Add db dependency to backend
        dockerCompose = dockerCompose.replace(
          /(backend:[\s\S]*?)(restart: unless-stopped)/,
          '$1    depends_on:\n      - db\n    $2'
        );

        await fs.writeFile('docker-compose.yml', dockerCompose);
      }

      // Update .env
      if (!envContent.includes('DB_NAME')) {
        envContent += `\n# Database Configuration (added by add-database)
DB_HOST=db
DB_PORT=5432
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}:\${DB_PORT}/\${DB_NAME}
`;
        await fs.writeFile('.env', envContent);
      }

      // Update backend if requested
      if (answers.updateBackend) {
        spinner.text = 'Updating backend configuration...';
        await updateBackendConfig({
          type: 'postgresql',
          dbName,
          dbUser,
          dbPassword
        });
      }

      spinner.succeed(chalk.green('✅ PostgreSQL database added successfully!\n'));
      
      console.log(chalk.cyan('📋 Database Credentials\n'));
      console.log(chalk.white(`  Database: ${chalk.cyan(dbName)}`));
      console.log(chalk.white(`  Username: ${chalk.cyan(dbUser)}`));
      console.log(chalk.white(`  Password: ${chalk.yellow(dbPassword)}`));
      console.log(chalk.gray('\n  (Saved in .env file)\n'));

      console.log(chalk.cyan('🚀 Next Steps\n'));
      console.log(chalk.white('  1. Restart containers:'));
      console.log(chalk.cyan('     docker compose down'));
      console.log(chalk.cyan('     docker compose up -d\n'));
      console.log(chalk.white('  2. Connect to database:'));
      console.log(chalk.cyan(`     docker exec -it \${APP_NAME}-db psql -U ${dbUser} -d ${dbName}\n`));

    } else if (answers.databaseType === 'postgres-external') {
      spinner.text = 'Configuring external database...';

      // Update .env
      if (!envContent.includes('DATABASE_URL')) {
        envContent += `\n# External Database Configuration
DATABASE_URL=${answers.databaseUrl}
`;
        await fs.writeFile('.env', envContent);
      }

      // Update backend if requested
      if (answers.updateBackend) {
        await updateBackendConfigExternal(answers.databaseUrl);
      }

      spinner.succeed(chalk.green('✅ External database configured!\n'));

    } else if (answers.databaseType === 'mysql-docker') {
      // MySQL implementation
      spinner.info(chalk.yellow('MySQL support coming soon!\n'));
      console.log(chalk.gray('For now, use PostgreSQL or external database.\n'));
      
    } else if (answers.databaseType === 'mongo-docker') {
      // MongoDB implementation
      spinner.info(chalk.yellow('MongoDB support coming soon!\n'));
      console.log(chalk.gray('This is a Spring Boot + JPA project optimized for PostgreSQL.\n'));
      console.log(chalk.gray('For MongoDB, consider using Spring Data MongoDB instead.\n'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Failed to add database'));
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

/**
 * Update backend application.properties with database config
 */
async function updateBackendConfig(config) {
  const propsPath = 'backend/src/main/resources/application.properties';

  if (!await fs.pathExists(propsPath)) {
    console.warn(chalk.yellow('⚠️  Backend application.properties not found'));
    return;
  }

  let properties = await fs.readFile(propsPath, 'utf-8');

  // Remove existing database config
  properties = properties.replace(/# Database Configuration[\s\S]*?(?=\n#|\n\n|$)/g, '');

  // Add new configuration
  const dbConfig = `
# Database Configuration (auto-configured)
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
 * Update backend config for external database
 */
async function updateBackendConfigExternal(databaseUrl) {
  const propsPath = 'backend/src/main/resources/application.properties';

  if (!await fs.pathExists(propsPath)) {
    console.warn(chalk.yellow('⚠️  Backend application.properties not found'));
    return;
  }

  let properties = await fs.readFile(propsPath, 'utf-8');

  const dbConfig = `
# External Database Configuration
spring.datasource.url=\${DATABASE_URL}
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
`;

  properties += dbConfig;
  await fs.writeFile(propsPath, properties);
}

// Run the command
addDatabase().catch((error) => {
  console.error(chalk.red('\nUnexpected error:'), error);
  process.exit(1);
});
