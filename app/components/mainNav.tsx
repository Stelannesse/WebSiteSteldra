'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './mainNav.module.css';

const links = [
  { href: '/', label: 'Accueil', icon: '⌂' },
  { href: '/collection', label: 'Collection', icon: '▥' },
  { href: '/discover', label: 'Découvrir', icon: '◇' },
  { href: '/lists', label: 'Mes listes', icon: '☷' },
  { href: '/history', label: 'Historique', icon: '◷' },
  { href: '/tier-lists', label: 'Tier lists', icon: '★' },
  { href: '/settings', label: 'Paramètres', icon: '⚙' },
];

export default function MainNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      <div className={styles.inner}>
        {links.map((link) => {
          const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.icon} aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
