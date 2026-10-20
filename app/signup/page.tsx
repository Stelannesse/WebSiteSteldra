/**
 * Rôle du fichier : Page Inscription : crée un compte Supabase et guide l'utilisateur selon le résultat.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

/** Composant principal de cette page ou zone d'interface. */
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
    <main data-steldra-ui="authPage" className={styles.authPage}>
      <section data-steldra-ui="authShell" className={styles.authShell}>
        <div data-steldra-ui="authSky" className={styles.authSky}><Link data-steldra-ui="backLink" className={styles.backLink} href="/login">← Retour à la connexion</Link><span data-steldra-ui="spark" className={styles.spark} aria-hidden="true" /><h1 data-steldra-ui="brand" className={styles.brand}>STELDRA</h1><p data-steldra-ui="tagline" className={styles.tagline}>Votre univers, vos histoires.</p></div>
        <form onSubmit={handleSignup} data-steldra-ui="card" className={styles.card}>
          <h2>Créer votre compte</h2>
          <p data-steldra-ui="help" className={styles.help}>Commencez votre collection et retrouvez vos films, séries, dramas et animés au même endroit.</p>
          <div data-steldra-ui="field" className={styles.field}><label htmlFor="name">Prénom ou pseudo</label><input id="name" name="name" data-steldra-ui="input" className={styles.input} type="text" placeholder="Votre pseudo" maxLength={60} required /></div>
          <div data-steldra-ui="field" className={styles.field}><label htmlFor="email">E-mail</label><input id="email" name="email" data-steldra-ui="input" className={styles.input} type="email" placeholder="votre@email.com" autoComplete="email" required /></div>
          <div data-steldra-ui="field" className={styles.field}><label htmlFor="password">Mot de passe</label><div data-steldra-ui="passwordWrapper" className={styles.passwordWrapper}><input id="password" name="password" data-steldra-ui="input" className={styles.input} type={showPassword ? 'text' : 'password'} placeholder="8 caractères minimum" autoComplete="new-password" required minLength={8} /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword(v=>!v)} className={styles.eyeButton} /></div></div>
          {message && <p data-steldra-ui="message" className={styles.message}>{message}</p>}
          <button type="submit" disabled={loading} data-steldra-ui="button" className={styles.button}>{loading ? 'Création…' : 'Créer mon compte'}</button>
          <div data-steldra-ui="links" className={styles.links}><span>Vous avez déjà un compte ?</span><Link href="/login">Se connecter</Link></div>
        </form>
      </section>
    </main>
  );
}
