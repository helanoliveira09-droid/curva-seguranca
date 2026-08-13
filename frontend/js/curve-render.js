// js/curve-render.js
// Funções compartilhadas entre o painel administrativo e o de consulta:
// cor por nível, formatação, escape de HTML, toast e o próprio desenho
// do gráfico da curva (com as faixas coloridas de fundo e a linha de
// mínimo aceitável). Mantido num único lugar para os dois painéis nunca
// divergirem visualmente.

function corPorScore(score, limiares) {
  if (score < limiares.critico) return '#e4483d';
  if (score < limiares.moderado) return '#f2994a';
  if (score < limiares.normal) return '#2fb0a8';
  return '#3dbe6c';
}

function nivelLabel(nivel) {
  return { critico: 'Crítico', moderado: 'Moderado', normal: 'Normal', melhorado: 'Melhorado' }[nivel] || nivel;
}

function formatarData(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function pillClasse(tipo) {
  const positivos = ['documento_seguranca', 'treinamento', 'auditoria_aprovada'];
  const fortesNegativos = ['acidente'];
  if (positivos.includes(tipo)) return 'pos';
  if (fortesNegativos.includes(tipo)) return 'neg-forte';
  return 'neg-leve';
}

function toast(msg, tipo = '') {
  const area = document.getElementById('toastArea');
  if (!area) { console.log(`[toast:${tipo}]`, msg); return; }
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function criarZonasPlugin(limiares, minimoAceitavel) {
  return {
    id: 'zonasSeguranca',
    beforeDatasetsDraw(chartInstance) {
      const { ctx, chartArea, scales } = chartInstance;
      if (!chartArea) return;
      const y = scales.y;
      const zonas = [
        { de: 0, ate: limiares.critico, cor: 'rgba(228,72,61,0.08)' },
        { de: limiares.critico, ate: limiares.moderado, cor: 'rgba(242,153,74,0.08)' },
        { de: limiares.moderado, ate: limiares.normal, cor: 'rgba(47,176,168,0.07)' },
        { de: limiares.normal, ate: 100, cor: 'rgba(61,190,108,0.09)' }
      ];
      ctx.save();
      zonas.forEach(z => {
        const yTop = y.getPixelForValue(z.ate);
        const yBottom = y.getPixelForValue(z.de);
        ctx.fillStyle = z.cor;
        ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBottom - yTop);
      });

      const yMin = y.getPixelForValue(minimoAceitavel);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(238,242,246,0.55)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yMin);
      ctx.lineTo(chartArea.right, yMin);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  };
}

// Guarda instâncias de Chart.js por id de canvas, para destruir antes de recriar.
const _chartInstances = {};

/**
 * Desenha (ou redesenha) o gráfico da curva num <canvas>.
 * @param {string} canvasId - id do elemento <canvas>
 * @param {Object} dadosCurva - retorno de Api.curva() -> {serie, atual}
 * @param {Object} limiares - {critico, moderado, normal}
 * @param {number} minimoAceitavel
 */
function renderizarCurvaEmCanvas(canvasId, dadosCurva, limiares, minimoAceitavel) {
  const wrap = document.getElementById(canvasId)?.parentElement;
  if (wrap && !document.getElementById(canvasId)) {
    wrap.innerHTML = `<canvas id="${canvasId}"></canvas>`;
  }
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;

  if (_chartInstances[canvasId]) {
    _chartInstances[canvasId].destroy();
    delete _chartInstances[canvasId];
  }

  const serie = dadosCurva.serie;
  const labels = serie.map(p => formatarData(p.data));
  const valores = serie.map(p => p.score);
  const corLinha = corPorScore(dadosCurva.atual.score, limiares);

  const chart = new Chart(canvasEl, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Índice de segurança',
        data: valores,
        borderColor: corLinha,
        borderWidth: 2.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: corLinha,
        tension: 0.35,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8a97a6', font: { family: 'JetBrains Mono', size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#8a97a6',
            font: { family: 'JetBrains Mono', size: 10 },
            maxTicksLimit: 8,
            autoSkip: true
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a212b',
          borderColor: '#2a3340',
          borderWidth: 1,
          titleColor: '#eef2f6',
          bodyColor: '#c7d1db',
          padding: 10,
          callbacks: { label: (item) => `Índice: ${item.formattedValue}` }
        }
      }
    },
    plugins: [criarZonasPlugin(limiares, minimoAceitavel)]
  });

  _chartInstances[canvasId] = chart;
  return chart;
}
