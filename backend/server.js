// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// 💡 PRUEBA: Verifica que la clave se cargue (debería mostrar la clave o 'undefined' si falla)
console.log("Clave de API cargada:", process.env.YOUTUBE_API_KEY);

const app = express();
const PORT = 5000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint principal para generar la playlist
app.post('/api/generate-playlist', async (req, res) => {
    const participants = req.body.participants; // Array esperado de {age: number, genres: string[]}
    let combinedPlaylist = new Set(); // Usamos Set para asegurar IDs únicos (deduplicación)

    if (!participants || participants.length === 0) {
        return res.status(400).json({ message: "Se requiere al menos un participante." });
    }

    // Promesas para ejecutar todas las búsquedas de forma concurrente
    const searchPromises = [];

    // 💡 Ajustar el límite de búsqueda para tener más opciones y compensar los videos bloqueados
    const MAX_RESULTS_PER_SEARCH = 15; 
    
    // 💡 NUEVO TÉRMINO DE PRIORIZACIÓN DE PAÍS (PERÚ)
    // Se añade esta constante para incluirla en cada consulta.
    const COUNTRY_PRIORITY_TERM = 'Peruano OR Peruana';

    for (const p of participants) {
        // Lógica de segmentación por edad
        const ageContext = p.age < 25 ? 'tendencias actual' : 'clasicos de todos los tiempos';

        for (const genre of p.genres) {
            
            // 1. Base de la consulta: utiliza el subgénero, el contexto de edad Y LA PRIORIDAD DE PAÍS
            let baseQuery = `${genre} ${ageContext} ${COUNTRY_PRIORITY_TERM} official video OR lyrics`;
            
            // 2. LÓGICA DE REFINAMIENTO Y EXCLUSIÓN para mejorar la precisión
            if (genre.includes("Cumbia")) {
                // Si es cualquier forma de Cumbia, excluimos términos clave de Salsa 
                baseQuery += ' -salsa -son -tumbao -clave'; 
            } else if (genre.includes("Salsa")) {
                // Si es cualquier forma de Salsa, excluimos términos clave de Cumbia 
                // NOTA: Se mantiene la exclusión de "-peruana" por si el término es demasiado genérico, 
                // pero si el término de búsqueda ya incluye "Peruano", debería priorizar bien.
                baseQuery += ' -cumbia -vallenato -tropical -colombiana';
            } else if (genre.includes("Rock Clásico")) {
                // Ayuda a filtrar resultados de Pop o Baladas que usan el término "Clásico"
                baseQuery += ' -pop -balada';
            }

            const searchQuery = baseQuery;

            // Agregamos la promesa de búsqueda al array
            searchPromises.push(
                axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        key: YOUTUBE_API_KEY,
                        q: searchQuery,
                        part: 'snippet',
                        type: 'video',
                        videoCategoryId: '10', // Categoría Música
                        // 💡 Aplicar el nuevo límite de resultados
                        maxResults: MAX_RESULTS_PER_SEARCH,
                        videoDuration: 'medium' // Filtro: Videos entre 4 y 20 minutos
                    }
                })
                    .then(response => {
                        response.data.items.forEach(item => {
                            if (item.id.videoId) {
                                // NOTA: Aquí solo se guarda el ID, como estaba originalmente
                                combinedPlaylist.add(item.id.videoId);
                            }
                        });
                    })
                    .catch(error => {
                        console.error(`Error searching for ${searchQuery}:`, error.message);
                        // No se lanza el error, solo se registra y se sigue con las demás búsquedas
                    })
            );
        }
    }

    // Esperar a que todas las promesas de búsqueda se resuelvan
    await Promise.all(searchPromises);

    // Convertir el Set de IDs a un Array
    let finalPlaylist = Array.from(combinedPlaylist);

    // 🚀 LÓGICA DE SHUFFLE (ALEATORIO)
    // Garantizamos que la lista se reproduzca aleatoriamente desde el principio
    finalPlaylist.sort(() => Math.random() - 0.5);

    res.json({ playlist: finalPlaylist });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});