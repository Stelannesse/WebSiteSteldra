'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Bienvenue sur Steldra</p>

        <h1>
          Toute ta culture,
          <span> réunie au même endroit.</span>
        </h1>

        <p className={styles.description}>
          Films, séries, animés, mangas et manhwas :
          retrouve ta collection et suis ta progression.
        </p>

        <div className={styles.actions}>
          <Link
            href="/collection"
            className={styles.primaryButton}
          >
            Voir ma collection
          </Link>

          <Link
            href="/statistiques"
            className={styles.secondaryButton}
          >
            Mes statistiques
          </Link>
        </div>
      </section>

      <section className={styles.sections}>
        <Link
          href="/collection"
          className={styles.sectionCard}
        >
          <span className={styles.icon}>◫</span>
          <h2>Ma collection</h2>
          <p>
            Consulte les médias à voir, en cours ou déjà vus.
          </p>
        </Link>

        <Link
          href="/statistiques"
          className={styles.sectionCard}
        >
          <span className={styles.icon}>⌁</span>
          <h2>Statistiques</h2>
          <p>
            Découvre ton temps de visionnage et tes habitudes.
          </p>
        </Link>

        <Link
          href="/tier-lists"
          className={styles.sectionCard}
        >
          <span className={styles.icon}>★</span>
          <h2>Tier lists</h2>
          <p>
            Classe tes œuvres préférées selon tes propres critères.
          </p>
        </Link>

        <Link
          href="/settings"
          className={styles.sectionCard}
        >
          <span className={styles.icon}>⚙</span>
          <h2>Paramètres</h2>
          <p>
            Personnalise ton profil et les préférences de Steldra.
          </p>
        </Link>
      </section>
    </main>
  );
}