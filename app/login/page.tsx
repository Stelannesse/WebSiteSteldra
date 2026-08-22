'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

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
    <main className={styles.authPage}>
      <section className={styles.authShell}>
        <div className={styles.authSky}>
          <span className={styles.spark} aria-hidden="true" />
          <h1 className={styles.brand}>STELDRA</h1>
          <p className={styles.tagline}>Votre univers, vos histoires.</p>
        </div>
        <form onSubmit={handleLogin} className={styles.card}>
          <h2>Connexion à votre compte</h2>
          <div className={styles.field}><label htmlFor="email">E-mail</label><input id="email" name="email" className={styles.input} type="email" placeholder="votre@email.com" autoComplete="email" required /></div>
          <div className={styles.field}><label htmlFor="password">Mot de passe</label><div className={styles.passwordWrapper}><input id="password" name="password" className={styles.input} type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" required /><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((value) => !value)} className={styles.eyeButton} /></div></div>
          <div className={styles.optionsRow}><Link href="/forgot-password">Mot de passe oublié ?</Link></div>
          {message && <p className={styles.message}>{message}</p>}
          <button type="submit" disabled={loading} className={styles.button}>{loading ? 'Connexion en cours…' : 'Se connecter'}</button>
          <div className={styles.links}><span>Pas encore de compte ?</span><Link href="/signup">Créer un compte</Link></div>
        </form>
      </section>
    </main>
  );
}
