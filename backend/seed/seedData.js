// seed/seedData.js
// Popula o MongoDB com dados iniciais (apenas se as coleções estiverem
// vazias), para que o sistema já mostre algo funcional no primeiro acesso.

const CONFIG_ID = 'geral';

const configPadrao = {
  _id: CONFIG_ID,
  baseline: 72,
  recoveryPerDay: 0.35,
  minimoAceitavel: 60,
  pesos: {
    documento_seguranca: 4,
    acidente: -25,
    incidente: -12,
    notificacao: -5,
    irregularidade: -8,
    treinamento: 6,
    auditoria_aprovada: 7
  },
  limiares: {
    critico: 40,
    moderado: 60,
    normal: 80
  },
  labels: {
    documento_seguranca: 'Documento de Segurança',
    acidente: 'Acidente',
    incidente: 'Incidente',
    notificacao: 'Notificação',
    irregularidade: 'Irregularidade (ambiente/equipamento)',
    treinamento: 'Treinamento realizado',
    auditoria_aprovada: 'Auditoria aprovada'
  }
};

const setoresPadrao = [
  { nome: 'Produção', descricao: 'Linha principal de produção' },
  { nome: 'Manutenção', descricao: 'Manutenção elétrica e mecânica' },
  { nome: 'Logística', descricao: 'Expedição e recebimento' },
  { nome: 'Almoxarifado', descricao: 'Armazenamento de materiais' },
  { nome: 'Administrativo', descricao: 'Escritórios administrativos' },
  { nome: 'Linha 2', descricao: 'Segunda linha de produção' },
  { nome: 'Caldeira', descricao: 'Sala de caldeiras' },
  { nome: 'Pátio Externo', descricao: 'Área externa e estacionamento' }
];

const descricoesEventos = {
  documento_seguranca: ['Atualização de procedimento operacional', 'Emissão de nova ficha de segurança (FISPQ)', 'Revisão de política de EPI', 'Publicação de instrução de trabalho'],
  acidente: ['Queda de altura durante manutenção', 'Corte em máquina sem proteção', 'Queimadura em contato com superfície quente', 'Acidente com empilhadeira'],
  incidente: ['Quase-acidente com queda de material', 'Vazamento controlado de fluido', 'Falha em trava de segurança sem lesão', 'Princípio de incêndio contido'],
  notificacao: ['Notificação de uso incorreto de EPI', 'Alerta de comportamento de risco', 'Notificação de excesso de jornada em área insalubre', 'Aviso de não conformidade em checklist'],
  irregularidade: ['Extintor vencido identificado', 'Piso escorregadio sem sinalização', 'Equipamento sem certificação de inspeção', 'Saída de emergência obstruída'],
  treinamento: ['Treinamento de NR-12 realizado', 'Simulado de evacuação executado', 'Capacitação em trabalho em altura', 'Reciclagem de brigada de incêndio'],
  auditoria_aprovada: ['Auditoria interna de segurança aprovada', 'Auditoria externa ISO 45001 aprovada']
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function gerarEventosNarrativa(setoresNomes) {
  const eventos = [];
  const today = new Date();

  function addEvent(daysAgo, tipo) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    eventos.push({
      tipo,
      titulo: pick(descricoesEventos[tipo]),
      setor: pick(setoresNomes),
      data: date.toISOString().slice(0, 10),
      observacao: '',
      responsavel: '',
      criadoEm: new Date().toISOString()
    });
  }

  // Fase 1 (180-141 dias atrás): operação normal
  for (let d = 180; d >= 141; d--) {
    if (Math.random() < 0.10) addEvent(d, Math.random() < 0.6 ? 'documento_seguranca' : 'notificacao');
  }
  // Fase 2 (140-101): sequência de incidentes/irregularidades -> queda
  for (let d = 140; d >= 101; d--) {
    const r = Math.random();
    if (r < 0.05) addEvent(d, 'acidente');
    else if (r < 0.16) addEvent(d, 'incidente');
    else if (r < 0.30) addEvent(d, 'irregularidade');
    else if (r < 0.38) addEvent(d, 'notificacao');
  }
  // Fase 3 (100-56): plano de ação -> recuperação
  for (let d = 100; d >= 56; d--) {
    const r = Math.random();
    if (r < 0.10) addEvent(d, 'treinamento');
    else if (r < 0.14) addEvent(d, 'auditoria_aprovada');
    else if (r < 0.22) addEvent(d, 'documento_seguranca');
    else if (r < 0.26) addEvent(d, 'notificacao');
  }
  // Fase 4 (55-16): estabilidade
  for (let d = 55; d >= 16; d--) {
    const r = Math.random();
    if (r < 0.07) addEvent(d, 'documento_seguranca');
    else if (r < 0.10) addEvent(d, 'irregularidade');
    else if (r < 0.13) addEvent(d, 'notificacao');
    else if (r < 0.16) addEvent(d, 'treinamento');
  }
  // Fase 5 (15-0): reforço final -> melhorado
  for (let d = 15; d >= 0; d--) {
    const r = Math.random();
    if (r < 0.20) addEvent(d, 'treinamento');
    else if (r < 0.30) addEvent(d, 'documento_seguranca');
    else if (r < 0.35) addEvent(d, 'auditoria_aprovada');
  }

  return eventos;
}

async function seedIfEmpty(db) {
  const cfgCount = await db.collection('config').countDocuments({ _id: CONFIG_ID });
  if (cfgCount === 0) {
    await db.collection('config').insertOne(configPadrao);
    console.log('[seed] Configuração padrão criada.');
  }

  let setoresNomes;
  const setCount = await db.collection('setores').countDocuments();
  if (setCount === 0) {
    const docs = setoresPadrao.map(s => ({ ...s, criadoEm: new Date().toISOString() }));
    await db.collection('setores').insertMany(docs);
    await db.collection('setores').createIndex({ nome: 1 }, { unique: true, collation: { locale: 'pt', strength: 2 } });
    console.log(`[seed] ${docs.length} setores padrão criados.`);
    setoresNomes = docs.map(d => d.nome);
  } else {
    setoresNomes = (await db.collection('setores').find({}).toArray()).map(s => s.nome);
  }

  const evCount = await db.collection('eventos').countDocuments();
  if (evCount === 0 && setoresNomes.length > 0) {
    const eventos = gerarEventosNarrativa(setoresNomes);
    if (eventos.length) {
      await db.collection('eventos').insertMany(eventos);
      console.log(`[seed] ${eventos.length} eventos de exemplo criados.`);
    }
  }
}

module.exports = { seedIfEmpty, configPadrao, setoresPadrao, CONFIG_ID };
