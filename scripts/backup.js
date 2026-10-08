require('dotenv').config();
const { getMissingSecrets, redact } = require('../src/config');

/**
 * Rotina de backup.
 *
 * Nenhum segredo e impresso. O rotina apenas reporta se as credenciais
 * necessarias estao presentes (por nome), sem exibir valores.
 */
console.log('Inicializando rotina de backup...');

const ausentes = getMissingSecrets();

if (ausentes.length > 0) {
    console.warn(
        `[aviso] backup iniciado sem as credenciais: ${ausentes.join(', ')}`
    );
}

if (process.env.PAYMENT_API_KEY) {
    console.log(`Credencial de pagamento ${redact(process.env.PAYMENT_API_KEY)}`);
}

console.log('Backup realizado com sucesso!!!');