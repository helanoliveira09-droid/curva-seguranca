# Sistema de Curva de Segurança

Sistema **sem login**, com **dois pontos de entrada separados** (painel
administrativo e painel de consulta), gestão manual de **setores** com
evolução própria, e persistência em **MongoDB** — pronto para GitHub e
deploy no Render.

## Estrutura do projeto

```
curva-seguranca/
├── render.yaml                 # deploy automático no Render (Web Service)
├── .github/workflows/ci.yml    # valida o build a cada push no GitHub
│
├── backend/
│   ├── server.js                # servidor Express principal (sem login)
│   ├── package.json
│   ├── .env.example              # variáveis de ambiente (copie para .env)
│   ├── Procfile                  # compatível com Railway/Heroku-like
│   ├── db/
│   │   └── mongo.js               # conexão única com o MongoDB
│   ├── seed/
│   │   └── seedData.js            # dados iniciais (config, setores, eventos de exemplo)
│   ├── routes/
│   │   ├── events.js              # CRUD de eventos
│   │   ├── setores.js             # CRUD de setores (criação manual)
│   │   ├── curve.js               # curva geral, curva por setor, resumo de setores
│   │   └── config.js              # diretrizes (pesos, limiares, mínimo aceitável)
│   └── utils/
│       └── curveCalculator.js     # motor de cálculo da curva (puro, sem dependência de banco)
│
└── frontend/
    ├── index.html                 # painel de CONSULTA (somente leitura)
    ├── admin.html                 # painel ADMINISTRATIVO (com edição)
    ├── css/style.css
    └── js/
        ├── api.js                  # comunicação com a API (sem token/login)
        ├── curve-render.js         # gráfico e helpers compartilhados pelos 2 painéis
        ├── admin.js                 # lógica do painel administrativo
        ├── consulta.js               # lógica do painel de consulta (com auto-atualização)
        └── vendor/chart.umd.js        # Chart.js embutido (não depende de CDN externo)
```

## Sem login: como funciona o acesso

Este sistema **não tem autenticação**. Em vez disso, existem **dois
arquivos HTML separados**, cada um pensado para um público:

- **`admin.html`** — painel administrativo completo: registra eventos,
  cadastra setores manualmente, ajusta pesos/mínimo aceitável.
- **`index.html`** — painel de consulta: mostra o painel geral e a
  evolução de cada setor, **sem nenhum botão de edição**. Atualiza
  sozinho a cada 45 segundos (e tem um botão "Atualizar agora").

Os dois painéis conversam através do **mesmo backend e do mesmo banco
MongoDB** — qualquer evento ou setor criado no `admin.html` aparece no
`index.html` na atualização seguinte. Não existe usuário/senha: qualquer
pessoa com o link de um dos dois arquivos acessa aquele painel. Se você
precisa restringir quem acessa `admin.html`, isso deve ser feito **fora**
da aplicação — por exemplo, não divulgando a URL, colocando a aplicação
numa rede interna/VPN, ou usando autenticação básica no nível do proxy
reverso/provedor de nuvem.

## Setores: cadastro manual e evolução própria

- No painel administrativo (`admin.html` → aba **Setores**), qualquer
  setor pode ser criado manualmente (nome + descrição opcional) a
  qualquer momento — inclusive durante o registro de um evento, sem
  precisar trocar de tela.
- Cada setor tem sua **própria curva**, calculada com os mesmos pesos e
  limiares do painel geral, mas usando **somente os eventos daquele
  setor**. Isso é feito filtrando os eventos antes de rodar o mesmo
  motor de cálculo (`curveCalculator.js`) — o painel geral nunca é
  alterado por essa filtragem, pois ele sempre roda com **todos** os
  eventos da empresa.
- Remover um setor da lista de gestão **não apaga** os eventos já
  registrados com aquele nome — eles continuam no histórico geral e nos
  relatórios, apenas o setor some da lista de cadastro ativo.

## Como funciona o cálculo da curva (inalterado)

1. Índice diário de 0 a 100. Sem eventos novos, tende à linha de base
   (`baseline`) a uma taxa configurável por dia.
2. Cada evento (documento, acidente, incidente, notificação,
   irregularidade, treinamento, auditoria) soma ou subtrai pontos,
   conforme peso configurável.
3. Classificação: **Crítico** (\<40) · **Moderado** (40–59) ·
   **Normal** (60–79) · **Melhorado** (≥80).
4. O **mínimo aceitável** (padrão 60) é a diretriz mínima da empresa,
   compartilhada entre o painel geral e todos os setores.

## Rodando localmente

### 1. Banco de dados: MongoDB

Você precisa de um MongoDB acessível. Duas opções:

