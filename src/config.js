const dotenv = require('dotenv');

dotenv.config();

/**
 * Segredos obrigatorios para o funcionamento da aplicacao.
 * Apenas os NOMES sao Manipulados aqui: valores nunca sao lidos para log,
 * excecao por `hasSecret`, que so verifica presenca.
 */
const REQUIRED_SECRETS = ['DB_PASSWORD', 'PAYMENT_API_KEY', 'INTERNAL_API_TOKEN'];

/** Variaveis cujo valor jamais pode ser exibido. */
const SENSITIVE_VARS = [
    'DB_PASSWORD',
    'MYSQL_ROOT_PASSWORD',
    'PAYMENT_API_KEY',
    'INTERNAL_API_TOKEN',
];

function getMissingSecrets(env = process.env) {
    return REQUIRED_SECRETS.filter((name) => {
        const value = env[name];
        return typeof value !== 'string' || value.trim() === '';
    });
}

function hasSecret(name, env = process.env) {
    return !getMissingSecrets(env).includes(name);
}

/**
 * Redige um valor sensivel. Usado por qualquer saida (log, resposta HTTP,
 * diagnostico) para garantir que credenciais nunca sejam impressas.
 */
function redact(value) {
    if (value === undefined || value === null || value === '') return '(nao definida)';
    return '***redigido***';
}

/** Relatorio seguro para diagnostico: mostra apenas presenca, nunca o valor. */
function getConfigStatus(env = process.env) {
    const missing = getMissingSecrets(env);
    return {
        nodeEnv: env.NODE_ENV || 'development',
        database: {
            host: env.DB_HOST || 'localhost',
            port: Number(env.DB_PORT) || 3306,
            name: env.DB_NAME || 'techstore',
            user: env.DB_USER || 'techstore_app',
            password: redact(env.DB_PASSWORD),
        },
        externalServices: {
            paymentApiKey: redact(env.PAYMENT_API_KEY),
            internalApiToken: redact(env.INTERNAL_API_TOKEN),
        },
        missingSecrets: missing,
        ready: missing.length === 0,
    };
}

function getDatabaseConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME || 'techstore',
        username: process.env.DB_USER || 'techstore_app',
        password: process.env.DB_PASSWORD || ''
    };
}

/**
 * Falha rapida (fail fast): em producao a aplicacao NAO sobe sem os segredos
 * necessarios, evitando operar em modo degradado com credencial ausente ou vazia.
 * Em desenvolvimento emite apenas um alerta, para que a atividade continue
 * executavel sem ambiente provisionado.
 *
 * @param {object} [options]
 * @param {boolean} [options.strict] força a validacao em qualquer ambiente.
 */
function assertConfig({ strict = false } = {}) {
    const missing = getMissingSecrets();

    if (missing.length === 0) return true;

    const env = process.env.NODE_ENV || 'development';
    const detalhes =
        'Variaveis obrigatorias ausentes ou vazias: ' +
        missing.join(', ') +
        '\nUse .env.example como modelo e nunca versione o arquivo .env.';

    if (strict || env === 'production') {
        throw new Error(`Configuracao invalida. ${detalhes}`);
    }

    console.warn(`[aviso] ${detalhes}`);
    return false;
}

module.exports = {
    REQUIRED_SECRETS,
    SENSITIVE_VARS,
    assertConfig,
    getConfigStatus,
    getDatabaseConfig,
    getMissingSecrets,
    hasSecret,
    redact,
};