require('dotenv').config();
const { assertConfig, getConfigStatus } = require('../src/config');

/**
 * Verificacao de configuracao em modo estrito: sempre falha se algum segredo
 * obrigatorio estiver ausente ou vazio, independentemente do NODE_ENV.
 *
 * Uso: npm run validate:config
 * Nao imprime valores de credencial.
 */
try {
    assertConfig({ strict: true });
    const status = getConfigStatus();
    console.log('Configuracao valida. Segredos obrigatorios presentes.');
    console.log(`Ambiente: ${status.nodeEnv} | Banco: ${status.database.user}@${status.database.host}/${status.database.name}`);
    process.exit(0);
} catch (erro) {
    console.error(`Falha na validacao: ${erro.message}`);
    process.exit(1);
}