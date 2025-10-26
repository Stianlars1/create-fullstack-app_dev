#!/usr/bin/env node
// CHAT_GPT_5_SOLUTION
import { Command } from "commander";
import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, "templates");

const program = new Command();
program
  .name("create-fullstack-app")
  .description("Generate a production-ready Next.js + Spring Boot app")
  .version("1.1.0")
  .argument("[project-name]", "Project name")
  .option("--skip-db", "Skip database setup")
  .option("--skip-ci", "Skip CI/CD setup")
  .action(async (projectNameArg, opts) => {
    const a = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        default: projectNameArg || "my-app",
        validate: (v) =>
          /^[a-z0-9-]+$/.test(v) || "lowercase letters, numbers, hyphens",
      },
      {
        type: "input",
        name: "domain",
        message: "Domain (e.g., myapp.dev):",
        default: (ans) => `${ans.projectName || projectNameArg}.dev`,
      },
      {
        type: "list",
        name: "deploymentTarget",
        message: "Where will you deploy?",
        choices: [
          { name: "Local development only", value: "local" },
          { name: "Any VPS", value: "vps" },
          { name: "AWS Lightsail", value: "lightsail" },
        ],
      },
      {
        type: "list",
        name: "databaseOption",
        message: "Database setup:",
        when: !opts.skipDb,
        choices: [
          { name: "PostgreSQL in Docker (recommended)", value: "docker" },
          { name: "External database", value: "external" },
          { name: "Skip for now", value: "skip" },
        ],
      },
      {
        type: "input",
        name: "databaseUrl",
        message: "External DATABASE_URL:",
        when: (ans) => ans.databaseOption === "external",
      },
      {
        type: "confirm",
        name: "includeCiCd",
        message: "Setup GitHub Actions CI/CD?",
        default: true,
        when: !opts.skipCi,
      },
      {
        type: "input",
        name: "githubRepo",
        message: "GitHub repo (username/repo):",
        when: (ans) => ans.includeCiCd,
      },
    ]);

    const dest = path.resolve(process.cwd(), a.projectName);
    if (await fs.pathExists(dest)) {
      console.error(`Target dir exists: ${dest}`);
      process.exit(1);
    }

    // 1) copy templates
    await fs.copy(
      path.join(templatesDir, "frontend"),
      path.join(dest, "frontend"),
    );
    await fs.copy(
      path.join(templatesDir, "backend"),
      path.join(dest, "backend"),
    ); // copies Dockerfile, build.gradle.kts, resources
    const scriptsSrc = path.join(__dirname, "scripts");
    if (await fs.pathExists(scriptsSrc)) {
      await fs.copy(scriptsSrc, path.join(dest, "scripts"));
    } else {
      await fs.ensureDir(path.join(dest, "scripts"));
    }

    // 2) write .env
    const dbPass = crypto.randomBytes(24).toString("hex");
    const jwt = crypto.randomBytes(48).toString("hex");
    const env = `# App
APP_NAME=${a.projectName}
DOMAIN=${a.domain}
NODE_ENV=production

# Database
DB_HOST=${a.databaseOption === "docker" ? "db" : "external"}
DB_PORT=5432
DB_NAME=${a.projectName}
DB_USER=${a.projectName.replace(/-/g, "_")}_user
DB_PASSWORD=${dbPass}
${a.databaseUrl ? `DATABASE_URL=${a.databaseUrl}` : ""}

# Security
JWT_SECRET=${jwt}
`;
    await fs.writeFile(path.join(dest, ".env"), env);

    // 3) write docker-compose.yml
    const includeDb = a.databaseOption === "docker";
    const compose = `services:
  frontend:
    build:
      context: ./frontend
      target: runner
    container_name: ${a.projectName}-frontend
    env_file: [.env]
    environment:
      - NEXT_PUBLIC_API_URL=\${DOMAIN:-http://localhost}/api
      - PORT=3000
    depends_on:
      - backend
    restart: unless-stopped
    networks: [app]

  backend:
    build: ./backend
    container_name: ${a.projectName}-backend
    env_file: [.env]
    environment:
      - SPRING_PROFILES_ACTIVE=production
      - SPRING_DATASOURCE_URL=\${DATABASE_URL:-jdbc:postgresql://${includeDb ? "db" : "external"}:5432/${a.projectName}}
      - SPRING_DATASOURCE_USERNAME=\${DB_USER}
      - SPRING_DATASOURCE_PASSWORD=\${DB_PASSWORD}
      - JWT_SECRET=\${JWT_SECRET}
      - SERVER_PORT=8080
    ${includeDb ? "depends_on:\n      - db" : ""}
    restart: unless-stopped
    networks: [app]
${
  includeDb
    ? `
  db:
    image: postgres:15-alpine
    container_name: ${a.projectName}-db
    environment:
      - POSTGRES_DB=${a.projectName}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks: [app]
