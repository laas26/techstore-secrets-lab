# 🔐 TechStore Secrets Lab

Correção de vulnerabilidades e implementação de boas práticas no gerenciamento de segredos. A proposta era receber uma aplicação com problemas inseridos de propósito, encontrar eles, corrigir e
explicar o que foi feito.

O relatório completo está no [SECURITY.md](./SECURITY.md), com cada problema
descrito um a um, o risco de cada um e a justificativa da correção.

## 🚀 Como executar

O passo 1 não é opcional. Sem o `.env` a aplicação sobe em modo degradado, e o
comando de validação falha.

```bash

cp .env.example .env
```

Preencha com os valores do seu ambiente. Esse arquivo é gerado na sua máquina e
está no `.gitignore`, então ele nunca deve ser versionado.

Depois:

```bash
npm install
npm run validate:config
npm start
```

A aplicação fica em `http://localhost:3000`. O `validate:config` sai com erro
se algum segredo estiver faltando, o que é útil antes de subir em CI.

### 🐳 Com Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs
docker compose down
```

O Compose recusa subir se alguma variável obrigatória estiver ausente. É de
propósito: subir com a credencial vazia é pior do que não subir.

## 🧪 Endpoints

| Rota | O que faz |
|------|-----------|
| `/` | Página principal |
| `/health` | Health check |
| `/config-check` | Diz se os segredos estão configurados |

O `/config-check` responde `true` ou `false`. Ele nunca devolve o valor, mesmo
com tudo configurado, que é o ponto do exercício.

## 🔍 Os problemas encontrados

| # | Problema | Onde | Gravidade |
|---|----------|------|-----------|
| 1 | Senha de banco escrita no código | `src/config.js` | Crítica |
| 2 | Credenciais de serviços externos em arquivo versionado | `config/credentials.json` | Crítica |
| 3 | Segredos reais no `.env` versionado | `.env` | Crítica |
| 4 | `.gitignore` sem proteção de arquivos sensíveis | `.gitignore` | Alta |
| 5 | Aplicação conectando como `root` | `src/database.js` | Alta |
| 6 | Segredo escrito no nome da variável, rota sem proteção | `src/app.js` | Alta |
| 7 | Compose inválido com senha duplicada | `docker-compose.yml` | Alta |
| 8 | Segredo impresso em log | `scripts/backup.js` | Alta |
| 9 | Nenhuma validação de configuração | `src/config.js` | Média |
| 10 | `.env` acabar dentro da imagem Docker | `Dockerfile` | Alta |

## 🛠️ O que mudou

**Segredo fora do código.** Tudo é lido de variável de ambiente por um módulo
só, o `src/config.js`. O `config/credentials.json` foi removido e o `.env`
criou um `.env.example` com placeholders.

**Prevenção.** O `.gitignore` passou a proteger `.env`, chaves e certificados.
Também foi criado o `.dockerignore`, que antes não existia. Sem ele, o `.env`
ia parar dentro da imagem, porque o `.gitignore` não tem efeito nenhum sobre o
contexto de build do Docker.

**Menor privilégio.** A aplicação deixou de usar `root` e passou a usar
`techstore_app`. O `Dockerfile` roda com `USER node`, e o Compose aplica
`cap_drop`, `read_only` e `no-new-privileges`. Cada serviço recebe só as
variáveis que usa, então a aplicação não enxerga o `MYSQL_ROOT_PASSWORD` e o
MySQL não recebe as chaves de pagamento. A porta 3306 deixou de ser publicada.

**Falha rápida.** O `assertConfig()` impede a subida em produção quando falta
segredo, e no Compose isso acontece na inicialização. Em desenvolvimento ele
avisa e segue, para o projeto didático continuar rodando.

**Log sem segredo.** O diagnóstico passa a mostrar se a credencial está
carregada, nunca o valor dela.

## 🔄 Rotação e revogação

Segredo que foi enviado para um remoto precisa ser tratado como comprometido,
mesmo que depois tenha sido removido. A ordem é revogar primeiro, rotacionar
depois.

O procedimento completo seria: revogar as credenciais expostas no provedor de
identidade, gerar valores novos e distintos por sistema, distribuir pelo canal
seguro, verificar e por fim sanear o histórico. Neste laboratório dá para
executar só a última etapa, que foi feita com o `git filter-repo`. As
credenciais são fictícias e não existe provedor nem servidor onde valham, então
não há nada a revogar nem senha real a trocar.

Sanear e rotacionar não se substituem. Rotacionar sem limpar o histórico deixa
o valor antigo recuperável, e o segredo novo acaba dividindo espaço com o que
já estava exposto.

Vale um aviso prático: depois de rotacionar a senha do MySQL em um volume já
iniciado, é preciso rodar `docker compose down -v` para a mudança ter efeito.

## 🗂️ Estrutura

```
techstore-secrets-lab/
├── src/
│   ├── app.js                 rotas, expõem só presença de segredo
│   ├── config.js              configuração centralizada e validação
│   └── database.js            conexão sem credencial no código
├── scripts/
│   ├── backup.js              rotina sem segredo em log
│   └── validate-config.js     verificação estrita para CI/CD
├── .env.example               modelo versionado, sem valor real
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── SECURITY.md                relatório de análise
└── README.md
```

O `config/credentials.json` e o `.env` que aparecem na estrutura original do
projeto não estão aqui de propósito. Ambos foram removidos, e essa remoção é
parte da correção.

## ⚠️ Aviso

> Projeto educacional. Todas as credenciais são fictícias e não devem ser usadas em ambiente real.

Variáveis de ambiente resolvem o problema do laboratório e servem bem em
desenvolvimento e CI, mas em produção em grande escala o ideal é um
gerenciador de segredos, como Vault, AWS Secrets Manager ou Azure Key Vault, com
injeção em tempo de execução e rotação automática. As funções de `config.js`
foram escritas com essa troca em mente, para que mudar o backend não obrigue a
mudar os pontos de uso.