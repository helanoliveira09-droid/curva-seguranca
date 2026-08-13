// routes/events.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');
const { CONFIG_ID } = require('../seed/seedData');

const router = express.Router();

// GET /api/eventos - lista eventos, com filtros opcionais
// ?tipo=acidente&de=YYYY-MM-DD&ate=YYYY-MM-DD&setor=Produção
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { tipo, de, ate, setor } = req.query;
    const filtro = {};
    if (tipo) filtro.tipo = tipo;
    if (setor) filtro.setor = setor;
    if (de || ate) {
      filtro.data = {};
      if (de) filtro.data.$gte = de;
      if (ate) filtro.data.$lte = ate;
    }
    const eventos = await db.collection('eventos').find(filtro).sort({ data: -1 }).toArray();
    res.json(eventos);
  } catch (err) { next(err); }
});

// POST /api/eventos - cria novo evento
router.post('/', async (req, res, next) => {
  try {
    const db = getDb();
    const config = await db.collection('config').findOne({ _id: CONFIG_ID });
    const { tipo, titulo, setor, data, observacao, responsavel } = req.body;

    if (!tipo || !titulo || !data) {
      return res.status(400).json({ erro: 'Informe ao menos tipo, título e data do evento.' });
    }
    if (!config || !config.pesos || !Object.prototype.hasOwnProperty.call(config.pesos, tipo)) {
      return res.status(400).json({ erro: `Tipo de evento inválido: ${tipo}` });
    }
    if (!setor || !String(setor).trim()) {
      return res.status(400).json({ erro: 'Informe o setor do evento.' });
    }

    const doc = {
      tipo,
      titulo: String(titulo).trim(),
      setor: String(setor).trim(),
      data,
      observacao: (observacao || '').trim(),
      responsavel: (responsavel || '').trim(),
      criadoEm: new Date().toISOString()
    };

    const result = await db.collection('eventos').insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) { next(err); }
});

// DELETE /api/eventos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ erro: 'ID de evento inválido.' });
    }
    const result = await db.collection('eventos').deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
