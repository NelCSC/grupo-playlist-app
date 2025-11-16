// frontend/src/App.tsx
import React, { useState } from 'react';
import axios from 'axios';
// 💡 IMPORTACIÓN MODIFICADA: Importamos YouTubeProps para tipado
import YouTube, { YouTubeProps } from 'react-youtube'; 
import './App.css'; // Usaremos este archivo para el estilo
import { availableGenres } from './genres'; // Asegúrate de crear genres.ts

// Tipos de datos
interface Participant {
  id: number;
  age: number;
  genres: string[];
}
// Interfaz que describe el objeto que retorna tu servidor Node.js
interface PlaylistResponse {
  playlist: string[]; // Esperamos que 'playlist' sea un array de strings (IDs de video)
}

const API_URL = 'https://grupo-playlist-app-backend.onrender.com/api/generate-playlist';

function App() {
  const [participants, setParticipants] = useState<Participant[]>([{ id: Date.now(), age: 25, genres: [] }]);
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 💡 NUEVO ESTADO: Guarda la referencia al objeto del reproductor de YouTube
  const [player, setPlayer] = useState<any>(null); 

  // --- Funciones de Manejo de Participantes (sin cambios) ---

  const addParticipant = () => {
    setParticipants([...participants, { id: Date.now(), age: 25, genres: [] }]);
  };

  const removeParticipant = (id: number) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const handleAgeChange = (id: number, age: number) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, age: Number(age) } : p));
  };

  const handleGenreToggle = (id: number, genre: string) => {
    setParticipants(participants.map(p => {
      if (p.id === id) {
        const newGenres = p.genres.includes(genre)
          ? p.genres.filter(g => g !== genre) // Quitar si ya existe
          : [...p.genres, genre];  // Agregar si no existe
        return { ...p, genres: newGenres };
      }
      return p;
    }));
  };

  // --- Función Principal de Generación (sin cambios) ---

  const handleGeneratePlaylist = async () => {
    setError(null);
    setIsLoading(true);
    setPlaylist([]); // Limpiar playlist anterior

    // Validación básica
    const isValid = participants.every(p => p.age >= 10 && p.genres.length > 0);
    if (!isValid) {
      setError("Asegúrate de que todos los participantes tengan una edad válida (mínimo 10) y al menos un género seleccionado.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post<PlaylistResponse>(API_URL, { participants });

      const newPlaylist = response.data.playlist;
      if (newPlaylist.length === 0) {
        setError("No se encontraron videos con las preferencias seleccionadas. Intenta con géneros más generales.");
        setIsLoading(false);
        return;
      }

      setPlaylist(newPlaylist);
      setCurrentVideoIndex(0); // Empezar siempre por el primer video
    } catch (err) {
      setError("Error al conectar con el servidor o la API de música. Revisa la consola y el backend.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Funciones de Reproductor (Modificaciones para Controles) ---

  // 💡 NUEVA FUNCIÓN: Guarda la referencia al reproductor cuando está listo
  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    setPlayer(event.target);
  };

  // 💡 NUEVA FUNCIÓN AUXILIAR
  const getNextRandomIndex = (): number => {
    // Genera un índice aleatorio diferente al actual
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * playlist.length);
    } while (newIndex === currentVideoIndex && playlist.length > 1);
    return newIndex;
  }

  // Función que se dispara al finalizar un video (o al saltar por error)
  const handleVideoEnd = () => {
    // Lógica de shuffle (aleatoriedad)
    if (playlist.length > 0) {
      // Usamos la nueva función auxiliar para asegurar un salto aleatorio
      setCurrentVideoIndex(getNextRandomIndex()); 
    }
  };

  // 💡 FUNCIÓN MODIFICADA (sin cambios en la lógica original de eliminación)
  const handleVideoError = (error: any) => {
    const videoIdFailing = playlist[currentVideoIndex];
    console.error(`🚨 Video bloqueado o error de reproducción (ID: ${videoIdFailing}). Eliminando de la lista y saltando al siguiente tema...`);
    const updatedPlaylist = playlist.filter(id => id !== videoIdFailing);
    setPlaylist(updatedPlaylist);

    if (updatedPlaylist.length > 0) {
      // Saltamos al siguiente aleatorio usando el índice de la lista actualizada
      setCurrentVideoIndex(getNextRandomIndex()); 
    } else {
      setError("Todos los videos de la lista generada están bloqueados. Intenta con géneros diferentes.");
      setCurrentVideoIndex(0);
    }
  };

  // FUNCIÓN PARA SALTAR A UN VIDEO ESPECÍFICO AL HACER CLIC EN LA LISTA
  const handlePlaySpecificVideo = (index: number) => {
    // Detiene el video actual antes de cargar el siguiente si el objeto player existe
    if (player) {
      player.stopVideo(); 
    }
    setCurrentVideoIndex(index);
  };
  
  // --- NUEVAS FUNCIONES DE CONTROL DE REPRODUCCIÓN ---

  // 💡 1. FUNCIÓN PAUSE/PLAY
  const togglePlayPause = () => {
    if (!player) return; 

    // El estado 1 es 'playing', el estado 2 es 'paused'
    const playerState = player.getPlayerState(); 
    if (playerState === 1) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  // 💡 2. FUNCIÓN SIGUIENTE (aleatorio)
  const playNext = () => {
    if (playlist.length > 0) {
        handlePlaySpecificVideo(getNextRandomIndex());
    }
  };

  // 💡 3. FUNCIÓN ANTERIOR (secuencial, con bucle)
  const playPrevious = () => {
    if (playlist.length > 0) {
      // Calcula el índice anterior: (índice_actual - 1 + longitud) % longitud
      // El + longitud asegura que el resultado sea positivo (si currentVideoIndex es 0)
      const previousIndex = (currentVideoIndex - 1 + playlist.length) % playlist.length;
      handlePlaySpecificVideo(previousIndex);
    }
  };


  const opts: YouTubeProps['opts'] = {
    height: '390',
    width: '100%',
    playerVars: {
      autoplay: 1, 
      rel: 0, 
      controls: 1, 
    },
  };

  // --- Renderizado de la Aplicación ---

  return (
    <div className="app-container">
      <h1>🎧 Generador de Playlists - NelProductions</h1>
      <p className="subtitle">Ingresa la edad y los géneros favoritos de cada amigo.</p>

      {/* ... (Renderizado de Participantes - sin cambios) ... */}
      <div className="participants-list">
        {participants.map(p => (
          <div key={p.id} className="participant-card">
            <h3>Participante #{participants.indexOf(p) + 1}</h3>

            <div className="input-group">
              <label>Edad:</label>
              <input
                type="number"
                min="10"
                max="99"
                value={p.age}
                onChange={(e) => handleAgeChange(p.id, parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="genre-selection">
              <label>Géneros Favoritos:</label>
              <div className="genre-tags">
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    className={`genre-tag ${p.genres.includes(genre) ? 'selected' : ''}`}
                    onClick={() => handleGenreToggle(p.id, genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {participants.length > 1 && (
              <button className="remove-btn" onClick={() => removeParticipant(p.id)}>
                Eliminar Participante
              </button>
            )}
          </div>
        ))}
      </div>


      <div className="action-buttons">
        <button className="add-btn" onClick={addParticipant}>
          + Agregar Otro Amigo
        </button>
        <button
          className="generate-btn"
          onClick={handleGeneratePlaylist}
          disabled={isLoading || participants.length === 0}
        >
          {isLoading ? 'Cargando Playlist...' : '✨ Generar Lista Aleatoria'}
        </button>
      </div>

      {error && <p className="error-message">🚨 {error}</p>}

      {/* -------------------------------------------------- */}
      {/* --- REPRODUCTOR Y LISTA LATERAL (MODIFICADO) --- */}
      {/* -------------------------------------------------- */}
      {playlist.length > 0 && (
        <div className="player-section">
          <h2>🎉 ¡Música Lista! Reproducción Aleatoria</h2>
          <p className="subtitle">Reproduciendo video {currentVideoIndex + 1} de {playlist.length}.</p>
          
          {/* 💡 CONTROLES DE REPRODUCCIÓN (NUEVO BLOQUE) */}
          <div className="playback-controls">
              <button className="control-btn" onClick={playPrevious} title="Anterior">⏮️ Anterior</button>
              <button className="control-btn play-pause-btn" onClick={togglePlayPause} title="Pausa / Play">
                  ⏯️ Pausa / Play
              </button>
              <button className="control-btn" onClick={playNext} title="Siguiente">⏭️ Siguiente (Aleatorio)</button>
          </div>
          {/* -------------------------------------- */}

          <div className="video-and-list-container">

            {/* COLUMNA 1: REPRODUCTOR DE VIDEO */}
            <div className="player-column">
              <div className="youtube-player-container">
                <YouTube
                  videoId={playlist[currentVideoIndex]}
                  opts={opts}
                  onReady={onPlayerReady} // 💡 PASO CRUCIAL: Guarda la referencia al reproductor
                  onEnd={handleVideoEnd}
                  onError={handleVideoError}
                />
              </div>
            </div>

            {/* COLUMNA 2: LISTA DE REPRODUCCIÓN (PLAYLIST) */}
            <div className="playlist-column">
              <h3>Lista Generada</h3>
              {playlist.map((videoId, index) => (
                <div
                  key={videoId}
                  className={`playlist-item ${index === currentVideoIndex ? 'playing' : ''}`}
                  onClick={() => handlePlaySpecificVideo(index)}
                >
                  <span className="playlist-item-index">{index + 1}.</span>
                  {/* NOTA: Se sigue mostrando el ID */}
                  <span>Video ID: {videoId.substring(0, 10)}...</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;