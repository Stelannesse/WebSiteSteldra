'use client';
import { useEffect,useState } from 'react';
import MainNav from '../components/mainNav';
import styles from './settings.module.css';
import type { SteldraSettings } from './types/settings';
import {defaultSettings,getSettings,saveSettings} from './lib/settings';

export default function SettingsPage(){
 const [settings,setSettings]=useState(defaultSettings);
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

return (<><MainNav/><main className={styles.page}><header className={styles.pageHeader}>
 <p className={styles.eyebrow}>CONFIGURATION</p><h1>Paramètres</h1>
 <p className={styles.description}>Personnalise ton expérience.</p></header>
 <section className={styles.card}><h2>Apparence</h2><p className={styles.cardDescription}>Personnalise l'interface.</p>
 <div className={styles.setting}><div><strong>Réduire les animations</strong><small>Limite les effets visuels.</small></div>
 <button className={`${styles.switch} ${settings.reduceAnimations?styles.switchOn:''}`} onClick={()=>update('reduceAnimations',!settings.reduceAnimations)}><span className={styles.switchThumb}/></button></div></section>
 <section className={styles.card}><h2>Collection</h2><div className={styles.setting}><div><strong>Afficher les titres</strong></div>
 <button className={`${styles.switch} ${settings.showCollectionTitles?styles.switchOn:''}`} onClick={()=>update('showCollectionTitles',!settings.showCollectionTitles)}><span className={styles.switchThumb}/></button></div></section>
 <section className={styles.card}><h2>Tier Lists</h2>
 <div className={styles.setting}><div><strong>Afficher la signature</strong></div><button className={`${styles.switch} ${settings.showTierListSignature?styles.switchOn:''}`} onClick={()=>update('showTierListSignature',!settings.showTierListSignature)}><span className={styles.switchThumb}/></button></div>
 <div className={styles.setting}><div><strong>Confirmation avant réinitialisation</strong></div><button className={`${styles.switch} ${settings.confirmTierListReset?styles.switchOn:''}`} onClick={()=>update('confirmTierListReset',!settings.confirmTierListReset)}><span className={styles.switchThumb}/></button></div></section>
 </main></>);
}