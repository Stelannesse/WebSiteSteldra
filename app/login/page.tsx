/**
 * Rôle du fichier : Page Connexion : authentifie l'utilisateur avec Supabase et affiche les erreurs de façon lisible.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

/** Composant principal de cette page ou zone d'interface. */
export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(getAuthErrorMessage(error, 'E-mail ou mot de passe incorrect.'));
      setLoading(false);
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <main data-steldra-ui="authPage" className={styles.authPage}>
      <section data-steldra-ui="authShell" className={styles.authShell}>
        <div data-steldra-ui="authSky" className={styles.authSky}>
          <span data-steldra-ui="spark" className={styles.spark} aria-hidden="true" />
          <h1 data-steldra-ui="brand" className={styles.brand}>STELDRA</h1>
          <p data-steldra-ui="tagline" className={styles.tagline}>Votre univers, vos histoires.</p>
        </div>
        <form onSubmit={handleLogin} data-steldra-ui="card" className={styles.card}>
          <h2>Connexion à votre compte</h2>
          <div data-steldra-ui="field" className={styles.field}><label htmlFor="email">E-mail</label><input id="email" name="email" data-steldra-ui="input" className={styles.input} type="email" placeholder="votre@email.com" autoComplete="email" required /></div>
          <div data-steldra-ui="field" className={styles.field}><label htmlFor="password">Mot de passe</label><div data-steldra-ui="passwordWrapper" className={styles.passwordWrapper}><input id="password" name="password" data-steldra-ui="input" className={styles.input} type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" required /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((value) => !value)} className={styles.eyeButton} /></div></div>
          <div data-steldra-ui="optionsRow" className={styles.optionsRow}><Link href="/forgot-password">Mot de passe oublié ?</Link></div>
          {message && <p data-steldra-ui="message" className={styles.message}>{message}</p>}
          <button type="submit" disabled={loading} data-steldra-ui="button" className={styles.button}>{loading ? 'Connexion en cours…' : 'Se connecter'}</button>
          <div data-steldra-ui="links" className={styles.links}><span>Pas encore de compte ?</span><Link href="/signup">Créer un compte</Link></div>
        </form>
      </section>
    </main>
  );
}
