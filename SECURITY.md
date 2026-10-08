# Análise de segurança do TechStore Secrets Lab

Este documento registra os problemas encontrados no gerenciamento de segredos,
o que foi feito em cada um e por que cada decisão faz sentido.

---

## Problema 1

### Local

`src/config.js`, na função `getDatabaseConfig()`.

### Problema identificado

A configuração do banco estava escrita direto no código, com usuário e senha em
texto claro:

```js
username: "techstore_root",
password: "***REDACTED***"
```

### Risco

Senha em código é o vazamento mais banal que existe e também o mais difícil de
auditar. O arquivo é copiado para tudo que deriva dele: imagem Docker, pipeline
de CI, pacote npm, clone. E fica no histórico do Git para sempre, mesmo depois
que alguém apaga o arquivo. Qualquer pessoa com acesso ao repositório ganha
acesso ao banco, inclusive quem só devia ver código de aplicação.

### Correção aplicada

A senha saiu do código e passou a vir de variável de ambiente:

```js
password: process.env.DB_PASSWORD || ''
```

### Justificativa

Variável de ambiente separa configuração de código. O mesmo arquivo passa a
servir qualquer ambiente, e o valor deixa de existir dentro do repositório.
Centralizar também evita dispersão, que era o risco real aqui: a mesma
credencial podia ser alterada em um lugar e esquecida em outro.

---

## Problema 2

### Local

`config/credentials.json`, arquivo removido do repositório.

### Problema identificado

O arquivo guardava credenciais de três sistemas em texto puro, incluindo uma
chave de pagamento com cara de produção:

```json
{ "database": { "username": "adminTechstore", "password": "***REDACTED***" },
  "payment": { "apiKey": "***REDACTED***" },
  "internalApi": { "token": "***REDACTED***" } }
```

### Risco

Juntar tudo num arquivo só aumenta o prejuízo de um acesso indevido. Quem
conseguisse ler esse arquivo sairia com banco, gateway de pagamento e API
interna de uma vez. O prefixo `tsk_live_` sugere credencial ativa, o que num
caso real traria responsabilidade legal e financeira junto.

### Correção aplicada

O arquivo foi removido e entrou no `.gitignore`. As chaves passaram a vir de
variável de ambiente (`PAYMENT_API_KEY` e `INTERNAL_API_TOKEN`), lidas por
`src/config.js`.

### Justificativa

Remover é mais seguro do que tentar proteger com permissão ou cifra dentro do
próprio repositório. Chave criptografada guardada junto do texto que ela
decifra não protege nada, só dá aparência de proteção. Sem o arquivo, o
segredo passa a existir apenas no ambiente de execução, que é o único lugar
com controle de acesso de verdade.

---

## Problema 3

### Local

`.env`, versionado no commit inicial.

### Problema identificado

O `.env` real estava no repositório, com `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`,
`PAYMENT_API_KEY` e `INTERNAL_API_TOKEN` preenchidos.

### Risco

Um `.env` versionado é um segredo publicado. Como o repositório é remoto, os
valores ficaram acessíveis a qualquer pessoa, e continuam acessíveis depois de
apagar o arquivo, porque o objeto Git permanece no histórico. Na prática,
segredo que já foi enviado a um remoto precisa ser tratado como
comprometido, mesmo que a pessoa remova o arquivo em seguida.

### Correção aplicada

Três ações ao mesmo tempo:

1. `.env` removido da árvore e acrescentado ao `.gitignore`;
2. `.env.example` criado só com placeholders;
3. histórico saneado com `git filter-repo --replace-text`, que trocou os
   valores por `***REDACTED***` em todos os commits.

### Justificativa

Tirar o arquivo da árvore não resolve, porque o histórico foi feito para não
mudar e continua legível. Sanear o histórico trata o segredo onde ele de fato
existe. As três ações juntas cobrem o problema inteiro: o `.gitignore` evita
que volte a acontecer, o `.env.example` orienta quem configura, e o
`filter-repo` limpa o que já tinha vazado.

---

## Problema 4

### Local

`.gitignore`, versão original.

### Problema identificado

O arquivo tinha só `node_modules/`, `logs/` e `dist/`. Não protegia `.env`,
arquivos de credencial, chaves nem certificados.

### Risco

Sem regra de exclusão, um `git add .` qualquer versiona o arquivo novo de
configuração. O perigo é que isso não dá erro nenhum: o arquivo entra, o
push publica, e ninguém percebe. Ficar Depends de o desenvolvedor lembrar de
não versionar é exatamente o tipo de cuidado que se perde sob prazo.

### Correção aplicada

```gitignore
node_modules/
logs/
dist/
.env
.env.*
!.env.example
config/credentials.json
*.key
*.pem
*.p12
secrets/
```

### Justificativa

A regra vira controle automático e tira o segredo do caminho perigoso. As
negativas cobrem variações do nome do arquivo, e o `!.env.example` mantém o
modelo distribuível versionado. Vale registrar que o `.gitignore` age só sobre
arquivos que ainda não estão rastreados, e por isso ele não substitui o
saneamento do histórico.

