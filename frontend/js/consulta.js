// js/consulta.js
(function () {

  let CONFIG = null;
  let RANGE_GERAL = 180;
  let RANGE_SETOR = 90;
  let setorSelecionado = null;
  let paginaAtiva = 'page-painel';

  // ============================================================
  // Checagem de conexão com o backend
  // ============================================================
  async function checarConexao() {
    try {
      await Api.health();
    } catch (err) {
      const banner = document.getElementById('bannerConexao');
      banner.textContent = err.message;
      banner.classList.remove('hidden');
      throw err;
    }
  }

  // ============================================================
  // Navegação
  // ============================================================
  document.querySelectorAll('.nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      document.getElementById(item.dataset.target).classList.add('active');
      paginaAtiva = item.dataset.target;

      if (paginaAtiva === 'page-setores') carregarSetores(true);
    });
  });

  // ============================================================
  // Config (labels/limiares) — necessário para legendas e cores
  // ============================================================
  async function carregarConfig() {
    CONFIG = await Api.config();
  }

  // ============================================================
  // PAINEL GERAL (somente leitura)
  // ============================================================
  async function renderizarCurvaGeral() {
    try {
      const dados = await Api.curva(RANGE_GERAL);
      renderizarCurvaEmCanvas('curveChartGeral', dados, CONFIG.limiares, CONFIG.minimoAceitavel);
    } catch (err) {
      toast('Erro ao carregar a curva geral: ' + err.message, 'erro');
    }
  }

  document.getElementById('rangeToggleGeral').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    RANGE_GERAL = Number(btn.dataset.dias);
    document.querySelectorAll('#rangeToggleGeral button').forEach(b => b.classList.toggle('active', b === btn));
    await renderizarCurvaGeral();
  });

  async function renderizarCards() {
    const r = await Api.resumo();
    const nivel = r.atual.nivel;
    const acima = r.atual.score >= r.minimoAceitavel;
    const tIcone = r.tendencia30dias >= 0 ? '▲' : '▼';
    const tClasse = r.tendencia30dias >= 0 ? 'trend-up' : 'trend-down';

    document.getElementById('cardsRow').innerHTML = `
      <div class="card accent-${nivel}">
        <div class="card-label">Índice atual (geral)</div>
        <div class="card-value">${r.atual.score.toFixed(1)} <small>/ 100</small></div>
        <div class="card-foot"><span class="badge ${nivel}">${nivelLabel(nivel)}</span></div>
      </div>
      <div class="card">
        <div class="card-label">Mínimo aceitável</div>
        <div class="card-value">${r.minimoAceitavel} <small>/ 100</small></div>
        <div class="card-foot">${acima ? 'Operação acima do piso' : 'Operação abaixo do piso'}</div>
      </div>
      <div class="card">
        <div class="card-label">Tendência (30 dias)</div>
        <div class="card-value ${tClasse}">${tIcone} ${Math.abs(r.tendencia30dias).toFixed(1)}</div>
        <div class="card-foot">Variação do índice no último mês</div>
      </div>
      <div class="card">
        <div class="card-label">Eventos (30 dias)</div>
        <div class="card-value">${r.totalEventos30dias}</div>
        <div class="card-foot">Todos os setores</div>
      </div>
    `;

    document.getElementById('minAceitavelValor').textContent = r.minimoAceitavel;
    const badge = document.getElementById('nivelAtualBadge');
    badge.className = `badge ${nivel}`;
    badge.textContent = nivelLabel(nivel);

    document.getElementById('statusMinimoTexto').textContent = acima
      ? `A operação está ${(r.atual.score - r.minimoAceitavel).toFixed(1)} pontos acima do mínimo aceitável.`
      : `Atenção: a operação está ${(r.minimoAceitavel - r.atual.score).toFixed(1)} pontos abaixo do mínimo aceitável.`;
  }

  async function renderizarRecentes() {
    const eventos = await Api.eventos();
    const recentes = eventos.slice(0, 6);
    const tbody = document.querySelector('#tabelaRecentes tbody');
    if (recentes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nenhum evento registrado ainda.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = recentes.map(ev => `
      <tr>
        <td class="ev-date">${formatarData(ev.data)}</td>
        <td class="ev-title">${escapeHtml(ev.titulo)}</td>
        <td class="ev-meta">${escapeHtml(ev.setor)}</td>
        <td><span class="type-pill ${pillClasse(ev.tipo)}">${CONFIG.labels[ev.tipo] || ev.tipo}</span></td>
      </tr>
    `).join('');
  }

  document.getElementById('btnAtualizarAgora').addEventListener('click', () => {
    atualizarPaginaAtiva(true);
  });

  // ============================================================
  // PÁGINA SETORES (somente leitura)
  // ============================================================
  async function carregarSetores(manterSelecao) {
    const dados = await Api.resumoSetores();
    CONFIG.minimoAceitavel = dados.minimoAceitavel;
    CONFIG.limiares = dados.limiares;

    const grid = document.getElementById('sectorsGrid');
    if (dados.setores.length === 0) {
      grid.innerHTML = `<div class="sector-empty">Nenhum setor cadastrado ainda. Peça a um administrador para cadastrar no painel administrativo.</div>`;
      document.getElementById('sectorDetailPanel').style.display = 'none';
      document.getElementById('pickASector').style.display = 'block';
      return;
    }

    grid.innerHTML = dados.setores.map(s => `
      <div class="sector-card ${setorSelecionado === s.setor ? 'selected' : ''}" data-setor="${escapeHtml(s.setor)}">
        <div class="sc-head"><div class="sc-name">${escapeHtml(s.setor)}</div></div>
        <div class="sc-desc">${escapeHtml(s.descricao || '')}</div>
        <div class="sc-score" style="color:${corPorScore(s.atual.score, dados.limiares)}">
          ${s.atual.score.toFixed(1)} <small>/ 100</small>
        </div>
        <div class="sc-foot">
          <span class="badge ${s.atual.nivel}">${nivelLabel(s.atual.nivel)}</span>
          <span class="sc-events">${s.totalEventos} evento(s)</span>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.sector-card').forEach(card => {
      card.addEventListener('click', () => selecionarSetor(card.dataset.setor));
    });

    if (manterSelecao && setorSelecionado && dados.setores.some(s => s.setor === setorSelecionado)) {
      await renderizarDetalheSetor(setorSelecionado);
    } else if (!manterSelecao) {
      document.getElementById('sectorDetailPanel').style.display = 'none';
      document.getElementById('pickASector').style.display = 'block';
      setorSelecionado = null;
    }
  }

  async function selecionarSetor(nome) {
    setorSelecionado = nome;
    document.querySelectorAll('.sector-card').forEach(c => c.classList.toggle('selected', c.dataset.setor === nome));
    await renderizarDetalheSetor(nome);
  }

  async function renderizarDetalheSetor(nome) {
    document.getElementById('pickASector').style.display = 'none';
    document.getElementById('sectorDetailPanel').style.display = 'block';
    document.getElementById('sectorDetailName').textContent = nome;

    try {
      const setores = await Api.setores();
      const info = setores.find(s => s.nome === nome);
      document.getElementById('sectorDetailDesc').textContent = info?.descricao || '';
    } catch { /* segue sem descrição se falhar */ }

    try {
      const dados = await Api.curva(RANGE_SETOR, nome);
      renderizarCurvaEmCanvas('curveChartSetor', dados, CONFIG.limiares, CONFIG.minimoAceitavel);
    } catch (err) {
      toast('Erro ao carregar a curva do setor: ' + err.message, 'erro');
    }

    const eventos = await Api.eventos({ setor: nome });
    const tbody = document.querySelector('#tabelaSetorEventos tbody');
    if (eventos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">Nenhum evento registrado para este setor ainda.</div></td></tr>`;
    } else {
      tbody.innerHTML = eventos.slice(0, 15).map(ev => `
        <tr>
          <td class="ev-date">${formatarData(ev.data)}</td>
          <td class="ev-title">${escapeHtml(ev.titulo)}</td>
          <td><span class="type-pill ${pillClasse(ev.tipo)}">${CONFIG.labels[ev.tipo] || ev.tipo}</span></td>
        </tr>
      `).join('');
    }
  }

  document.getElementById('rangeToggleSetor').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || !setorSelecionado) return;
    RANGE_SETOR = Number(btn.dataset.dias);
    document.querySelectorAll('#rangeToggleSetor button').forEach(b => b.classList.toggle('active', b === btn));
    await renderizarDetalheSetor(setorSelecionado);
  });

  // ============================================================
  // Atualização — manual e automática (comunicação com o admin)
  // ============================================================
  async function atualizarPaginaAtiva(comFeedback) {
    try {
      if (paginaAtiva === 'page-painel') {
        await Promise.all([renderizarCurvaGeral(), renderizarCards(), renderizarRecentes()]);
      } else if (paginaAtiva === 'page-setores') {
        await carregarSetores(true);
      }
      if (comFeedback) toast('Dados atualizados.', 'sucesso');
    } catch (err) {
      if (comFeedback) toast(err.message, 'erro');
    }
  }

  // Como não há login nem WebSocket, a "comunicação" entre o painel
  // administrativo e o de consulta é o próprio backend/MongoDB
  // compartilhado: qualquer alteração feita no admin fica disponível
  // aqui automaticamente a cada atualização periódica (45s) ou manual.
  const INTERVALO_ATUALIZACAO_MS = 45000;
  setInterval(() => atualizarPaginaAtiva(false), INTERVALO_ATUALIZACAO_MS);

  // ============================================================
  // Boot
  // ============================================================
  async function boot() {
    await checarConexao();
    await carregarConfig();
    await Promise.all([renderizarCurvaGeral(), renderizarCards(), renderizarRecentes()]);
  }

  boot().catch(err => toast(err.message, 'erro'));

})();
