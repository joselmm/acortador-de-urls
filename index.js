const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Helper para leer/escribir en el JSON
const readDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- 1. Endpoint para acortar: /short?url=... ---
app.get('/short', (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Debes proporcionar una URL' });
    }

    const db = readDB();
    const id = crypto.randomBytes(4).toString('hex'); // Genera algo como "sjd8723"
    
    const newEntry = {
        id,
        originalUrl: url.startsWith('http') ? url : `https://${url}`,
        createdAt: new Date().getTime()
    };

    db.push(newEntry);
    writeDB(db);

    res.json({
        message: 'URL acortada con éxito',
        shortUrl: `http://localhost:${PORT}/${id}`,
        data: newEntry
    });
});

// --- 2. Endpoint Dinámico para redirección ---
app.get('/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    
    const entry = db.find(item => item.id === id);

    if (entry) {
        return res.redirect(entry.originalUrl);
    }

    res.status(404).send('URL no encontrada o expirada.');
});

// --- 3. Lógica de Limpieza (Cada 24 horas) ---
const removeOldUrls = () => {
    console.log('--- Ejecutando limpieza de URLs antiguas ---');
    const db = readDB();
    const DIEZ_DIAS_EN_MS = 10 * 24 * 60 * 60 * 1000;
    const ahora = Date.now();

    const dbFiltrada = db.filter(item => (ahora - item.createdAt) < DIEZ_DIAS_EN_MS);
    
    const eliminados = db.length - dbFiltrada.length;
    writeDB(dbFiltrada);
    
    console.log(`Limpieza terminada. Se eliminaron ${eliminados} URLs.`);
};

// Ejecutar limpieza al iniciar y luego cada 24 horas
setInterval(removeOldUrls, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    // Ejecutamos una limpieza inicial por si acaso
    removeOldUrls(); 
});