---

## Problema 5

### Local

`src/database.js` e `src/config.js`.

### Problema identificado

Além do segredo exposto, a conexão usava o usuário com mais privilégio:

```js
username: "techstore_root"   // config.js
username: "root"             // database.js
```

### Risco

Aplicação operando como `root` significa que qualquer falha nela (injeção SQL,
código remoto executado, dependência comprometida) entrega controle total do
banco na hora. Isso inclui ler e apagar qualquer database do servidor e ainda
escrever arquivo no disco via `SELECT ... INTO OUTFILE`. O princípio do menor
privilégio pede que a aplicação use só as permissões que realmente precisa.

### Correção aplicada

O usuário virou configurável, com `techstore_app` como padrão, e sem nenhuma
queda para `root`:

```js
username: process.env.DB_USER || 'techstore_app'
```

No Compose, `MYSQL_USER` e `MYSQL_PASSWORD` criam o usuário da aplicação, e o
`MYSQL_ROOT_PASSWORD` fica restrito à inicialização do banco.

### Justificativa

O padrão do código importa tanto quanto o valor configurado. Uma queda para
`root` garante privilégio máximo toda vez que a variável faltar, e esse tipo
de falha silenciosa é justamente o que a atividade pede para evitar.

---

## Problema 6

### Local

`src/app.js`, rota `/config-check`.

### Problema identificado

A rota usava identificadores que não existiam:

```js
adminConfigured: Boolean(***REDACTED***),
paymentConfigured: Boolean(***REDACTED***),
internalApiConfigured: Boolean(***REDACTED***),
```

### Risco

São dois defeitos. O primeiro é um `ReferenceError` em tempo de execução: a
rota quebraria, o que já é negação de serviço. O segundo é mais grave. Os
nomes dessas variáveis eram o próprio segredo, com o valor embutido no
identificador. Não era nome de variável, era a chave em claro dentro do
código. E a rota era pública, sem autenticação.

### Correção aplicada

A rota passou a ler variável de ambiente e devolve só booleanos, usando o
helper `hasSecret()`:

```js
adminConfigured: hasSecret('DB_PASSWORD'),
paymentConfigured: hasSecret('PAYMENT_API_KEY'),
internalApiConfigured: hasSecret('INTERNAL_API_TOKEN'),
```

### Justificativa

Separar presença de valor acaba com a classe inteira de vazamento. Mesmo que a
rocha fique pública, a resposta continua sendo verdadeiro ou falso e não tem
como carregar conteúdo sensível. O helper centraliza a verificação, o que
diminui a chance de outro endpoint voltar a fazer a mesma coisa por descuido.

---

## Problema 7

### Local

`docker-compose.yml`, versão original.

### Problema identificado

O arquivo era inválido como Compose e inseguro ao mesmo tempo:

- faltava a chave `services:`, o que já invalidava o arquivo inteiro;
- a sintaxe de lista estava errada (`- NODE_ENV: development`, em vez de
  `KEY=value`);
- `MYSQL_ROOT_PASSWORD` aparecia duas vezes com valores diferentes
  (`***REDACTED***` e `Root***REDACTED***`), e o segundo sobrescrevia o
  primeiro;
- a mesma senha de `DB_PASSWORD` servia também de senha de root;
- a porta 3306 ficava exposta para o host.

### Risco

Reusar senha quebra a separação entre as coisas. Quem compromised a conta da
aplicação chega no root junto, e rotacionar uma credencial derruba as outras.
A porta 3306 aberta aumenta a superfície de ataque para a rede toda do host. E
a chave duplicada deixa o comportamento do ambiente imprevisível, porque o
resultado depende de qual das duas entradas o interpretador vence.

### Correção aplicada

O arquivo foi reescrito como Compose válido, com:

- senhas separadas: `MYSQL_ROOT_PASSWORD` diferente de `DB_PASSWORD`;
- publicação da porta 3306 removida, o MySQL ficou só na rede interna;
- `${VAR:?mensagem}` para a inicialização falhar se algum segredo faltar;
- `healthcheck` e `restart` explícitos.

### Justificativa

Falhar na hora do deploy é melhor do que subir um serviço com a credencial
vazia, que seria um `MYSQL_PASSWORD:` em branco e uma falha silenciosa em
produção. Tirar a porta 3306 da publicação reduz a superfície sem custo: a
aplicação conversa com o banco pela rede interna do Compose de qualquer forma.

---

## Problema 8

### Local

`scripts/backup.js`.

### Problema identificado

O script imprimia o segredo em log e ainda referenciava uma variável que não
existia:

```js
const apiKey = process.env.API_KEY;
console.log(`API KEY utilizada no backup : ${***REDACTED***}`);
```

### Risco

