require('dotenv').config(); // Carga las variables del .env
const express = require('express');
const fs = require('fs');
const path = require('path');


const app = express();

// Configuraciones desde el entorno
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DB_PATH = path.join(__dirname, 'db.json');

// IMPORTANTE: Si vas a usar Nginx como proxy inverso
app.set('trust proxy', true);

// Helpers
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) return [];
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- Endpoint para acortar ---
app.get('/short', (req, res) => {
    try {
        const { url } = req.query;
        if (!url) throw new Error('URL requerida');

        const db = readDB();
	const n = 5;
	const id = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
          .split('')
          .map(v => ({ v, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .map(({ v }) => v)
          .slice(0, n)
          .join('');
        
        const newEntry = {
            id,
            originalUrl: url.startsWith('http') ? url : `https://${url}`,
            createdAt: Date.now()
        };

        db.push(newEntry);
        writeDB(db);

        res.json({
            noError: true,
            shortUrl: `${BASE_URL}/${id}`, // <--- Usando la URL del entorno
            data: newEntry
        });

    } catch (error) {
        res.status(400).json({ noError: false, message: error.message });
    }
});

// --- Endpoint dinámico de redirección ---
app.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = readDB();
        const entry = db.find(item => item.id === id);

        if (!entry) {
            return res.status(404).json({ noError: false, message: "URL no encontrada" });
        }

        res.redirect(entry.originalUrl);

    } catch (error) {
        res.status(500).json({ noError: false, message: "Error en el servidor" });
    }
});

// --- Limpieza diaria ---
const removeOldUrls = () => {
    try {
        const db = readDB();
        const DIEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;
        const ahora = Date.now();

        const dbFiltrada = db.filter(item => (ahora - item.createdAt) < DIEZ_DIAS_MS);
        writeDB(dbFiltrada);
        console.log(`[Limpieza] URLs actualizadas a las ${new Date().toISOString()}`);
    } catch (e) {
        console.error("Error en limpieza:", e.message);
    }
};

setInterval(removeOldUrls, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
    console.log(`URL Base configurada: ${BASE_URL}`);
    removeOldUrls();
});
