/**
 * Rôle du fichier : Page Réinitialisation : permet de choisir un nouveau mot de passe après ouverture du lien reçu par e-mail.
 */

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

/** Composant principal de cette page ou zone d'interface. */
export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const strength = useMemo(() => {
    let level = 0;
    if (password.length >= 8) level++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) level++;
    if (/\d/.test(password)) level++;
    if (/[^A-Za-z0-9]/.test(password) && password.length >= 10) level++;
    return level;
  }, [password]);
  const strengthLabel = ['Faible', 'Faible', 'Correct', 'Bon', 'Fort'][strength];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (password.length < 8) { setMessage('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirm) { setMessage('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMessage(getAuthErrorMessage(error, "Impossible de modifier le mot de passe. Le lien a peut-être expiré.")); setLoading(false); return; }
    window.location.href = '/';
  };

  return (
    <main data-steldra-ui="authPage" className={styles.authPage}>
      <section data-steldra-ui="authShell" className={styles.authShell}>
        <div data-steldra-ui="authSky" className={styles.authSky}><Link data-steldra-ui="backLink" className={styles.backLink} href="/login">← Retour à la connexion</Link><span data-steldra-ui="spark" className={styles.spark} aria-hidden="true" /><h1 data-steldra-ui="brand" className={styles.brand}>STELDRA</h1><p data-steldra-ui="tagline" className={styles.tagline}>Votre univers, vos histoires.</p></div>
        <form onSubmit={submit} data-steldra-ui="card centered" className={`${styles.card} ${styles.centered}`}>
          <div data-steldra-ui="iconCircle" className={styles.iconCircle} aria-hidden="true">♙</div>
          <h2>Nouveau mot de passe</h2>
          <p data-steldra-ui="help" className={styles.help}>Choisissez un nouveau mot de passe sécurisé pour votre compte.</p>
          <div data-steldra-ui="field" className={styles.field} style={{textAlign:'left'}}><label htmlFor="password">Nouveau mot de passe</label><div data-steldra-ui="passwordWrapper" className={styles.passwordWrapper}><input id="password" name="password" data-steldra-ui="input" className={styles.input} type={showPassword ? 'text' : 'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" minLength={8} required /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword(v=>!v)} className={styles.eyeButton} /></div><div data-steldra-ui="strength" className={styles.strength} data-level={strength}><div data-steldra-ui="strengthBars" className={styles.strengthBars}><i/><i/><i/><i/></div><small>{strengthLabel}</small></div></div>
          <div data-steldra-ui="field" className={styles.field} style={{textAlign:'left'}}><label htmlFor="confirm">Confirmer le mot de passe</label><div data-steldra-ui="passwordWrapper" className={styles.passwordWrapper}><input id="confirm" data-steldra-ui="input" className={styles.input} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" required /><PasswordVisibilityButton visible={showConfirm} onToggle={() => setShowConfirm(v=>!v)} className={styles.eyeButton} /></div></div>
          {message && <p data-steldra-ui="message" className={styles.message}>{message}</p>}
          <button type="submit" data-steldra-ui="button" className={styles.button} disabled={loading}>{loading ? 'Enregistrement…' : 'Réinitialiser le mot de passe'}</button>
          <p data-steldra-ui="securityNote" className={styles.securityNote}>⌾ Si votre lien n’est plus valide, <Link data-steldra-ui="inlineLink" className={styles.inlineLink} href="/forgot-password">demandez-en un nouveau</Link>.</p>
        </form>
      </section>
    </main>
  );
}
