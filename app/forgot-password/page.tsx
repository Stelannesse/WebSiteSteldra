'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setMessage(error ? error.message : 'Si ce compte existe, un lien de réinitialisation vient d’être envoyé.');
    setLoading(false);
  };

  return (
    <div className={styles.loginPage}>
      <form onSubmit={submit} className={styles.card}>
        <h1 className={styles.brand}>STELDRA</h1>
        <h2>Mot de passe oublié</h2>
        <p className={styles.help}>Votre collection, vos listes et votre progression ne seront pas supprimées.</p>
        <input name="email" className={styles.input} type="email" placeholder="Votre email" autoComplete="email" required />
        {message && <p className={styles.message}>{message}</p>}
        <button type="submit" className={styles.button} disabled={loading}>{loading ? 'Envoi…' : 'Envoyer le lien'}</button>
        <div className={styles.links}><Link href="/login">Retour à la connexion</Link></div>
      </form>
    </div>
  );
}
