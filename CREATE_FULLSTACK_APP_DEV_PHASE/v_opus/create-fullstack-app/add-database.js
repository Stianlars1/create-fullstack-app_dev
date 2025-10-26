#!/usr/bin/env node
// OPUS Solution

// Add Database Command - Can be run after initial setup
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';
import { execSync } from 'child_process';

async function addDatabase() {
  console.log(chalk.cyan.bold('\n🗄️  Add Database to Fullstack App\n'));

  // Check if we're in a valid project
  if (!await fs.pathExists('docker-compose.yml')) {
    console.error(chalk.red('❌ No docker-compose.yml found. Are you in a fullstack app directory?'));
    process.exit(1);
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'databaseType',
      message: 'Choose database type:',
      choices: [
        { name: 'PostgreSQL in Docker', value: 'postgres-docker' },
        { name: 'External PostgreSQL (Neon/Supabase)', value: 'postgres-external' },
        { name: 'MySQL in Docker', value: 'mysql-docker' },
        { name: 'MongoDB in Docker', value: 'mongo-docker' }
      ]
    },
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Enter database URL:',
      when: (answers) => answers.databaseType.includes('external')
    },
    {
      type: 'confirm',
      name: 'updateBackend',
      message: 'Update backend configuration?',
      default: true
    }
  ]);

  try {
    // Generate database credentials
    const dbPassword = crypto.randomBytes(32).toString('hex');
    const dbUser = 'app_user';
    const dbName = 'app_db';

    // Read existing docker-compose.yml
    const dockerComposePath = 'docker-compose.yml';
    let dockerCompose = await fs.readFile(dockerComposePath, 'utf-8');

    // Parse YAML (simple approach for demo - in production use a YAML parser)
    if (answers.databaseType === 'postgres-docker') {
      // Add PostgreSQL service
      const dbService = `
  db:
    image: postgres:15-alpine
    container_name: app-db
    environment:
      - POSTGRES_DB=${dbName}
      - POSTGRES_USER=${dbUser}
      - POSTGRES_PASSWORD=${dbPassword}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - app-network
`;
      
      // Insert before the last 'volumes:' section
      dockerCompose = dockerCompose.replace(/^volumes:/m, dbService + '\nvolumes:');
      
      // Add volume
      dockerCompose = dockerCompose.replace(/^volumes:\n/m, 'volumes:\n  postgres_data:\n');
      
      await fs.writeFile(dockerComposePath, dockerCompose);

      // Update .env file
      const envPath = '.env';
      let envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
      
      envContent += `
# Database Configuration (added by add-database)
DB_HOST=db
DB_PORT=5432
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DATABASE_URL=postgresql://${dbUser}:${dbPassword}@db:5432/${dbName}
`;
      
      await fs.writeFile(envPath, envContent);

      // Update backend configuration if requested
      if (answers.updateBackend) {
        await updateBackendConfig(answers.databaseType, {
          dbName,
          dbUser,
          dbPassword
        });
      }

      console.log(chalk.green('\n✅ Database added successfully!'));
      console.log(chalk.cyan('\nDatabase credentials:'));
      console.log(chalk.white(`  Database: ${dbName}`));
      console.log(chalk.white(`  Username: ${dbUser}`));
      console.log(chalk.white(`  Password: ${dbPassword}`));
      console.log(chalk.yellow('\n⚠️  These credentials are saved in .env file'));
      
      console.log(chalk.cyan('\nTo apply changes:'));
      console.log(chalk.white('  docker compose down'));
      console.log(chalk.white('  docker compose up -d'));
      
    } else if (answers.databaseType === 'postgres-external') {
      // Add external database configuration
      const envPath = '.env';
      let envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
      
      envContent += `
# External Database Configuration
DATABASE_URL=${answers.databaseUrl}
`;
      
      await fs.writeFile(envPath, envContent);
      
      if (answers.updateBackend) {
        await updateBackendConfigExternal(answers.databaseUrl);
      }
      
      console.log(chalk.green('\n✅ External database configured!'));
    }

    console.log(chalk.cyan('\n📝 Backend application.properties updated'));
    console.log(chalk.cyan('🔄 Restart your containers to apply changes\n'));

  } catch (error) {
    console.error(chalk.red('❌ Failed to add database:'), error);
    process.exit(1);
  }
}

async function updateBackendConfig(dbType, credentials) {
  const backendPropsPath = 'backend/src/main/resources/application.properties';
  
  if (!await fs.pathExists(backendPropsPath)) {
    console.log(chalk.yellow('⚠️  Backend application.properties not found, skipping...'));
    return;
  }

  let properties = await fs.readFile(backendPropsPath, 'utf-8');
  
  // Remove existing database config if any
  properties = properties.replace(/# Database Configuration[\s\S]*?(?=\n#|\n\n|$)/, '');
  
  // Add new database configuration
  const dbConfig = `
# Database Configuration
spring.datasource.url=\${DATABASE_URL:jdbc:postgresql://db:5432/${credentials.dbName}}
spring.datasource.username=\${DB_USER:${credentials.dbUser}}
spring.datasource.password=\${DB_PASSWORD:${credentials.dbPassword}}
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA Configuration
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true

# Connection Pool
spring.datasource.hikari.maximum-pool-size=5
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.connection-timeout=30000
`;

  properties += dbConfig;
  await fs.writeFile(backendPropsPath, properties);
}

async function updateBackendConfigExternal(databaseUrl) {
  const backendPropsPath = 'backend/src/main/resources/application.properties';
  
  if (!await fs.pathExists(backendPropsPath)) {
    console.log(chalk.yellow('⚠️  Backend application.properties not found, skipping...'));
    return;
  }

  let properties = await fs.readFile(backendPropsPath, 'utf-8');
  
  // Add external database configuration
  const dbConfig = `
# External Database Configuration
spring.datasource.url=\${DATABASE_URL}
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
`;

  properties += dbConfig;
  await fs.writeFile(backendPropsPath, properties);
}

// Run the command
addDatabase().catch(console.error);