**Opção A — MongoDB Atlas (gratuito, recomendado, nenhuma instalação local):**
1. Crie uma conta em [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Crie um cluster gratuito (M0).
3. Em "Database Access", crie um usuário com senha.
4. Em "Network Access", libere seu IP (ou `0.0.0.0/0` para simplificar).
5. Copie a connection string (algo como
   `mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net`).

**Opção B — MongoDB local:**
Instale o MongoDB Community na sua máquina e use
`mongodb://127.0.0.1:27017`.

### 2. Configurar variáveis de ambiente

```bash
cd backend
cp .env.example .env
# edite .env e cole sua MONGODB_URI
```

### 3. Instalar e rodar

```bash
npm install
npm start
```

O servidor sobe em **http://localhost:3001** e já serve os dois
frontends:
- Consulta: http://localhost:3001/
- Administrativo: http://localhost:3001/admin.html

Na primeira execução, se as coleções estiverem vazias, o sistema
cadastra automaticamente uma configuração padrão, 8 setores de exemplo e
um histórico de eventos de exemplo — só para o painel não começar
vazio. Você pode apagar tudo diretamente no MongoDB (ou no Atlas) a
qualquer momento; o sistema não recria os dados de exemplo se as
coleções já tiverem conteúdo.

## Publicando no GitHub e rodando em nuvem (Render)

### 1. Subir para o GitHub

```bash
cd curva-seguranca
git init
git add .
git commit -m "Sistema de Curva de Segurança (sem login, MongoDB)"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. Deploy no Render

O repositório já inclui `render.yaml` na raiz:

1. Acesse [render.com](https://render.com) e faça login com sua conta GitHub.
2. Clique em **New > Blueprint** e selecione o repositório.
3. O Render lê o `render.yaml` e cria automaticamente um **Web Service**
   Node (não um "Static Site" — isso é importante, veja o aviso abaixo).
4. Quando pedir a variável `MONGODB_URI`, cole a connection string do
   seu cluster MongoDB Atlas (a mesma do passo anterior).
5. Clique em **Apply**. Ao final, você recebe uma URL pública
   (ex.: `https://curva-seguranca.onrender.com`), já servindo os dois
   painéis:
   - `https://curva-seguranca.onrender.com/` → consulta
   - `https://curva-seguranca.onrender.com/admin.html` → administrativo

> ⚠️ **Erro 405 ao usar o sistema em produção?** Isso significa que o
> serviço foi publicado como arquivos estáticos, sem o backend Node
> rodando de verdade (por exemplo, GitHub Pages, ou um "Static Site" no
> Render em vez de "Web Service"). Use o Blueprint acima, que já
> configura o tipo certo automaticamamente.

### 3. Integração contínua (GitHub Actions)

O repositório inclui `.github/workflows/ci.yml`: a cada push, valida a
sintaxe de todos os arquivos do backend e do frontend.

## Endpoints da API (todos sem autenticação)

| Método | Rota                              | Descrição |
|--------|------------------------------------|-----------|
| GET    | `/api/health`                       | Status da API |
| GET    | `/api/eventos`                      | Lista eventos (filtros: `tipo`, `setor`, `de`, `ate`) |
| POST   | `/api/eventos`                      | Cria evento |
| DELETE | `/api/eventos/:id`                  | Remove evento |
| GET    | `/api/setores`                      | Lista setores cadastrados |
| POST   | `/api/setores`                      | Cria setor manualmente (`nome`, `descricao`) |
| DELETE | `/api/setores/:id`                  | Remove setor da lista (mantém eventos históricos) |
| GET    | `/api/curva?dias=180`               | Curva **geral** (todos os eventos) |
| GET    | `/api/curva?dias=180&setor=Nome`    | Curva **do setor** informado, isolada |
| GET    | `/api/curva/resumo`                 | Cards de resumo do painel geral |
| GET    | `/api/curva/resumo?setor=Nome`      | Cards de resumo de um setor específico |
| GET    | `/api/curva/setores-resumo`         | Índice atual de todos os setores (para a grade de cards) |
| GET    | `/api/config`                        | Lê pesos/limiares/mínimo aceitável |
| PUT    | `/api/config`                        | Atualiza diretrizes da curva |

## Sobre os testes deste projeto

O ambiente onde este projeto foi construído tem acesso de rede restrito
e não conseguiu baixar um binário real do MongoDB para testes completos
de ponta a ponta. Para compensar, toda a lógica das rotas foi validada
com um banco MongoDB **simulado em memória** (implementando o mesmo
subconjunto da API oficial do driver `mongodb` usado pelo código:
`find`, `findOne`, `insertOne`, `insertMany`, `updateOne`, `deleteOne`,
`countDocuments`), incluindo cenários como:
- Criação de setor manual e checagem de duplicidade;
- Isolamento entre curva geral e curva por setor (um acidente grave
  registrado em "Produção" derrubou a curva geral e a de Produção, mas
  **não alterou em nada** a curva de outro setor, como esperado);
- Atualização de diretrizes (pesos, mínimo aceitável);
- Erros de rota sempre em JSON, nunca HTML/405.

**Antes de considerar o deploy final validado, rode `npm install` e
`npm start` localmente com uma `MONGODB_URI` real (Atlas ou local) e
confirme que o `/api/health` responde e que os dois painéis carregam a
curva.** A lógica de negócio está testada; a conexão com um MongoDB de
verdade, por essa limitação do ambiente, não pôde ser exercitada aqui.

## Personalização visual

Cores, fontes e espaçamentos ficam centralizados em variáveis CSS no
topo de `frontend/css/style.css` (bloco `:root`), incluindo as cores dos
4 níveis da curva.
