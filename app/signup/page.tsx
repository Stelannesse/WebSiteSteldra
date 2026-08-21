'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';

export default function SignupPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    if (password.length < 8) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères.');
      setLoading(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: redirectTo },
    });

    if (error) {
      setMessage(error.message);
    } else if (data.session) {
      window.location.href = '/';
      return;
    } else {
      setMessage('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.');
    }
    setLoading(false);
  };

  return (
    <div className={styles.loginPage}>
      <form onSubmit={handleSignup} className={styles.card}>
        <h1 className={styles.brand}>STELDRA</h1>
        <h2>Créer un compte</h2>
        <input name="name" className={styles.input} type="text" placeholder="Prénom ou pseudo" maxLength={60} required />
        <input name="email" className={styles.input} type="email" placeholder="Email" autoComplete="email" required />
        <div className={styles.passwordWrapper}>
          <input name="password" className={styles.input} type={showPassword ? 'text' : 'password'} placeholder="Mot de passe (8 caractères minimum)" autoComplete="new-password" required minLength={8} />
          <button type="button" className={styles.eyeButton} onClick={() => setShowPassword((value) => !value)}>{showPassword ? '🙈' : '👁'}</button>
        </div>
        {message && <p className={styles.message}>{message}</p>}
        <button type="submit" disabled={loading} className={styles.button}>{loading ? 'Création…' : 'Créer mon compte'}</button>
        <div className={styles.links}><Link href="/login">J’ai déjà un compte</Link></div>
      </form>
    </div>
  );
}
