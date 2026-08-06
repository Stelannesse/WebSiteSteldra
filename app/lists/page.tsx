'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';
import MainNav from '../components/mainNav';
import type { CustomList } from '../types/media';
import styles from './lists.module.css';

export default function ListsPage() {
  const supabase = createClient();

  const [lists, setLists] = useState<CustomList[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadLists = async () => {
      setLoading(true);
      setErrorMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage(
          'Vous devez être connecté pour accéder à vos listes.'
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('custom_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement des listes :', error);
        setErrorMessage('Impossible de charger les listes.');
      } else {
        setLists(data || []);
      }

      setLoading(false);
    };

    loadLists();
  }, []);

  const createList = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage('Donnez un nom à votre liste.');
      return;
    }

    setCreating(true);
    setErrorMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage('Vous devez être connecté.');
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from('custom_lists')
      .insert({
        user_id: user.id,
        name: trimmedName,
        description: description.trim() || null,
        is_ordered: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur création de la liste :', error);
      setErrorMessage('La liste n’a pas pu être créée.');
      setCreating(false);
      return;
    }

    setLists((currentLists) => [data, ...currentLists]);
    setName('');
    setDescription('');
    setShowForm(false);
    setCreating(false);
  };

  return (
    <>
      <MainNav />

      <main className={styles.page}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Organisation</p>

            <h1>Mes listes</h1>

            <p>
              Créez vos propres ordres de visionnage : Marvel,
              Disney, Star Wars, Fast & Furious…
            </p>
          </div>

          <button
            type="button"
            className={styles.createButton}
            onClick={() =>
              setShowForm((current) => !current)
            }
          >
            {showForm ? 'Annuler' : '+ Créer une liste'}
          </button>
        </div>

        {showForm && (
          <form
            className={styles.form}
            onSubmit={createList}
          >
            <label>
              Nom de la liste

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Ex. Marvel"
                maxLength={80}
              />
            </label>

            <label>
              Description

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Ex. MCU dans l’ordre chronologique"
                maxLength={250}
                rows={3}
              />
            </label>

            <button type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer la liste'}
            </button>
          </form>
        )}

        {errorMessage && (
          <p className={styles.error}>
            {errorMessage}
          </p>
        )}

        {loading ? (
          <p className={styles.message}>
            Chargement des listes…
          </p>
        ) : lists.length === 0 ? (
          <section className={styles.empty}>
            <span>☰</span>

            <h2>Aucune liste pour le moment</h2>

            <p>
              Créez votre première liste pour organiser vos
              médias dans l’ordre de votre choix.
            </p>

            <button
              type="button"
              onClick={() => setShowForm(true)}
            >
              Créer ma première liste
            </button>
          </section>
        ) : (
          <section className={styles.grid}>
            {lists.map((list) => (
              <article
                className={styles.card}
                key={list.id}
              >
                <div className={styles.cardIcon}>
                  {list.name.charAt(0).toUpperCase()}
                </div>

                <div className={styles.cardContent}>
                  <h2>{list.name}</h2>

                  <p>
                    {list.description ||
                      'Liste personnalisée ordonnée'}
                  </p>

                  <span>Ordre personnalisé</span>
                </div>

                <Link
                  href={`/lists/${list.id}`}
                  className={styles.openButton}
                >
                  Ouvrir
                </Link>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}