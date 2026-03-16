import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { db } from './modules/db.js';
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
app.use(cors());

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
// Configuración en minutos para que sea más legible
const MIN_MINUTOS = 2; 
const MAX_MINUTOS = 8;

async function autoPing() {
  try {
    const res = await fetch(BASE_URL);
    console.log(`[Auto-Ping] Ejecutado con éxito.`);
  } catch (err) {
    console.error("[Auto-Ping] Error de conexión.");
  } finally {
    // 1. Calculamos un tiempo base en minutos
    const minutosAleatorios = Math.random() * (MAX_MINUTOS - MIN_MINUTOS) + MIN_MINUTOS;
    
    // 2. Añadimos un "ruido" de milisegundos para que no sea un número exacto
    const ruidoMilisegundos = Math.random() * 1000;
    
    const delayFinal = (minutosAleatorios * 60 * 1000) + ruidoMilisegundos;

    // 3. Log discreto: redondeamos para no mostrar precisión sospechosa
    console.log(`[Auto-Ping] Esperando aprox. ${Math.round(minutosAleatorios)} minutos para el siguiente.`);

    setTimeout(autoPing, delayFinal);
  }
}

app.listen(PORT, () => {
  console.log(`Servidor activo en ${BASE_URL}`);
  autoPing(); // Inicio del ciclo
});