'use client';

import { useState } from 'react';
import styles from '../page.module.css';

import type {
  FilterStatus,
  MediaType,
} from '../types/media';

type HeaderProps = {
  query: string;
  typeFilter: MediaType | 'tous';
  statusFilter: FilterStatus;
  isSearching: boolean;

  totalCount: number;
  termineCount: number;
  enCoursCount: number;
  aVoirCount: number;

  onSearchChange: (text: string) => void;

  onTypeFilterChange: (
    type: MediaType | 'tous'
  ) => void;

  onStatusFilterChange: (
    status: FilterStatus
  ) => void;

  onReset: () => void;
  onLogout: () => void;
};

const typeFilters: Array<{
  value: MediaType | 'tous';
  label: string;
}> = [
  { value: 'tous', label: 'Tout' },
  { value: 'movie', label: 'Films' },
  { value: 'tv', label: 'Séries' },
  { value: 'drama', label: 'Dramas' },
  { value: 'anime', label: 'Animés' },
  { value: 'manga', label: 'Mangas' },
  { value: 'manhwa', label: 'Manhwas' },
];

export default function Header({
  query,
  typeFilter,
  statusFilter,
  isSearching,

  totalCount,
  termineCount,
  enCoursCount,
  aVoirCount,

  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onReset,
  onLogout,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] =
    useState(false);

  const statusFilters: Array<{
    value: FilterStatus;
    label: string;
    count: number;
  }> = [
    {
      value: 'tout',
      label: 'Tout',
      count: totalCount,
    },
    {
      value: 'en_cours',
      label: 'En cours',
      count: enCoursCount,
    },
    {
      value: 'termine',
      label: 'Terminé',
      count: termineCount,
    },
    {
      value: 'a_voir',
      label: 'À voir',
      count: aVoirCount,
    },
  ];

  const handleClearSearch = () => {
    onSearchChange('');
  };

  return (
    <header className={styles.appHeader}>
      <div className={styles.headerShell}>
        <div className={styles.headerTop}>
          <button
            type="button"
            className={styles.brandButton}
            onClick={onReset}
            aria-label="Retour à l’accueil"
          >
            <span className={styles.brandMark}>
              S
            </span>

            <span className={styles.brandContent}>
              <span className={styles.brandName}>
                STELDRA
              </span>

              <span className={styles.brandSubtitle}>
                Mon univers cinéma & lecture
              </span>
            </span>
          </button>

          <div className={styles.profileContainer}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() =>
                setProfileOpen((current) => !current)
              }
              aria-label="Ouvrir le menu utilisateur"
              aria-expanded={profileOpen}
            >
              <span className={styles.profileInitials}>
                NT
              </span>

              <span
                className={`${styles.profileChevron} ${
                  profileOpen
                    ? styles.profileChevronOpen
                    : ''
                }`}
              >
                ▾
              </span>
            </button>

            {profileOpen && (
              <div className={styles.profileMenu}>
                <div className={styles.profileMenuHeader}>
                  <strong>Mon compte</strong>

                  <span>Steldra</span>
                </div>

                <button
                  type="button"
                  className={styles.profileMenuItem}
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                >
                  <span aria-hidden="true">↪</span>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modernSearch}>
          <span
            className={styles.modernSearchIcon}
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            type="search"
            className={styles.modernSearchInput}
            value={query}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Rechercher un film, une série, un manga..."
            aria-label="Rechercher un média"
          />

          {isSearching && (
            <span
              className={styles.modernSearchLoader}
              aria-label="Recherche en cours"
            />
          )}

          {query && !isSearching && (
            <button
              type="button"
              className={styles.modernSearchClear}
              onClick={handleClearSearch}
              aria-label="Effacer la recherche"
            >
              ×
            </button>
          )}
        </div>

        <nav
          className={styles.mediaTabs}
          aria-label="Types de médias"
        >
          {typeFilters.map((filter) => {
            const isActive =
              typeFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                className={`${styles.mediaTab} ${
                  isActive
                    ? styles.mediaTabActive
                    : ''
                }`}
                onClick={() =>
                  onTypeFilterChange(filter.value)
                }
              >
                {filter.label}
              </button>
            );
          })}
        </nav>

        <nav
          className={styles.statusSegment}
          aria-label="Statut des médias"
        >
          {statusFilters.map((filter) => {
            const isActive =
              statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                className={`${styles.statusSegmentButton} ${
                  isActive
                    ? styles.statusSegmentButtonActive
                    : ''
                }`}
                onClick={() =>
                  onStatusFilterChange(filter.value)
                }
              >
                <span>{filter.label}</span>

                <span
                  className={
                    styles.statusSegmentCount
                  }
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}