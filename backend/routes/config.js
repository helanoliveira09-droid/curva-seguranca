// routes/config.js
const express = require('express');
const { getDb } = require('../db/mongo');
const { CONFIG_ID } = require('../seed/seedData');

const router = express.Router();

// GET /api/config
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const cfg = await db.collection('config').findOne({ _id: CONFIG_ID });
    res.json(cfg);
  } catch (err) { next(err); }
});

// PUT /api/config - atualiza diretrizes da curva (pesos, limiares, mínimo aceitável)
router.put('/', async (req, res, next) => {
  try {
    const db = getDb();
    const atual = await db.collection('config').findOne({ _id: CONFIG_ID });
    const { baseline, recoveryPerDay, minimoAceitavel, pesos, limiares } = req.body;

    const novo = {
      ...atual,
      baseline: baseline !== undefined ? Number(baseline) : atual.baseline,
      recoveryPerDay: recoveryPerDay !== undefined ? Number(recoveryPerDay) : atual.recoveryPerDay,
      minimoAceitavel: minimoAceitavel !== undefined ? Number(minimoAceitavel) : atual.minimoAceitavel,
      pesos: pesos ? { ...atual.pesos, ...pesos } : atual.pesos,
      limiares: limiares ? { ...atual.limiares, ...limiares } : atual.limiares
    };

    await db.collection('config').updateOne({ _id: CONFIG_ID }, { $set: novo }, { upsert: true });
    res.json(novo);
  } catch (err) { next(err); }
});

module.exports = router;
