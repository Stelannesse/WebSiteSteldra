'use client';
import { useEffect,useState } from 'react';
import MainNav from '../components/mainNav';
import styles from './settings.module.css';
import type { SteldraSettings } from './types/settings';
import {defaultSettings,getSettings,saveSettings} from './lib/settings';
import { createClient } from '../lib/supabase';
import { fetchAllPages } from '../lib/supabasePaging';

export default function SettingsPage(){
 const [settings,setSettings]=useState(defaultSettings);
 const [supabase] = useState(() => createClient());
 const [exporting, setExporting] = useState(false);
 const [exportMessage, setExportMessage] = useState('');
 useEffect(()=>setSettings(getSettings()),[]);
const update = <K extends keyof SteldraSettings>(
  key: K,
  value: SteldraSettings[K]
) => {
  const next = {
    ...settings,
    [key]: value,
  };

  setSettings(next);
  saveSettings(next);
};

const exportBackup = async () => {
  setExporting(true);
  setExportMessage('');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setExportMessage('Connecte-toi pour télécharger une sauvegarde.');
      return;
    }

    const [progress, lists, reviews, history] = await Promise.all([
      fetchAllPages<any>((from, to) => supabase.from('media_progress').select('*').eq('user_id', user.id).range(from, to)),
      fetchAllPages<any>((from, to) => supabase.from('custom_lists').select('*').eq('user_id', user.id).range(from, to)),
      fetchAllPages<any>((from, to) => supabase.from('media_reviews').select('*').eq('user_id', user.id).range(from, to)),
      fetchAllPages<any>((from, to) => supabase.from('watch_history').select('*').eq('user_id', user.id).range(from, to)),
    ]);

    const listRows = lists.data || [];
    const listIds = listRows.map((list: any) => list.id);
    let listItems: any[] = [];
    if (listIds.length) {
      const response = await fetchAllPages<any>((from, to) => supabase.from('custom_list_items').select('*').in('list_id', listIds).range(from, to));
      if (response.error) throw response.error;
      listItems = response.data || [];
    }

    const firstError = progress.error || lists.error || reviews.error || history.error;
    if (firstError) throw firstError;

    const backup = {
      steldra_backup_version: 1,
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

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `steldra-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportMessage(`Sauvegarde créée : ${progress.data.length} médias, ${listRows.length} listes et ${listItems.length} éléments de listes.`);
  } catch (error: any) {
    console.error('Erreur export STELDRA :', error);
    setExportMessage(`Impossible de créer la sauvegarde${error?.message ? ` : ${error.message}` : '.'}`);
  } finally {
    setExporting(false);
  }
};

return (<><MainNav/><main className={styles.page}><header className={styles.pageHeader}>
 <p className={styles.eyebrow}>CONFIGURATION</p><h1>Paramètres</h1>
 <p className={styles.description}>Personnalise ton expérience.</p></header>
 <section className={styles.card}><h2>Apparence</h2><p className={styles.cardDescription}>Personnalise l'interface.</p>
 <div className={styles.setting}><div><strong>Réduire les animations</strong><small>Limite les effets visuels.</small></div>
 <button className={`${styles.switch} ${settings.reduceAnimations?styles.switchOn:''}`} onClick={()=>update('reduceAnimations',!settings.reduceAnimations)}><span className={styles.switchThumb}/></button></div></section>
 <section className={styles.card}><h2>Collection</h2><div className={styles.setting}><div><strong>Afficher les titres</strong></div>
 <button className={`${styles.switch} ${settings.showCollectionTitles?styles.switchOn:''}`} onClick={()=>update('showCollectionTitles',!settings.showCollectionTitles)}><span className={styles.switchThumb}/></button></div></section>
 <section className={styles.card}><h2>Sauvegarde</h2><p className={styles.cardDescription}>Télécharge une copie de tes données STELDRA au format JSON.</p>
 <div className={styles.setting}><div><strong>Exporter mes données</strong><small>Collection, listes, éléments des listes, avis et historique.</small></div><button className={styles.actionButton} onClick={()=>void exportBackup()} disabled={exporting}>{exporting?'Export…':'Télécharger'}</button></div>{exportMessage&&<p className={styles.exportMessage}>{exportMessage}</p>}</section>
 <section className={styles.card}><h2>Tier Lists</h2>
 <div className={styles.setting}><div><strong>Afficher la signature</strong></div><button className={`${styles.switch} ${settings.showTierListSignature?styles.switchOn:''}`} onClick={()=>update('showTierListSignature',!settings.showTierListSignature)}><span className={styles.switchThumb}/></button></div>
 <div className={styles.setting}><div><strong>Confirmation avant réinitialisation</strong></div><button className={`${styles.switch} ${settings.confirmTierListReset?styles.switchOn:''}`} onClick={()=>update('confirmTierListReset',!settings.confirmTierListReset)}><span className={styles.switchThumb}/></button></div></section>
 </main></>);
}