Segredo em log é uma das vazões mais comuns e uma das mais difíceis de
consertar depois. Logs vão para agregadores, arquivos, backups e consoles de
observabilidade, com retenção longa e controle de acesso costumam mais frouxo
que o do banco. Além disso, `API_KEY` era um nome errado, porque o projeto usa
`PAYMENT_API_KEY`. A variável lida era sempre `undefined`, ou seja, o backup
rodava sem credencial e não percebia.

### Correção aplicada

Nenhum valor é impresso. O script só reporta presença, com o nome das
variáveis que faltam e o valor mascarado:

```js
console.log(`Credencial de pagamento ${redact(process.env.PAYMENT_API_KEY)}`);
```

### Justificativa

Log é infraestrutura de produção, não rascunho descartável. O que entra ali
precisa ser considerado exposto. Mostrar `***redigido***` mantém a capacidade
de diagnóstico, já que dá para confirmar que a credencial foi carregada, sem
criar cópia do segredo em armazenamento secundário.

---

## Problema 9

### Local

`src/config.js`, por não ter validação. `.env.example`, por não existir.

### Problema identificado

Não havia nenhuma verificação de configuração. Faltar o `.env`, faltar uma
variável ou ela vir vazia produzia comportamento silencioso: o fallback
`|| ''` gerava senha vazia e o serviço seguia operando degradado.

### Risco

Falha silenciosa é pior que falha explícita, porque a aplicação responde
`200 OK` enquanto autentica com credencial vazia. O sintoma aparece como erro
intermitente em produção, muito depois da mudança que causou. Sem validação,
também não existe forma de conferir a configuração antes do deploy.

### Correção aplicada

A validação ficou centralizada em `src/config.js`, nas funções
`assertConfig()`, `getMissingSecrets()` e `hasSecret()`, em dois níveis:

- em produção, ou com a opção `strict`, lança erro e o processo não sobe;
- em desenvolvimento, avisa quais nomes estão faltando e segue, para o projeto
  didático continuar rodando sem ambiente provisionado.

Tem também um comando para CI/CD:

```bash
npm run validate:config
```

Os nomes das variáveis ausentes são reportados. Os valores nunca.

### Justificativa

A validação existe para transformar configuração errada em erro previsível e
reproduzível. O nível estrito em produção atende ao fail fast. A tolerância em
desenvolvimento existe porque a atividade pede que a aplicação continue
executável depois das correções, e corrigir segurança não pode ser só fazer o
projeto parar. O relatório de `getConfigStatus` é seguro por construção, já
que passa pela função `redact()`.

---

## Problema 10

### Local

`.dockerignore`, que não existia. `Dockerfile`, que rodava como root.

### Problema identificado

Não havia `.dockerignore`, e o Dockerfile tinha:

```dockerfile
COPY . .          # copia o .env para a imagem
CMD ["npm", "start"]   # sem USER: o processo roda como root
```

### Risco

Esse é o problema mais perigoso da lista, porque sobrevive a todas as outras
correções. O `.gitignore` não tem nenhum efeito sobre o contexto de build do
Docker. O `.env`, que o próprio README manda o desenvolvedor criar, ia parar
numa camada da imagem, onde continua recuperável por `docker history`,
`docker save` e por qualquer pessoa que consiga puxar a imagem, sem precisar de
acesso ao repositório Git. A exposição continua existindo mesmo depois de
consertar o repositório.

Some-se a isso rodar como root: se a aplicação for comprometida, o atacante já
começa com privilégio máximo e nenhuma barreira no caminho.

### Correção aplicada

Foi criado o `.dockerignore` excluindo `.env`, `.env.*`, `config/`, `secrets/`,
chaves e certificados. No Dockerfile:

```dockerfile
COPY --chown=node:node . .
ENV NODE_ENV=production
USER node
RUN npm ci --omit=dev
```

E no Compose: `read_only: true`, `cap_drop: [ALL]` e
`security_opt: [no-new-privileges]`.

### Justificativa

O `.dockerignore` é a fronteira entre a pasta de trabalho do desenvolvedor e a
imagem que circula, e precisa existir por conta própria, sem depender do Git,
porque são dois mecanismos de exclusão diferentes. O `USER node` leva o menor
privilégio para a camada de execução, e o `cap_drop` com
`no-new-privileges` tira a superfície de escalonamento mesmo em caso de
falha. O `--chown` junto do `USER node` não é enfeite: sem a propriedade
certa, o usuário sem privilégio não consegue ler os arquivos da aplicação.

---

## Conclusão

Todos os problemas foram encontrados, corrigidos e validados. Dois deles
merecem destaque porque são os que costumam passar batido: o `.env` indo parar
dentro da imagem Docker, que continua exposto mesmo depois de todo o repositório
ser corrigido, e os segredos que ficam no histórico do Git, que continuam
legíveis mesmo depois de apagar o arquivo.

O ponto central da atividade é que esconder uma senha não é o mesmo que
gerenciar um segredo. Gerenciar é cuidar do ciclo de vida inteiro, desde
prevenir e detectar até rotacionar e revogar, em cada lugar onde o valor pode
aparecer: código, histórico, imagem, variável de ambiente, log e resposta
HTTP.
