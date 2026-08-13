// routes/curve.js
const express = require('express');
const { getDb } = require('../db/mongo');
const { gerarCurva } = require('../utils/curveCalculator');
const { CONFIG_ID } = require('../seed/seedData');

const router = express.Router();

async function carregarEventosFiltrados(db, setor) {
  const filtro = {};
  if (setor) filtro.setor = setor;
  return db.collection('eventos').find(filtro).toArray();
}

// GET /api/curva?dias=180&setor=Produção
// Sem "setor": curva GERAL da empresa (painel principal, inalterado).
// Com "setor": curva calculada apenas com os eventos daquele setor.
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const dias = Math.min(365, Math.max(7, parseInt(req.query.dias) || 180));
    const setor = req.query.setor || null;

    const eventos = await carregarEventosFiltrados(db, setor);
    const config = await db.collection('config').findOne({ _id: CONFIG_ID });

    const resultado = gerarCurva(eventos, config, dias);
    res.json(resultado);
  } catch (err) { next(err); }
});

// GET /api/curva/resumo?setor=Produção (setor é opcional)
router.get('/resumo', async (req, res, next) => {
  try {
    const db = getDb();
    const setor = req.query.setor || null;

    const eventos = await carregarEventosFiltrados(db, setor);
    const config = await db.collection('config').findOne({ _id: CONFIG_ID });
    const curva90 = gerarCurva(eventos, config, 90);

    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const isoLimite = trintaDiasAtras.toISOString().slice(0, 10);

    const eventosUltimos30 = eventos.filter(e => e.data >= isoLimite);
    const contagemPorTipo = {};
    for (const e of eventosUltimos30) {
      contagemPorTipo[e.tipo] = (contagemPorTipo[e.tipo] || 0) + 1;
    }

    const serie = curva90.serie;
    const scoreAtual = curva90.atual.score;
    const score30diasAtras = serie[Math.max(0, serie.length - 30)].score;
    const tendencia = Math.round((scoreAtual - score30diasAtras) * 100) / 100;

    res.json({
      atual: curva90.atual,
      minimoAceitavel: config.minimoAceitavel,
      tendencia30dias: tendencia,
      totalEventos30dias: eventosUltimos30.length,
      contagemPorTipo,
      limiares: config.limiares
    });
  } catch (err) { next(err); }
});

// GET /api/curva/setores-resumo
// Retorna o índice atual de CADA setor cadastrado, usado na página de
// Setores (tanto no painel administrativo quanto no de consulta).
router.get('/setores-resumo', async (req, res, next) => {
  try {
    const db = getDb();
    const config = await db.collection('config').findOne({ _id: CONFIG_ID });
    const setores = await db.collection('setores').find({}).sort({ nome: 1 }).toArray();
    const todosEventos = await db.collection('eventos').find({}).toArray();

    const resumo = setores.map(s => {
      const eventosSetor = todosEventos.filter(e => e.setor === s.nome);
      const curva = gerarCurva(eventosSetor, config, 90);
      return {
        _id: s._id,
        setor: s.nome,
        descricao: s.descricao || '',
        atual: curva.atual,
        totalEventos: eventosSetor.length
      };
    });

    res.json({
      minimoAceitavel: config.minimoAceitavel,
      limiares: config.limiares,
      setores: resumo
    });
  } catch (err) { next(err); }
});

module.exports = router;
