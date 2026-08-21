'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MainNav from '../components/mainNav';
import styles from './settings.module.css';
import type { SteldraSettings } from './types/settings';
import { defaultSettings, getSettings, saveSettings } from './lib/settings';
import { createClient } from '../lib/supabase';
import { fetchAllPages } from '../lib/supabasePaging';

type BackupData = {
  steldra_backup_version?: number;
  media_progress?: any[];
  custom_lists?: any[];
  custom_list_items?: any[];
  media_reviews?: any[];
  watch_history?: any[];
};

const chunk = <T,>(rows: T[], size = 200) => {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [supabase] = useState(() => createClient());
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSettings(getSettings());
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileName(user.user_metadata?.full_name || user.user_metadata?.display_name || user.email?.split('@')[0] || '');
      setProfileEmail(user.email || '');
    };
    void loadProfile();
  }, [supabase]);

  const update = <K extends keyof SteldraSettings>(key: K, value: SteldraSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  const buildBackup = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Vous devez être connecté.');

    const [progress, lists, reviews, history] = await Promise.all([
      fetchAllPages<any>((from, to) => supabase.from('media_progress').select('*').eq('user_id', user.id).range(from, to)),
      fetchAllPages<any>((from, to) => supabase.from('custom_lists').select('*').eq('user_id', user.id).range(from, to)),
      fetchAllPages<any>((from, to) => supabase.from('media_reviews').select('*').eq('user_id', user.id).range(from, to)),
      fetchAllPages<any>((from, to) => supabase.from('watch_history').select('*').eq('user_id', user.id).range(from, to)),
    ]);

    const firstError = progress.error || lists.error || reviews.error || history.error;
    if (firstError) throw firstError;

    const listRows = lists.data || [];
    const listIds = listRows.map((list: any) => list.id);
    let listItems: any[] = [];
    if (listIds.length) {
      const response = await fetchAllPages<any>((from, to) =>
        supabase.from('custom_list_items').select('*').in('list_id', listIds).range(from, to)
      );
      if (response.error) throw response.error;
      listItems = response.data || [];
    }

    return {
      steldra_backup_version: 2,
      exported_at: new Date().toISOString(),
      user_id: user.id,
      counts: {
        media_progress: progress.data.length,
        custom_lists: listRows.length,
        custom_list_items: listItems.length,
        media_reviews: reviews.data.length,
        watch_history: history.data.length,
      },
      media_progress: progress.data,
      custom_lists: listRows,
      custom_list_items: listItems,
      media_reviews: reviews.data,
      watch_history: history.data,
    };
  };

  const downloadBackup = (backup: unknown) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `steldra-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportBackup = async () => {
    setExporting(true);
    setBackupMessage('');
    try {
      const backup = await buildBackup();
      downloadBackup(backup);
      setBackupMessage(`Sauvegarde créée : ${backup.counts.media_progress} médias, ${backup.counts.custom_lists} listes et ${backup.counts.custom_list_items} éléments de listes.`);
    } catch (error: any) {
      console.error('Erreur export STELDRA :', error);
      setBackupMessage(`Impossible de créer la sauvegarde${error?.message ? ` : ${error.message}` : '.'}`);
    } finally {
      setExporting(false);
    }
  };

  const importBackup = async (file: File) => {
    setImporting(true);
    setBackupMessage('');
    try {
      const raw = await file.text();
      const backup = JSON.parse(raw) as BackupData;
      if (!Array.isArray(backup.media_progress) || !Array.isArray(backup.custom_lists) || !Array.isArray(backup.custom_list_items)) {
        throw new Error('Ce fichier ne ressemble pas à une sauvegarde STELDRA valide.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Vous devez être connecté.');

      // Collection : fusion par média, sans effacer ce qui existe déjà.
      const progressRows = backup.media_progress.map((row) => ({
        ...row,
        user_id: user.id,
      }));
      for (const rows of chunk(progressRows)) {
        const { error } = await supabase.from('media_progress').upsert(rows, { onConflict: 'user_id,media_id' });
        if (error) throw error;
      }

      // Listes : on recrée des listes indépendantes afin de ne jamais écraser une liste actuelle.
      const { data: existingLists } = await supabase.from('custom_lists').select('name').eq('user_id', user.id);
      const usedNames = new Set((existingLists || []).map((list: any) => String(list.name).toLocaleLowerCase('fr')));
      const idMap = new Map<string, string>();
      const restoredLists = backup.custom_lists.map((list) => {
        const newId = crypto.randomUUID();
        idMap.set(String(list.id), newId);
        let name = String(list.name || 'Liste restaurée');
        const base = name;
        let counter = 1;
        while (usedNames.has(name.toLocaleLowerCase('fr'))) {
          name = counter === 1 ? `${base} (restaurée)` : `${base} (restaurée ${counter})`;
          counter += 1;
        }
        usedNames.add(name.toLocaleLowerCase('fr'));
        return {
          id: newId,
          user_id: user.id,
          name,
          description: list.description ?? null,
          is_ordered: list.is_ordered ?? true,
          is_shared: false,
          share_token: null,
        };
      });
      for (const rows of chunk(restoredLists)) {
        const { error } = await supabase.from('custom_lists').insert(rows);
        if (error) throw error;
      }

      const restoredItems = backup.custom_list_items
        .map((item) => ({
          list_id: idMap.get(String(item.list_id)),
          media_id: String(item.media_id),
          media_type: item.media_type,
          media_data: item.media_data,
          position: Number(item.position || 0),
        }))
        .filter((item) => Boolean(item.list_id));
      for (const rows of chunk(restoredItems)) {
        const { error } = await supabase.from('custom_list_items').insert(rows);
        if (error) throw error;
      }

      // Avis : on évite les doublons exacts lors d'un second import du même fichier.
      const reviewsToImport = Array.isArray(backup.media_reviews) ? backup.media_reviews : [];
      if (reviewsToImport.length) {
        const { data: currentReviews } = await fetchAllPages<any>((from, to) =>
          supabase.from('media_reviews').select('media_id,media_type,rating,comment,created_at').eq('user_id', user.id).range(from, to)
        );
        const reviewKeys = new Set((currentReviews || []).map((row: any) => `${row.media_type}|${row.media_id}|${row.rating}|${row.created_at}|${row.comment || ''}`));
        const rows = reviewsToImport
          .filter((row) => !reviewKeys.has(`${row.media_type}|${row.media_id}|${row.rating}|${row.created_at}|${row.comment || ''}`))
          .map(({ id, user_id, ...row }) => ({ ...row, user_id: user.id }));
        for (const part of chunk(rows)) {
          const { error } = await supabase.from('media_reviews').insert(part);
          if (error) throw error;
        }
      }

      // Historique : même principe, dédoublonnage par média + date exacte.
      const historyToImport = Array.isArray(backup.watch_history) ? backup.watch_history : [];
      if (historyToImport.length) {
        const { data: currentHistory } = await fetchAllPages<any>((from, to) =>
          supabase.from('watch_history').select('media_id,media_type,watched_at').eq('user_id', user.id).range(from, to)
        );
        const historyKeys = new Set((currentHistory || []).map((row: any) => `${row.media_type}|${row.media_id}|${row.watched_at}`));
        const rows = historyToImport
          .filter((row) => !historyKeys.has(`${row.media_type}|${row.media_id}|${row.watched_at}`))
          .map(({ id, user_id, ...row }) => ({ ...row, user_id: user.id }));
        for (const part of chunk(rows)) {
          const { error } = await supabase.from('watch_history').insert(part);
          if (error) throw error;
        }
      }

      setBackupMessage(`Sauvegarde importée : ${progressRows.length} médias fusionnés et ${restoredLists.length} listes recréées sans écraser vos listes actuelles.`);
    } catch (error: any) {
      console.error('Erreur import STELDRA :', error);
      setBackupMessage(`Impossible d'importer la sauvegarde${error?.message ? ` : ${error.message}` : '.'}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveProfile = async () => {
    const name = profileName.trim();
    if (!name) {
      setProfileMessage('Le prénom ou pseudo ne peut pas être vide.');
      return;
    }
    setSavingProfile(true);
    setProfileMessage('');
    const { error } = await supabase.auth.updateUser({ data: { full_name: name, display_name: name } });
    if (error) setProfileMessage('Impossible de modifier le profil pour le moment.');
    else setProfileMessage('Profil mis à jour. Le nouveau pseudo apparaîtra sur STELDRA.');
    setSavingProfile(false);
  };

  return (
    <>
      <MainNav />
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>CONFIGURATION</p>
          <h1>Paramètres</h1>
          <p className={styles.description}>Personnalise ton expérience.</p>
        </header>

        <section className={styles.card}>
          <h2>Mon profil</h2>
          <p className={styles.cardDescription}>Le prénom ou pseudo est celui affiché dans STELDRA.</p>
          <div className={styles.profileForm}>
            <label><span>Prénom ou pseudo</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={60} /></label>
            <label><span>E-mail</span><input value={profileEmail} disabled /></label>
            <button className={styles.actionButton} onClick={() => void saveProfile()} disabled={savingProfile}>{savingProfile ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
          </div>
          {profileMessage && <p className={styles.exportMessage}>{profileMessage}</p>}
        </section>

        <section className={styles.card}>
          <h2>Mes statistiques</h2>
          <p className={styles.cardDescription}>Retrouve tes heures regardées, tes habitudes et les statistiques de ta collection.</p>
          <Link href="/statistiques" className={styles.statsLink}>Voir mes statistiques</Link>
        </section>

        <section className={styles.card}><h2>Apparence</h2><p className={styles.cardDescription}>Personnalise l'interface.</p>
          <div className={styles.setting}><div><strong>Réduire les animations</strong><small>Limite les effets visuels.</small></div>
            <button className={`${styles.switch} ${settings.reduceAnimations ? styles.switchOn : ''}`} onClick={() => update('reduceAnimations', !settings.reduceAnimations)}><span className={styles.switchThumb} /></button>
          </div>
        </section>

        <section className={styles.card}><h2>Collection</h2><div className={styles.setting}><div><strong>Afficher les titres</strong></div>
          <button className={`${styles.switch} ${settings.showCollectionTitles ? styles.switchOn : ''}`} onClick={() => update('showCollectionTitles', !settings.showCollectionTitles)}><span className={styles.switchThumb} /></button>
        </div></section>

        <section className={styles.card}>
          <h2>Sauvegarde</h2>
          <p className={styles.cardDescription}>Conserve une copie de ta collection et peux la réimporter plus tard.</p>
          <div className={styles.setting}><div><strong>Exporter mes données</strong><small>Collection, listes, éléments des listes, avis et historique.</small></div><button className={styles.actionButton} onClick={() => void exportBackup()} disabled={exporting || importing}>{exporting ? 'Export…' : 'Télécharger'}</button></div>
          <div className={styles.setting}><div><strong>Importer une sauvegarde</strong><small>Fusionne la collection et recrée les listes sans supprimer les données déjà présentes.</small></div><button className={styles.secondaryActionButton} onClick={() => fileInputRef.current?.click()} disabled={importing || exporting}>{importing ? 'Import…' : 'Choisir un fichier'}</button></div>
          <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); }} />
          {backupMessage && <p className={styles.exportMessage}>{backupMessage}</p>}
        </section>

        <section className={styles.card}><h2>Tier Lists</h2>
          <div className={styles.setting}><div><strong>Afficher la signature</strong></div><button className={`${styles.switch} ${settings.showTierListSignature ? styles.switchOn : ''}`} onClick={() => update('showTierListSignature', !settings.showTierListSignature)}><span className={styles.switchThumb} /></button></div>
          <div className={styles.setting}><div><strong>Confirmation avant réinitialisation</strong></div><button className={`${styles.switch} ${settings.confirmTierListReset ? styles.switchOn : ''}`} onClick={() => update('confirmTierListReset', !settings.confirmTierListReset)}><span className={styles.switchThumb} /></button></div>
        </section>
      </main>
    </>
  );
}
