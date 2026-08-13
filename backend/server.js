// server.js
// Sistema de Curva de Segurança - API principal (sem login, MongoDB)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { connect } = require('./db/mongo');
const { seedIfEmpty } = require('./seed/seedData');

const eventsRoutes = require('./routes/events');
const curveRoutes = require('./routes/curve');
const configRoutes = require('./routes/config');
const setoresRoutes = require('./routes/setores');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS explícito (preflight incluso) — a API não exige autenticação,
// então qualquer front (admin ou consulta) pode consumi-la livremente.
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// ---- Rotas da API (sem autenticação: não há usuários/login) ----
app.use('/api/eventos', eventsRoutes);
app.use('/api/curva', curveRoutes);
app.use('/api/config', configRoutes);
app.use('/api/setores', setoresRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', servico: 'curva-seguranca-api', banco: 'mongodb' });
});

// Qualquer /api/* não reconhecida responde em JSON (nunca a página HTML
// padrão de erro do Express), para o front sempre conseguir interpretar.
app.all('/api/*', (req, res) => {
  res.status(404).json({ erro: `Rota de API não encontrada: ${req.method} ${req.path}` });
});

// ---- Frontend estático: dois pontos de entrada ----
// /              -> frontend/index.html   (painel de CONSULTA, somente leitura)
// /admin.html    -> frontend/admin.html   (painel ADMINISTRATIVO, com edição)
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// ---- Tratamento de erros genérico ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: err.message || 'Erro interno do servidor.' });
});

async function start() {
  try {
    const db = await connect();
    await seedIfEmpty(db);

    // 0.0.0.0 é necessário na maioria dos provedores de nuvem (Render,
    // Railway, Fly.io etc.), que injetam a porta pública via PORT.
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Sistema de Curva de Segurança rodando na porta ${PORT}`);
      console.log(`  Painel de consulta:      http://localhost:${PORT}/`);
      console.log(`  Painel administrativo:   http://localhost:${PORT}/admin.html`);
    });
  } catch (err) {
    console.error('Falha ao iniciar o servidor / conectar ao MongoDB:', err.message);
    console.error('Verifique a variável de ambiente MONGODB_URI.');
    process.exit(1);
  }
}

start();
