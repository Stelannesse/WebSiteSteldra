'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './MainNavigation.module.css';

const links = [
  {
    href: '/',
    label: 'Accueil',
  },
  {
    href: '/collection',
    label: 'Collection',
  },
  {
    href: '/statistiques',
    label: 'Statistiques',
  },
  {
    href: '/tier-lists',
    label: 'Tier lists',
  },
  {
    href: '/settings',
    label: 'Paramètres',
  },
];

export default function MainNavigation() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        Steldra
      </Link>

      <nav className={styles.navigation}>
        {links.map((link) => {
          const isActive =
            link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive
                  ? `${styles.link} ${styles.active}`
                  : styles.link
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}