/**
 * Rôle du fichier : Page Mot de passe oublié : envoie à l'utilisateur un lien sécurisé de réinitialisation.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../lib/supabase';
import styles from '../login/login.module.css';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

/** Composant principal de cette page ou zone d'interface. */
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
    <main data-steldra-ui="authPage" className={styles.authPage}>
      <section data-steldra-ui="authShell" className={styles.authShell}>
        <div data-steldra-ui="authSky" className={styles.authSky}><Link data-steldra-ui="backLink" className={styles.backLink} href="/login">← Retour à la connexion</Link><span data-steldra-ui="spark" className={styles.spark} aria-hidden="true" /><h1 data-steldra-ui="brand" className={styles.brand}>STELDRA</h1><p data-steldra-ui="tagline" className={styles.tagline}>Votre univers, vos histoires.</p></div>
        <form onSubmit={submit} data-steldra-ui="card centered" className={`${styles.card} ${styles.centered}`}>
          <div data-steldra-ui="iconCircle" className={styles.iconCircle} aria-hidden="true">✉</div>
          <h2>Mot de passe oublié ?</h2>
          <p data-steldra-ui="help" className={styles.help}>Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe. Votre collection et vos listes restent intactes.</p>
          <div data-steldra-ui="field" className={`${styles.field}`} style={{textAlign:'left'}}><label htmlFor="email">E-mail</label><input id="email" name="email" data-steldra-ui="input" className={styles.input} type="email" placeholder="votre@email.com" autoComplete="email" required /></div>
          {message && <p data-steldra-ui="message success" className={`${styles.message} ${success ? styles.success : ''}`}>{message}</p>}
          <button type="submit" data-steldra-ui="button" className={styles.button} disabled={loading}>{loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}</button>
          <div data-steldra-ui="links" className={styles.links}><Link href="/login">Retour à la connexion</Link></div>
        </form>
      </section>
    </main>
  );
}
