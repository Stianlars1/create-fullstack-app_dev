import styles from './page.module.scss';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          Welcome to Your Fullstack App
        </h1>
        
        <p className={styles.description}>
          Production-ready Next.js 15 + Spring Boot 3 + PostgreSQL
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <h3>⚡ Fast & Modern</h3>
            <p>Built with Next.js 15 App Router and React 19</p>
          </div>

          <div className={styles.feature}>
            <h3>🐳 Dockerized</h3>
            <p>Complete Docker setup with Caddy for automatic SSL</p>
          </div>

          <div className={styles.feature}>
            <h3>🔒 Secure</h3>
            <p>Spring Boot Security with JWT authentication</p>
          </div>

          <div className={styles.feature}>
            <h3>🚀 Deploy Ready</h3>
            <p>CI/CD configured with GitHub Actions</p>
          </div>
        </div>

        <div className={styles.cta}>
          <a href="/api/health" className={styles.button}>
            Check API Health
          </a>
        </div>
      </div>
    </main>
  );
}
