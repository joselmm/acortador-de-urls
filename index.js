import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { db } from './modules/db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
console.log()

app.set('trust proxy', true);

// --- Endpoint para acortar ---
app.get('/short', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) throw new Error('URL requerida');
    
    const original_url = url.startsWith('http') ? url : `https://${url}`;

    // 1. BUSCAR SI YA EXISTE (Para no redundar)
    const existing = await db.getByColumn(process.env.TABLE_NAME, 'original_url', original_url);
    
    if (existing.noError && existing.data) {
      return res.json({
        noError: true,
        shortUrl: `${BASE_URL}/${existing.data.id}`,
        data: existing.data,
        info: "Ya existía en la base de datos"
      });
    }

    // 2. SI NO EXISTE, CREAR ID Y GUARDAR
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
      original_url,
      // Nota: created_at lo puede poner Supabase automáticamente
    };

    const insertRes = await db.insertRow(process.env.TABLE_NAME, newEntry);

    if (!insertRes.noError) throw new Error(insertRes.messageError);

    res.json({
      noError: true,
      shortUrl: `${BASE_URL}/${id}`,
      data: insertRes.data
    });

  } catch (error) {
    res.status(400).json({ noError: false, messageError: error.message });
  }
});

// --- Endpoint de redirección ---
app.get('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await db.getByColumn(process.env.TABLE_NAME, 'id', id);

  if (result.noError && result.data) {
    return res.redirect(result.data.original_url);
  }

  res.status(404).json({ noError: false, messageError: "URL no encontrada" });
});

// --- Limpieza diaria adaptada a SQL ---
const removeOldUrls = async () => {
  const TEN_DAYS_AGO = Date.now() - (10 * 24 * 60 * 60 * 1000);
  const result = await db.deleteOlderThan(process.env.TABLE_NAME, 'created_at', TEN_DAYS_AGO);
  
  if (result.noError) {
    console.log(`[Limpieza] Completada. Filas borradas: ${result.data?.length || 0}`);
  }
};

setInterval(removeOldUrls, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${BASE_URL}`);
});