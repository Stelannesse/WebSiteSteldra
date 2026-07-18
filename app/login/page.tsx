'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

// Composant de la page de connexion
export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Vérification des champs vides
    if (!email || !password) {
      alert("Veuillez remplir tous les champs.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Gestion de l'erreur ou redirection en cas de succès
    if (error) {
      alert("Erreur de connexion : " + error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh(); 
    }
  };

  // Rendu du formulaire de connexion
  return (
    <div className={styles.loginPage}>
      <form onSubmit={handleLogin} className={styles.card}>
        <h1 style={{ color: '#00ADB5' }}>STELDRA</h1>
        <h2>Connexion</h2>
        
        <input 
          name="email"
          className={styles.input} 
          type="email" 
          placeholder="Email" 
          required 
        />
        <input 
          name="password"
          className={styles.input} 
          type="password" 
          placeholder="Mot de passe" 
          required 
        />
        
        {/* Le bouton se désactive pendant el chargement */}
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}