`
    : ""
}
  caddy:
    image: caddy:2-alpine
    container_name: ${a.projectName}-caddy
    env_file: [.env]
    environment:
      - DOMAIN=\${DOMAIN}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks: [app]

volumes:
${includeDb ? "  postgres_data:\n" : ""}  caddy_data:
  caddy_config:

networks:
  app:
    driver: bridge
`;
    await fs.writeFile(path.join(dest, "docker-compose.yml"), compose);

    // 4) write Caddyfile (uses {$DOMAIN} from env inside the caddy container)
    const caddy = `{$DOMAIN} {
  encode zstd gzip

  @api path /api* /api/* /actuator/*
  handle @api {
    reverse_proxy backend:8080
  }

  handle {
    reverse_proxy frontend:3000
  }

  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    X-XSS-Protection "1; mode=block"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
}
`;
    await fs.writeFile(path.join(dest, "Caddyfile"), caddy);

    // 5) ensure backend props contain DB indirection
    const propsPath = path.join(
      dest,
      "backend/src/main/resources/application.properties",
    );
    if (await fs.pathExists(propsPath)) {
      let txt = await fs.readFile(propsPath, "utf8");
      if (!/spring\.datasource\.url/.test(txt)) {
        txt += `

# injected by generator
spring.datasource.url=\${SPRING_DATASOURCE_URL}
spring.datasource.username=\${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=\${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
`;
        await fs.writeFile(propsPath, txt);
      }
    }

    // 6) deploy helper scripts
    await fs.writeFile(
      path.join(dest, "scripts", "deploy-from-mac.sh"),
      `#!/usr/bin/env bash
set -euo pipefail
SERVER="\${SERVER:-ubuntu@YOUR_SERVER_IP}"
APP_NAME="\${APP_NAME:-${a.projectName}}"
APP_DIR="\${APP_DIR:-/srv/apps/\${APP_NAME}}"
ssh "\${SERVER}" "mkdir -p \${APP_DIR}"
rsync -az --delete ./ "\${SERVER}:\${APP_DIR}/"
ssh "\${SERVER}" "cd \${APP_DIR} && docker compose pull || true && docker compose build && docker compose up -d && docker system prune -f"
echo "Deployed \${APP_NAME} on \${SERVER}."
`,
    );
    await fs.chmod(path.join(dest, "scripts", "deploy-from-mac.sh"), 0o755);

    await fs.writeFile(
      path.join(dest, "scripts", "deploy.sh"),
      `#!/usr/bin/env bash
set -euo pipefail
docker compose pull || true
docker compose build
docker compose up -d
docker system prune -f
echo "Compose up complete."
`,
    );
    await fs.chmod(path.join(dest, "scripts", "deploy.sh"), 0o755);

    await fs.writeFile(
      path.join(dest, "scripts", "bootstrap-server.sh"),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo ./scripts/bootstrap-server.sh"
  exit 1
fi
apt-get update
apt-get upgrade -y
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
apt-get install -y docker-compose-plugin ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
mkdir -p /srv/apps
chown -R ubuntu:ubuntu /srv/apps
echo "Bootstrap complete."
`,
    );
    await fs.chmod(path.join(dest, "scripts", "bootstrap-server.sh"), 0o755);

    // 7) CI (optional)
    if (a.includeCiCd) {
      const wfDir = path.join(dest, ".github/workflows");
      await fs.ensureDir(wfDir);
      await fs.writeFile(
        path.join(wfDir, "deploy.yml"),
        `name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: appleboy/ssh-action@v0.1.10
        with:
          host: \${{ secrets.HOST }}
          username: \${{ secrets.USERNAME }}
          key: \${{ secrets.SSH_KEY }}
          script: |
            set -e
            mkdir -p /srv/apps/${a.projectName}
            rsync -az --delete ./ /srv/apps/${a.projectName}/
            cd /srv/apps/${a.projectName}
            docker compose build
            docker compose up -d
            docker system prune -f
`,
      );
    }

    // 8) git init
    process.chdir(dest);
    await fs.writeFile(
      ".gitignore",
      `node_modules/
.next/
dist/
build/
.env
.env.*.local
.DS_Store
.idea/
.vscode/
.gradle/
*.log
`,
    );
    try {
      execSync("git init", { stdio: "ignore" });
      execSync("git add .", { stdio: "ignore" });
      execSync('git commit -m "Initial commit from create-fullstack-app"', {
        stdio: "ignore",
      });
    } catch {}

    console.log("\n✨ Fullstack app created successfully!\n");
    console.log(`Next steps:\n  cd ${a.projectName}\n  docker compose up -d\n`);
  });

program.parse();
