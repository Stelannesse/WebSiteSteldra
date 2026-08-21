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
  const supabase = createClient();
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
    <div className={styles.loginPage}>
      <form onSubmit={handleLogin} className={styles.card}>
        <h1 className={styles.brand}>STELDRA</h1>
        <h2>Connexion</h2>

        <input name="email" className={styles.input} type="email" placeholder="Email" autoComplete="email" required />
        <div className={styles.passwordWrapper}>
          <input
            name="password"
            className={styles.input}
            type={showPassword ? 'text' : 'password'}
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
          />
          <PasswordVisibilityButton
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            className={styles.eyeButton}
          />
        </div>

        {message && <p className={styles.message}>{message}</p>}
        <button type="submit" disabled={loading} className={styles.button}>{loading ? 'Connexion en cours…' : 'Se connecter'}</button>

        <div className={styles.links}>
          <Link href="/forgot-password">Mot de passe oublié ?</Link>
          <Link href="/signup">Créer un compte</Link>
        </div>
      </form>
    </div>
  );
}
