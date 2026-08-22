'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setSuccess(false);
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setSuccess(!error);
    setMessage(error ? getAuthErrorMessage(error, "Impossible d'envoyer le lien de réinitialisation pour le moment.") : 'Si ce compte existe, un lien de réinitialisation vient d’être envoyé. Pensez à vérifier vos courriers indésirables.');
    setLoading(false);
  };

  return (
    <main className={styles.authPage}>
      <section className={styles.authShell}>
        <div className={styles.authSky}><Link className={styles.backLink} href="/login">← Retour à la connexion</Link><span className={styles.spark} aria-hidden="true" /><h1 className={styles.brand}>STELDRA</h1><p className={styles.tagline}>Votre univers, vos histoires.</p></div>
        <form onSubmit={submit} className={`${styles.card} ${styles.centered}`}>
          <div className={styles.iconCircle} aria-hidden="true">✉</div>
          <h2>Mot de passe oublié ?</h2>
          <p className={styles.help}>Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe. Votre collection et vos listes restent intactes.</p>
          <div className={`${styles.field}`} style={{textAlign:'left'}}><label htmlFor="email">E-mail</label><input id="email" name="email" className={styles.input} type="email" placeholder="votre@email.com" autoComplete="email" required /></div>
          {message && <p className={`${styles.message} ${success ? styles.success : ''}`}>{message}</p>}
          <button type="submit" className={styles.button} disabled={loading}>{loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}</button>
          <div className={styles.links}><Link href="/login">Retour à la connexion</Link></div>
        </form>
      </section>
    </main>
  );
}
