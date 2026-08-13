// utils/curveCalculator.js
// Motor de cálculo da Curva de Segurança da empresa.
//
// Lógica:
// - Existe uma pontuação diária de 0 a 100 (o "índice de segurança").
// - Todo dia, sem novos eventos, a pontuação tende a se recuperar/decair
//   em direção à linha de base (baseline) configurada, a uma taxa
//   "recoveryPerDay". Isso simula que a empresa nem "esquece" um problema
//   de um dia para o outro, nem fica presa a ele para sempre.
// - Cada evento registrado (documento, acidente, incidente, notificação,
//   irregularidade, treinamento, auditoria) soma ou subtrai pontos na
//   data em que ocorreu, conforme os pesos definidos em config.json.
// - A pontuação é sempre limitada entre 0 e 100.
// - A partir da pontuação, classificamos o nível: crítico, moderado,
//   normal ou melhorado, de acordo com os limiares (limiares) do config.

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function classificar(score, limiares) {
  if (score < limiares.critico) return 'critico';
  if (score < limiares.moderado) return 'moderado';
  if (score < limiares.normal) return 'normal';
  return 'melhorado';
}

/**
 * Gera a série temporal (dia a dia) da curva de segurança.
 *
 * IMPORTANTE: a simulação sempre começa em uma âncora fixa (a data do
 * evento mais antigo, com uma folga de 30 dias, limitada a no máximo 730
 * dias de histórico) e roda até hoje. Isso garante que o "score atual"
 * seja sempre o mesmo, não importa se o usuário está olhando os últimos
 * 30, 90, 180 ou 365 dias no gráfico — o parâmetro `days` apenas recorta
 * quantos pontos finais dessa série são devolvidos para exibição.
 *
 * @param {Array} events - lista de eventos [{tipo, data: 'YYYY-MM-DD', ...}]
 * @param {Object} config - configuração (pesos, baseline, limiares, recoveryPerDay)
 * @param {Number} days - quantidade de dias a EXIBIR no retorno (janela), padrão 180
 * @returns {Object} { serie: [{data, score, nivel}], atual: {score, nivel, data} }
 */
function gerarCurva(events, config, days = 180) {
  const { baseline, recoveryPerDay, pesos, limiares } = config;

  const today = toDateOnly(new Date());

  // Agrupa eventos por data (YYYY-MM-DD) somando os pesos do dia
  const eventosPorDia = {};
  let dataMaisAntiga = null;
  for (const ev of events) {
    if (!ev.data || !ev.tipo) continue;
    const peso = pesos[ev.tipo] ?? 0;
    eventosPorDia[ev.data] = (eventosPorDia[ev.data] || 0) + peso;

    const d = parseISODate(ev.data);
    if (!dataMaisAntiga || d < dataMaisAntiga) dataMaisAntiga = d;
  }

  // Âncora da simulação: sempre a mesma, independente do `days` exibido.
  const diasDesdeEventoMaisAntigo = dataMaisAntiga
    ? Math.round((today - dataMaisAntiga) / 86400000) + 30
    : days;
  const simulationDays = Math.min(730, Math.max(days, diasDesdeEventoMaisAntigo, 1));

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (simulationDays - 1));

  const serieCompleta = [];
  let score = baseline;

  for (let i = 0; i < simulationDays; i++) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    const iso = current.toISOString().slice(0, 10);

    // recuperação/decaimento em direção à baseline
    if (score > baseline) {
      score = Math.max(baseline, score - recoveryPerDay);
    } else if (score < baseline) {
      score = Math.min(baseline, score + recoveryPerDay);
    }

    // aplica eventos do dia
    if (eventosPorDia[iso] !== undefined) {
      score += eventosPorDia[iso];
    }

    // limita entre 0 e 100
    score = Math.max(0, Math.min(100, score));

    serieCompleta.push({
      data: iso,
      score: Math.round(score * 100) / 100,
      nivel: classificar(score, limiares)
    });
  }

  // Recorta apenas os últimos `days` pontos para exibição no gráfico,
  // mas o "atual" sempre reflete o último dia da simulação completa (hoje).
  const serie = serieCompleta.slice(-days);
  const atualPonto = serieCompleta[serieCompleta.length - 1];

  return {
    serie,
    atual: {
      score: atualPonto.score,
      nivel: atualPonto.nivel,
      data: atualPonto.data
    },
    minimoAceitavel: config.minimoAceitavel,
    limiares
  };
}

module.exports = { gerarCurva, classificar };
