'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

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
    <main className={styles.authPage}>
      <section className={styles.authShell}>
        <div className={styles.authSky}><Link className={styles.backLink} href="/login">← Retour à la connexion</Link><span className={styles.spark} aria-hidden="true" /><h1 className={styles.brand}>STELDRA</h1><p className={styles.tagline}>Votre univers, vos histoires.</p></div>
        <form onSubmit={submit} className={`${styles.card} ${styles.centered}`}>
          <div className={styles.iconCircle} aria-hidden="true">♙</div>
          <h2>Nouveau mot de passe</h2>
          <p className={styles.help}>Choisissez un nouveau mot de passe sécurisé pour votre compte.</p>
          <div className={styles.field} style={{textAlign:'left'}}><label htmlFor="password">Nouveau mot de passe</label><div className={styles.passwordWrapper}><input id="password" name="password" className={styles.input} type={showPassword ? 'text' : 'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" minLength={8} required /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword(v=>!v)} className={styles.eyeButton} /></div><div className={styles.strength} data-level={strength}><div className={styles.strengthBars}><i/><i/><i/><i/></div><small>{strengthLabel}</small></div></div>
          <div className={styles.field} style={{textAlign:'left'}}><label htmlFor="confirm">Confirmer le mot de passe</label><div className={styles.passwordWrapper}><input id="confirm" className={styles.input} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" required /><PasswordVisibilityButton visible={showConfirm} onToggle={() => setShowConfirm(v=>!v)} className={styles.eyeButton} /></div></div>
          {message && <p className={styles.message}>{message}</p>}
          <button type="submit" className={styles.button} disabled={loading}>{loading ? 'Enregistrement…' : 'Réinitialiser le mot de passe'}</button>
          <p className={styles.securityNote}>⌾ Si votre lien n’est plus valide, <Link className={styles.inlineLink} href="/forgot-password">demandez-en un nouveau</Link>.</p>
        </form>
      </section>
    </main>
  );
}
