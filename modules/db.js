import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 1. Cargar configuración
dotenv.config(); 

// 2. Verificar que las variables cargaron (solo para debug)
if (!process.env.SUPEBASE_URL || !process.env.SUPEBASE_KEY) {
  console.error("❌ ERROR: No se encontraron las variables en el .env");
}

// 3. Crear el cliente
export const supabase = createClient(
  process.env.SUPEBASE_URL, 
  process.env.SUPEBASE_KEY
);

export const db = {
  formatResponse(data, error) {
    return {
      noError: !error,
      messageError: error ? error.message : "",
      data: data || null
    };
  },

  async getByColumn(tableName, column, value) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(column, value)
        .maybeSingle(); // Usamos maybeSingle para que no de error si no encuentra nada
      return this.formatResponse(data, error);
    } catch (err) {
      return this.formatResponse(null, err);
    }
  },

  async insertRow(tableName, rowData) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert([rowData])
        .select();
      return this.formatResponse(data ? data[0] : null, error);
    } catch (err) {
      return this.formatResponse(null, err);
    }
  },

  async deleteOlderThan(tableName, column, timestamp) {
    try {
      // PostgreSQL usa ISO strings o Timestamptz, adaptamos el valor
      const dateLimit = new Date(timestamp).toISOString();
      const { data, error } = await supabase
        .from(tableName)
        .delete()
        .lt(column, dateLimit) // lt = Less Than (menor que)
        .select();
      return this.formatResponse(data, error);
    } catch (err) {
      return this.formatResponse(null, err);
    }
  }
};