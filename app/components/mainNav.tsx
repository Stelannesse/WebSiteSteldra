'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './mainNav.module.css';

type IconName = 'home' | 'collection' | 'discover' | 'talents' | 'lists' | 'history' | 'tier' | 'settings';

const links: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/collection', label: 'Collection', icon: 'collection' },
  { href: '/discover', label: 'Découvrir', icon: 'discover' },
  { href: '/talents', label: 'Talents', icon: 'talents' },
  { href: '/lists', label: 'Mes listes', icon: 'lists' },
  { href: '/history', label: 'Historique', icon: 'history' },
  { href: '/tier-lists', label: 'Tier lists', icon: 'tier' },
  { href: '/settings', label: 'Paramètres', icon: 'settings' },
];

function NavIcon({ name }: { name: IconName }) {
  const common = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const icons = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5.5h5V20"/></>,
    collection: <><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 7.5h8M8 12h8M8 16.5h5"/></>,
    discover: <><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></>,
    talents: <><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.6-4.1 3-6.2 6.5-6.2s5.9 2.1 6.5 6.2"/><path d="M4 8.8a8.8 8.8 0 0 1 16 0"/></>,
    lists: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></>,
    history: <><path d="M3.8 9A8.5 8.5 0 1 1 4 16"/><path d="M3.8 4.5V9h4.5"/><path d="M12 7.5V12l3 2"/></>,
    tier: <><path d="m12 3 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8L12 3Z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6h.1A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.56 3.7l.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4v.1A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.5a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6 1.1Z"/></>,
  };
  return <svg {...common}>{icons[name]}</svg>;
}

export default function MainNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      <div className={styles.inner}>
        {links.map((link) => {
          const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={`${styles.link} ${isActive ? styles.active : ''}`} aria-current={isActive ? 'page' : undefined}>
              <span className={styles.icon}><NavIcon name={link.icon} /></span>
              <span className={styles.label}>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
