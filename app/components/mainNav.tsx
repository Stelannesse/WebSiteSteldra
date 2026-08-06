'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  {
    href: '/',
    label: 'Accueil',
    icon: '⌂',
  },
  {
    href: '/collection',
    label: 'Collection',
    icon: '◫',
  },
  {
    href: '/lists',
    label: 'Mes listes',
    icon: '☰',
  },
  {
    href: '/statistiques',
    label: 'Statistiques',
    icon: '⌁',
  },
  {
    href: '/tier-lists',
    label: 'Tier lists',
    icon: '★',
  },
  {
    href: '/settings',
    label: 'Paramètres',
    icon: '⚙',
  },
];

export default function MainNav() {
  const pathname = usePathname();

  return (
<nav
  aria-label="Navigation principale"
  style={{
    position: 'sticky',
    top: 0,
    zIndex: 100,

    width: '100%',
    maxWidth: '100vw',
    boxSizing: 'border-box',

    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.4rem',

    margin: 0,
    padding: '0.75rem 1rem',

    overflowX: 'auto',

    backgroundColor: '#1b1f24',
    borderBottom: '1px solid #393E46',
  }}
>      {links.map((link) => {
        const isActive =
          link.href === '/'
            ? pathname === '/'
            : pathname.startsWith(link.href);

        return (
          <Link
  key={link.href}
  href={link.href}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    minHeight: '42px',
    padding: '0.55rem 0.85rem',
    borderRadius: '20px',
    backgroundColor: isActive
      ? '#00ADB5'
      : '#29313a',
    color: isActive
      ? '#071012'
      : '#EEEEEE',
    fontFamily: 'var(--font-inter), Arial, sans-serif',
    fontWeight: 'bold',
    fontSize: '0.85rem',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }}
>
            <span aria-hidden="true">
              {link.icon}
            </span>

            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}