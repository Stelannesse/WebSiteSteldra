'use client';

import { useEffect, useState } from 'react';

import MainNav from '../components/mainNav';

import styles from './settings.module.css';

import {
  defaultSettings,
  getSettings,
  saveSettings,
} from './lib/settings';

import type { SteldraSettings } from './types/settings';

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<SteldraSettings>(defaultSettings);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const updateSetting = <
    K extends keyof SteldraSettings
  >(
    key: K,
    value: SteldraSettings[K]
  ) => {
    const updated = {
      ...settings,
      [key]: value,
    };

    setSettings(updated);
    saveSettings(updated);
  };

  const resetSettings = () => {
    if (
      !confirm(
        'Réinitialiser toutes les préférences ?'
      )
    ) {
      return;
    }

    setSettings(defaultSettings);
    saveSettings(defaultSettings);
  };

  return (
    <>
      <MainNav />

      <main className={styles.page}>
        <section className={styles.pageHeader}>
          <p className={styles.eyebrow}>
            Configuration
          </p>

          <h1>Paramètres</h1>

          <p className={styles.description}>
            Personnalise ton expérience
            Steldra.
          </p>
        </section>

        {/* Apparence */}

        <section className={styles.card}>
          <h2>Apparence</h2>

          <label className={styles.setting}>
            <span>
              Réduire les animations
            </span>

            <input
              type="checkbox"
              checked={
                settings.reduceAnimations
              }
              onChange={(e) =>
                updateSetting(
                  'reduceAnimations',
                  e.target.checked
                )
              }
            />
          </label>
        </section>

        {/* Collection */}

        <section className={styles.card}>
          <h2>Collection</h2>

          <label className={styles.setting}>
            <span>
              Afficher les titres
            </span>

            <input
              type="checkbox"
              checked={
                settings.showCollectionTitles
              }
              onChange={(e) =>
                updateSetting(
                  'showCollectionTitles',
                  e.target.checked
                )
              }
            />
          </label>
        </section>

        {/* Tier Lists */}

        <section className={styles.card}>
          <h2>Tier Lists</h2>

          <label className={styles.setting}>
            <span>
              Afficher la signature
            </span>

            <input
              type="checkbox"
              checked={
                settings.showTierListSignature
              }
              onChange={(e) =>
                updateSetting(
                  'showTierListSignature',
                  e.target.checked
                )
              }
            />
          </label>

          <label className={styles.setting}>
            <span>
              Confirmation avant
              réinitialisation
            </span>

            <input
              type="checkbox"
              checked={
                settings.confirmTierListReset
              }
              onChange={(e) =>
                updateSetting(
                  'confirmTierListReset',
                  e.target.checked
                )
              }
            />
          </label>
        </section>

        {/* Données */}

        <section className={styles.card}>
          <h2>Données</h2>

          <button
            className={styles.resetButton}
            onClick={resetSettings}
          >
            Réinitialiser les préférences
          </button>
        </section>

        <footer className={styles.footer}>
          Steldra • Version 0.4.0
        </footer>
      </main>
    </>
  );
}