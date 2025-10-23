// Archivo server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;

// =============================================================
// !!! PASO CRÍTICO: DEBES MODIFICAR ESTAS CREDENCIALES !!!
// =============================================================
const dbConfig = {
    user: 'postgres',         // <-- TU nombre de usuario de PostgreSQL
    host: 'localhost',
    database: 'cuaderno_explotacion',
    password: 'Mf1908fm##', // <-- ¡TU CONTRASEÑA REAL DE POSTGRES!
    port: 5433,
};
// =============================================================

// Crear un pool de conexiones a la base de datos
const pool = new Pool(dbConfig);

// ID de Explotación Fija: Usamos el ID 1 para todas las inserciones 
// hasta que implementemos la gestión de usuarios.
const ID_EXPLOTACION_FIJO = 1;

// Función para probar la conexión a la base de datos
async function testDbConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Conexión exitosa a PostgreSQL establecida.');
    } catch (err) {
        console.error('❌ ERROR CRÍTICO DE CONEXIÓN A POSTGRESQL:');
        console.error('  -> Asegúrate de que el servicio de PostgreSQL esté corriendo.');
        console.error('  -> Revisa las credenciales en server.js.');
        console.error('  -> Error detallado:', err.message);
    }
}

// Middleware
app.use(cors());
app.use(express.json());

// --- RUTAS DE LA API PARA LA TABLA PARCELA COMPLETA ---

// 1. OBTENER TODAS LAS PARCELAS (GET)
app.get('/api/parcelas', async (req, res) => {
    try {
        // Seleccionamos los campos más relevantes para el listado, usando el nombre de columna del esquema completo.
        const query = 'SELECT id_parcela, n_orden, especie, superficie_cultivada_ha, uso_sigpac, secano_regadio FROM "Parcela" ORDER BY n_orden';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('🔴 ERROR en /api/parcelas (GET):', err.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos. Revisa la consola de Node.js.' });
    }
});

// 2. CREAR UNA NUEVA PARCELA (POST) - Inserta campos NOT NULL y los principales
app.post('/api/parcelas', async (req, res) => {
    // Campos OBLIGATORIOS (NOT NULL en el esquema)
    const { n_orden, superficie_cultivada_ha } = req.body;
    
    // Campos principales del formulario (pueden ser NULL, pero los incluiremos)
    const { especie, variedad, secano_regadio } = req.body;
    
    // Asignación de valores por defecto o Null si no vienen en la petición
    const defaultVal = null; // Usaremos NULL para los campos no obligatorios que no vengan

    // Validación de campos OBLIGATORIOS
    if (typeof n_orden !== 'number' || n_orden <= 0 || typeof superficie_cultivada_ha !== 'number' || superficie_cultivada_ha <= 0) {
        return res.status(400).json({ error: 'Datos incompletos o inválidos. n_orden y superficie_cultivada_ha son obligatorios y deben ser números > 0.' });
    }

    try {
        const query = `
            INSERT INTO "parcela" (
                id_explotacion, 
                n_orden, 
                superficie_cultivada_ha,
                -- Campos Opcionales/Por Defecto (asumimos NULL si no se envían)
                especie, 
                variedad, 
                secano_regadio,
                
                -- Se deben proveer valores (incluso NULL) para el resto de NOT NULL si los hubiera, 
                -- pero solo n_orden e id_explotacion son NOT NULL no SERIAL. 
                -- Los campos restantes no se listan aquí, asumiendo que aceptan NULL.
                cod_provincia, termino_municipal, codigo_agregado, zona, n_poligono, n_parcela, n_recinto, uso_sigpac, superficie_sigpac_ha, sistema_riego, aire_libre_protegido, asesoramiento_nombre, asesoramiento_cultivo
            ) 
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) 
            RETURNING *
        `;
        
        const values = [
            ID_EXPLOTACION_FIJO, 
            n_orden, 
            superficie_cultivada_ha,
            especie || defaultVal, 
            variedad || defaultVal, 
            secano_regadio || 'S', // Default a Secano si no se especifica
            
            // Valores por defecto/NULL para el resto de campos (se pueden completar luego)
            defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal, defaultVal
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json({ message: 'Parcela creada exitosamente (Esquema Completo)', parcela: result.rows[0] });

    } catch (err) {
        console.error('🔴 ERROR al crear parcela (POST Esquema Completo):', err.message);
        if (err.code === '23503') { // Falla la FK si ID_EXPLOTACION_FIJO no existe
             return res.status(500).json({ error: 'Error de clave foránea. Asegúrate de que la Explotación con ID 1 exista.' });
        }
        // Puedes agregar más manejo de errores para otros NOT NULL, aunque los hemos cubierto arriba.
        res.status(500).json({ error: 'Error interno del servidor al crear la parcela. Revisa la consola de Node.js.' });
    }
});

// 3. ELIMINAR UNA PARCELA (DELETE)
app.delete('/api/parcelas/:id_parcela', async (req, res) => {
    // Usamos id_parcela, que es la clave SERIAL generada por la BBDD
    const id = parseInt(req.params.id_parcela); 

    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de registro inválido.' });
    }

    try {
        const query = 'DELETE FROM "Parcela" WHERE id_parcela = $1 RETURNING *'; 
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Parcela no encontrada o ya eliminada.' });
        }

        res.json({ message: 'Parcela eliminada exitosamente' });
    } catch (err) {
        console.error('🔴 ERROR al eliminar parcela (DELETE):', err.message);
        res.status(500).json({ error: 'Error interno del servidor al eliminar la parcela. Revisa la consola de Node.js.' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log('-------------------------------------------------------');
    console.log(`📡 API de Cuaderno de Explotación (COMPLETO) corriendo en http://localhost:${port}`);
    console.log('-------------------------------------------------------');
    testDbConnection();
});
