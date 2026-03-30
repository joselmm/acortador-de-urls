import express from 'express';
import serverless from 'serverless-http';
import cors from "cors";
import { db } from '../../modules/db.js';

const app = express();

// Configuración de Middlewares
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// Lógica de BASE_URL dinámica
// Netlify proporciona process.env.URL automáticamente en producción
const getBaseUrl = (req) => {
  // Si estamos en local, usamos lo que tengas en tu .env o localhost
  return process.env.BASE_URL || `http://${req.get('host')}`;
};

const BASE_URL = getBaseUrl();

app.get('/short', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) throw new Error('URL requerida');

    const original_url = url.startsWith('http') ? url : `https://${url}`;

    // VERFIFICAR SI ES URL VALIDA
    try {
      const parsedUrl = new URL(original_url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
      if (!parsedUrl.hostname.includes('.')) throw new Error(); // Evita "https://hola"
    } catch (e) {
      throw new Error('La URL no es válida o le falta el dominio');
    }

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
    const id = generateID();

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



app.post('/short', async (req, res) => {
  try {
    // Ahora extraemos la url del cuerpo (POST)
    const { url } = req.body; 
    if (!url) throw new Error('URL requerida en el cuerpo de la petición');

    const original_url = url.startsWith('http') ? url : `https://${url}`;

    // VERIFICAR SI ES URL VALIDA
    try {
      const parsedUrl = new URL(original_url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
      if (!parsedUrl.hostname.includes('.')) throw new Error();
    } catch (e) {
      throw new Error('La URL no es válida o le falta el dominio');
    }

    // 1. BUSCAR SI YA EXISTE
    const existing = await db.getByColumn(process.env.TABLE_NAME, 'original_url', original_url);

    if (existing.noError && existing.data) {
      return res.json({
        noError: true,
        shortUrl: `${BASE_URL}/${existing.data.id}`,
        info: "Ya existía en la base de datos"
      });
    }

    // 2. GENERAR ID CORTO (5 caracteres)
    // 2. SI NO EXISTE, CREAR ID Y GUARDAR
    const n = 5;
    const id = generateID()

    const newEntry = {
      id,
      original_url,
      // Nota: created_at lo puede poner Supabase automáticamente
    };
    const insertRes = await db.insertRow(process.env.TABLE_NAME, newEntry);

    if (!insertRes.noError) throw new Error(insertRes.messageError);

    res.json({
      noError: true,
      shortUrl: `${BASE_URL}/${id}`
    });

  } catch (error) {
    res.status(400).json({ noError: false, messageError: error.message });
  }
});

// --- Endpoint de redirección ---
app.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Evitar que favicon.ico o peticiones raras activen la búsqueda
  if (id === 'favicon.ico' || id === 'robots.txt') return res.status(204).end();

  const result = await db.getByColumn(process.env.TABLE_NAME, 'id', id);

  if (result.noError && result.data) {
    return res.redirect(result.data.original_url);
  }

  // --- RESPUESTA ESTÉTICA 404 ---
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enlace no encontrado</title>
        <style>
            body { font-family: sans-serif; background: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #333; }
            .container { text-align: center; background: white; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 400px; }
            h1 { font-size: 72px; margin: 0; color: #ff4757; }
            p { font-size: 18px; color: #57606f; margin: 10px 0 25px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>404</h1>
            <p>¡Ups! Este enlace ha expirado o no existe.</p>
        </div>
    </body>
    </html>
  `);
});


function generateID() {
  const n = 5;
  const id = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    .split('')
    .map(v => ({ v, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(({ v }) => v)
    .slice(0, n)
    .join('');
  return id;
}

// Exportar para Netlify
export const handler = serverless(app);
