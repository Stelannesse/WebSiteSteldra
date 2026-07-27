'use client';

import styles from '../page.module.css';
import type { FilterStatus } from '../types/media';

type TypeFilter =
  | 'tous'
  | 'movie'
  | 'tv'
  | 'drama'
  | 'anime'
  | 'manga'
  | 'manhwa';

type HeaderProps = {
  query: string;
  typeFilter: TypeFilter;
  statusFilter: FilterStatus;
  isSearching: boolean;

  totalCount: number;
  termineCount: number;
  enCoursCount: number;
  aVoirCount: number;

  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  onStatusFilterChange: (value: FilterStatus) => void;
  onReset: () => void;
  onLogout: () => void | Promise<void>;
};

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
  return (
    <>
      <header className={styles.header}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <a
            href="#"
            className={styles.logo}
            onClick={(event) => {
              event.preventDefault();
              onReset();
            }}
          >
            Steldra
          </a>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'tous' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('tous')}
          >
            Tout
          </button>

          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'movie' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('movie')}
          >
            Films
          </button>

          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'tv' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('tv')}
          >
            Séries
          </button>

          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'drama' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('drama')}
          >
            Dramas
          </button>

          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'anime' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('anime')}
          >
            Animes
          </button>

          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'manga' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('manga')}
          >
            Mangas
          </button>

          <button
            className={`${styles.filterBtn} ${
              typeFilter === 'manhwa' ? styles.active : ''
            }`}
            onClick={() => onTypeFilterChange('manhwa')}
          >
            Manhwas
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Rechercher..."
              className={styles.searchInput}
              value={query}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
            />
          </div>

          <button
            onClick={onLogout}
            className={styles.logoutBtn}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              backgroundColor: '#FF4757',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {!isSearching && (
        <nav
          className={styles.navFilters}
          style={{
            marginTop: '1.5rem',
            padding: '0 2rem',
          }}
        >
          <button
            className={`${styles.filterBtn} ${
              statusFilter === 'tout'
                ? styles.active
                : ''
            }`}
            onClick={() =>
              onStatusFilterChange('tout')
            }
          >
            Tout ({totalCount})
          </button>

          <button
            className={`${styles.filterBtn} ${
              statusFilter === 'termine'
                ? styles.active
                : ''
            }`}
            onClick={() =>
              onStatusFilterChange('termine')
            }
          >
            Terminé ({termineCount})
          </button>

          <button
            className={`${styles.filterBtn} ${
              statusFilter === 'en_cours'
                ? styles.active
                : ''
            }`}
            onClick={() =>
              onStatusFilterChange('en_cours')
            }
          >
            Commencé ({enCoursCount})
          </button>

          <button
            className={`${styles.filterBtn} ${
              statusFilter === 'a_voir'
                ? styles.active
                : ''
            }`}
            onClick={() =>
              onStatusFilterChange('a_voir')
            }
          >
            À voir ({aVoirCount})
          </button>
        </nav>
      )}
    </>
  );
}