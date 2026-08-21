'use client';

import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';

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
      setMessage(error.message);
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
          <button type="button" className={styles.eyeButton} onClick={() => setShowPassword((value) => !value)}>{showPassword ? '🙈' : '👁'}</button>
        </div>
        {message && <p className={styles.message}>{message}</p>}
        <button type="submit" className={styles.button} disabled={loading}>{loading ? 'Enregistrement…' : 'Changer le mot de passe'}</button>
      </form>
    </div>
  );
}
