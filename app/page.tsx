'use client';

import { useState } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const searchMovies = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setMovies([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      setMovies(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>🎬 Mon Cine-Club Privé</h1>
      
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <input
          type="text"
          placeholder="Tapez le nom d'un film..."
          value={query}
          onChange={(e) => searchMovies(e.target.value)}
          style={{
            width: '100%',
            padding: '0.8rem',
            fontSize: '1.2rem',
            borderRadius: '8px',
            border: '1px solid #ccc',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
      </div>

      {loading && <p style={{ textAlign: 'center' }}>Recherche en cours...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem' }}>
        {movies.map((movie) => (
          <div key={movie.id} style={{ textAlign: 'center' }}>
            <img
              src={movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : 'https://via.placeholder.com/150x225?text=Pas+d+affiche'}
              alt={movie.title}
              style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
            />
            <p style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '0.5rem' }}>{movie.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}