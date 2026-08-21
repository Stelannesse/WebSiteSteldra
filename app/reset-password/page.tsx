'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import PasswordVisibilityButton from '../components/PasswordVisibilityButton';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') || '');
    if (password.length < 8) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(getAuthErrorMessage(error, "Impossible de modifier le mot de passe. Le lien a peut-être expiré."));
      setLoading(false);
      return;
    }
    window.location.href = '/';
  };

  return (
    <div className={styles.loginPage}>
      <form onSubmit={submit} className={styles.card}>
        <h1 className={styles.brand}>STELDRA</h1>
        <h2>Nouveau mot de passe</h2>
        <div className={styles.passwordWrapper}>
          <input name="password" className={styles.input} type={showPassword ? 'text' : 'password'} placeholder="Nouveau mot de passe" minLength={8} required />
          <PasswordVisibilityButton
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            className={styles.eyeButton}
          />
        </div>
        {message && <p className={styles.message}>{message}</p>}
        <p className={styles.help}>Si votre lien n’est plus valide, <Link className={styles.inlineLink} href="/forgot-password">demandez-en un nouveau</Link>.</p>
        <button type="submit" className={styles.button} disabled={loading}>{loading ? 'Enregistrement…' : 'Changer le mot de passe'}</button>
      </form>
    </div>
  );
}
