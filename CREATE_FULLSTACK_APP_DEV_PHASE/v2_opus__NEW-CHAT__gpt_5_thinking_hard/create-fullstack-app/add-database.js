#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';
import yaml from 'js-yaml';

async function run() {
  console.log(chalk.cyan.bold('\n🗄️  Add Database to Fullstack App\n'));
  const root = process.cwd();
  const composePath = path.join(root, 'docker-compose.yml');
  const envPath = path.join(root, '.env');
  const backendPropsPath = path.join(root, 'backend/src/main/resources/application.properties');

  if (!await fs.pathExists(composePath)) {
    console.error(chalk.red('❌ docker-compose.yml not found. Run this inside a generated app.'));
    process.exit(1);
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'databaseType',
      message: 'Choose database type:',
      choices: [
        { name: 'PostgreSQL in Docker', value: 'postgres-docker' },
        { name: 'External PostgreSQL (Neon/Supabase)', value: 'postgres-external' }
      ]
    },
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Enter external DATABASE_URL:',
      when: (a) => a.databaseType === 'postgres-external',
      validate: (s) => s.startsWith('postgres') || 'Provide a postgres:// or jdbc:postgresql:// URL'
    },
    {
      type: 'confirm',
      name: 'updateBackend',
      message: 'Update backend application.properties?',
      default: true
    }
  ]);

  if (answers.databaseType === 'postgres-docker') {
    const dbPassword = crypto.randomBytes(32).toString('hex');
    const envRaw = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, 'utf-8') : '';
    const envAppend = `
# Database Configuration (added by add-database)
DB_HOST=db
DB_PORT=5432
DB_NAME=${path.basename(root)}
DB_USER=${path.basename(root)}_user
DB_PASSWORD=${dbPassword}
DATABASE_URL=jdbc:postgresql://db:5432/${path.basename(root)}
`.trim();

    await fs.writeFile(envPath, envRaw + '\n' + envAppend + '\n');

    const composeObj = yaml.load(await fs.readFile(composePath, 'utf-8'));
    composeObj.services = composeObj.services || {};

    // Add db service if missing
    if (!composeObj.services.db) {
      composeObj.services.db = {
        image: 'postgres:15-alpine',
        container_name: `${path.basename(root)}-db`,
        environment: [
          `POSTGRES_DB=${path.basename(root)}`,
          `POSTGRES_USER=${path.basename(root)}_user`,
          `POSTGRES_PASSWORD=${dbPassword}`
        ],
        volumes: ['postgres_data:/var/lib/postgresql/data'],
        restart: 'unless-stopped',
        networks: ['app-network']
      };
    }

    // Ensure volumes & networks exist
    composeObj.volumes = Object.assign({ postgres_data: {} }, composeObj.volumes || {});
    composeObj.networks = Object.assign({ 'app-network': { driver: 'bridge' } }, composeObj.networks || {});

    await fs.writeFile(composePath, yaml.dump(composeObj, { noRefs: true }));

    if (answers.updateBackend && await fs.pathExists(backendPropsPath)) {
      let props = await fs.readFile(backendPropsPath, 'utf-8');
      if (!props.includes('spring.datasource.url')) {
        props += `
# Database Configuration
spring.datasource.url=\${SPRING_DATASOURCE_URL}
spring.datasource.username=\${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=\${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
`;
        await fs.writeFile(backendPropsPath, props);
      }
    }

    console.log(chalk.green('\n✅ PostgreSQL added inside Docker. Restart stack:'));
    console.log('  docker compose down && docker compose up -d\n');
    return;
  }

  if (answers.databaseType === 'postgres-external') {
    const envRaw = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, 'utf-8') : '';
    await fs.writeFile(envPath, envRaw + `\nDATABASE_URL=${answers.databaseUrl}\n`);
    if (answers.updateBackend && await fs.pathExists(backendPropsPath)) {
      let props = await fs.readFile(backendPropsPath, 'utf-8');
      if (!props.includes('spring.datasource.url')) {
        props += `
# External Database Configuration
spring.datasource.url=\${DATABASE_URL}
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
`;
        await fs.writeFile(backendPropsPath, props);
      }
    }
    console.log(chalk.green('\n✅ External PostgreSQL configured. Restart stack if running.\n'));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
