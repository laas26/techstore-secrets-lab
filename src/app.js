require('dotenv').config();
const express = require('express');
const { connect } = require('./database');
const { assertConfig, getConfigStatus, hasSecret } = require('./config');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Falha rapida antes de aceitar requisicoes (ver src/config.js).
assertConfig();

const database = connect();

app.get('/', (req, res) => {
    res.json({
        message: 'TechStore API',
        status: 'ok'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        database: database.host
    });
});

/**
 * Retorna somente a PRESENCA dos segredos. Nenhum valor e exposto,
 * mesmo que a variavel de ambiente exista.
 */
app.get('/config-check', (req, res) => {
    res.json({
        database: database.database,
        adminConfigured: hasSecret('DB_PASSWORD'),
        paymentConfigured: hasSecret('PAYMENT_API_KEY'),
        internalApiConfigured: hasSecret('INTERNAL_API_TOKEN'),
        ready: getConfigStatus().ready,
    });
});

app.listen(PORT, () => {
    console.log(`API Techstore is running on port ${PORT}`);
});