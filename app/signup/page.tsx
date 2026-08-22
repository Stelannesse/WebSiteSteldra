'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

export default function SignupPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    if (password.length < 8) { setMessage('Le mot de passe doit contenir au moins 8 caractères.'); setLoading(false); return; }
    const redirectTo = `${window.location.origin}/auth/callback?next=/`;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, display_name: name }, emailRedirectTo: redirectTo } });
    if (error) setMessage(getAuthErrorMessage(error, "Impossible de créer le compte pour le moment. Veuillez réessayer."));
    else if (data.session) { window.location.href = '/'; return; }
    else setMessage('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.');
    setLoading(false);
  };

  return (
    <main className={styles.authPage}>
      <section className={styles.authShell}>
        <div className={styles.authSky}><Link className={styles.backLink} href="/login">← Retour à la connexion</Link><span className={styles.spark} aria-hidden="true" /><h1 className={styles.brand}>STELDRA</h1><p className={styles.tagline}>Votre univers, vos histoires.</p></div>
        <form onSubmit={handleSignup} className={styles.card}>
          <h2>Créer votre compte</h2>
          <p className={styles.help}>Commencez votre collection et retrouvez vos films, séries, dramas et animés au même endroit.</p>
          <div className={styles.field}><label htmlFor="name">Prénom ou pseudo</label><input id="name" name="name" className={styles.input} type="text" placeholder="Votre pseudo" maxLength={60} required /></div>
          <div className={styles.field}><label htmlFor="email">E-mail</label><input id="email" name="email" className={styles.input} type="email" placeholder="votre@email.com" autoComplete="email" required /></div>
          <div className={styles.field}><label htmlFor="password">Mot de passe</label><div className={styles.passwordWrapper}><input id="password" name="password" className={styles.input} type={showPassword ? 'text' : 'password'} placeholder="8 caractères minimum" autoComplete="new-password" required minLength={8} /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword(v=>!v)} className={styles.eyeButton} /></div></div>
          {message && <p className={styles.message}>{message}</p>}
          <button type="submit" disabled={loading} className={styles.button}>{loading ? 'Création…' : 'Créer mon compte'}</button>
          <div className={styles.links}><span>Vous avez déjà un compte ?</span><Link href="/login">Se connecter</Link></div>
        </form>
      </section>
    </main>
  );
}
