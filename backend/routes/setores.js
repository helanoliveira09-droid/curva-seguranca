// routes/setores.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/mongo');

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/setores - lista todos os setores cadastrados
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const setores = await db.collection('setores').find({}).sort({ nome: 1 }).toArray();
    res.json(setores);
  } catch (err) { next(err); }
});

// POST /api/setores - cria um novo setor manualmente
router.post('/', async (req, res, next) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome do setor.' });
    }
    const nomeLimpo = String(nome).trim();
    const db = getDb();

    const existente = await db.collection('setores').findOne({
      nome: { $regex: `^${escapeRegex(nomeLimpo)}$`, $options: 'i' }
    });
    if (existente) {
      return res.status(409).json({ erro: 'Já existe um setor com esse nome.' });
    }

    const doc = {
      nome: nomeLimpo,
      descricao: (descricao || '').trim(),
      criadoEm: new Date().toISOString()
    };
    const result = await db.collection('setores').insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) { next(err); }
});

// DELETE /api/setores/:id - remove um setor da lista de gestão
// (não apaga eventos já registrados com esse nome de setor — eles
// continuam existindo como histórico, apenas o setor sai da lista ativa)
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ erro: 'ID de setor inválido.' });
    }
    const result = await db.collection('setores').deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ erro: 'Setor não encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
