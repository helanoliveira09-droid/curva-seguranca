// js/admin.js
(function () {

  let CONFIG = null;
  let RANGE_GERAL = 180;
  let RANGE_SETOR = 90;
  let setorSelecionado = null; // nome do setor atualmente exibido no detalhe

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
  // Navegação entre seções
  // ============================================================
  document.querySelectorAll('.nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      document.getElementById(item.dataset.target).classList.add('active');

      if (item.dataset.target === 'page-eventos') carregarTabelaCompleta();
      if (item.dataset.target === 'page-setores') carregarSetores();
      if (item.dataset.target === 'page-diretrizes') carregarConfigForm();
    });
  });

  // ============================================================
  // Config geral (labels/pesos/limiares) — usada pelos selects
  // ============================================================
  async function carregarConfig() {
    CONFIG = await Api.config();
    const tipos = Object.keys(CONFIG.labels);

    const selEvTipo = document.getElementById('evTipo');
    const selFiltro = document.getElementById('filtroTipo');
    selEvTipo.innerHTML = '';
    selFiltro.innerHTML = '<option value="">Todos</option>';
    tipos.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = CONFIG.labels[t];
      selEvTipo.appendChild(opt);
      selFiltro.appendChild(opt.cloneNode(true));
    });
  }

  // ============================================================
  // Popular selects de setor (evento + filtro)
  // ============================================================
  let SETORES_CACHE = [];
  async function carregarSetoresParaSelects() {
    SETORES_CACHE = await Api.setores();
    const selEv = document.getElementById('evSetor');
    const selFiltro = document.getElementById('filtroSetor');
    selEv.innerHTML = '';
    selFiltro.innerHTML = '<option value="">Todos</option>';
    SETORES_CACHE.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.nome; opt.textContent = s.nome;
      selEv.appendChild(opt);
      selFiltro.appendChild(opt.cloneNode(true));
    });
    if (SETORES_CACHE.length === 0) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = 'Nenhum setor cadastrado ainda';
      selEv.appendChild(opt);
    }
  }

  // ============================================================
  // PAINEL GERAL
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

    const statusEl = document.getElementById('statusMinimoTexto');
    statusEl.textContent = acima
      ? `A operação está ${(r.atual.score - r.minimoAceitavel).toFixed(1)} pontos acima do mínimo aceitável.`
      : `Atenção: a operação está ${(r.minimoAceitavel - r.atual.score).toFixed(1)} pontos abaixo do mínimo aceitável.`;
  }

  async function renderizarRecentes() {
    const eventos = await Api.eventos();
    const recentes = eventos.slice(0, 6);
    const tbody = document.querySelector('#tabelaRecentes tbody');
    if (recentes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Nenhum evento registrado ainda.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = recentes.map(ev => `
      <tr>
        <td class="ev-date">${formatarData(ev.data)}</td>
        <td class="ev-title">${escapeHtml(ev.titulo)}</td>
        <td class="ev-meta">${escapeHtml(ev.setor)}</td>
        <td><span class="type-pill ${pillClasse(ev.tipo)}">${CONFIG.labels[ev.tipo] || ev.tipo}</span></td>
        <td class="row-actions"><button data-id="${ev._id}" class="btn-del-evento" title="Remover">✕</button></td>
      </tr>
    `).join('');
    bindRemoverEvento(tbody);
  }

  // ============================================================
  // PÁGINA EVENTOS (lista completa + filtros)
  // ============================================================
  async function carregarTabelaCompleta() {
    const filtros = {};
    const tipo = document.getElementById('filtroTipo').value;
    const setor = document.getElementById('filtroSetor').value;
    const de = document.getElementById('filtroDe').value;
    const ate = document.getElementById('filtroAte').value;
    if (tipo) filtros.tipo = tipo;
    if (setor) filtros.setor = setor;
    if (de) filtros.de = de;
    if (ate) filtros.ate = ate;

    const eventos = await Api.eventos(filtros);
    const tbody = document.querySelector('#tabelaCompleta tbody');
    if (eventos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Nenhum evento encontrado para esse filtro.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = eventos.map(ev => `
      <tr>
        <td class="ev-date">${formatarData(ev.data)}</td>
        <td class="ev-title">${escapeHtml(ev.titulo)}${ev.observacao ? `<div class="ev-meta">${escapeHtml(ev.observacao)}</div>` : ''}</td>
        <td class="ev-meta">${escapeHtml(ev.setor)}</td>
        <td><span class="type-pill ${pillClasse(ev.tipo)}">${CONFIG.labels[ev.tipo] || ev.tipo}</span></td>
        <td class="row-actions"><button data-id="${ev._id}" class="btn-del-evento" title="Remover">✕</button></td>
      </tr>
    `).join('');
    bindRemoverEvento(tbody);
  }

  function bindRemoverEvento(container) {
    container.querySelectorAll('.btn-del-evento').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover este evento? Isso recalcula a(s) curva(s) afetada(s).')) return;
        try {
          await Api.removerEvento(btn.dataset.id);
          toast('Evento removido.', 'sucesso');
          await atualizarPainelGeral();
          if (document.getElementById('page-eventos').classList.contains('active')) carregarTabelaCompleta();
          if (document.getElementById('page-setores').classList.contains('active')) carregarSetores(true);
        } catch (err) {
          toast(err.message, 'erro');
        }
      });
    });
  }

  ['filtroTipo', 'filtroSetor', 'filtroDe', 'filtroAte'].forEach(id => {
    document.getElementById(id).addEventListener('change', carregarTabelaCompleta);
  });
  document.getElementById('btnLimparFiltro').addEventListener('click', () => {
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroSetor').value = '';
    document.getElementById('filtroDe').value = '';
    document.getElementById('filtroAte').value = '';
    carregarTabelaCompleta();
  });

  // ============================================================
  // MODAL: NOVO EVENTO (com criação rápida de setor embutida)
  // ============================================================
  const modalEvento = document.getElementById('modalEvento');
  function abrirModalEvento() {
    document.getElementById('formEvento').reset();
    document.getElementById('evData').value = new Date().toISOString().slice(0, 10);
    document.getElementById('novoSetorInline').classList.add('hidden');
    modalEvento.classList.remove('hidden');
  }
  function fecharModalEvento() { modalEvento.classList.add('hidden'); }

  ['btnNovoEvento', 'btnNovoEvento2'].forEach(id => {
    document.getElementById(id).addEventListener('click', abrirModalEvento);
  });
  document.getElementById('btnCancelarEvento').addEventListener('click', fecharModalEvento);
  modalEvento.addEventListener('click', (e) => { if (e.target === modalEvento) fecharModalEvento(); });

  document.getElementById('linkAddSetorInline').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('novoSetorInline').classList.toggle('hidden');
  });

  document.getElementById('btnCriarSetorInline').addEventListener('click', async () => {
    const nome = document.getElementById('evNovoSetorNome').value.trim();
    if (!nome) { toast('Digite o nome do novo setor.', 'erro'); return; }
    try {
      const novo = await Api.criarSetor({ nome });
      toast(`Setor "${novo.nome}" criado.`, 'sucesso');
      await carregarSetoresParaSelects();
      document.getElementById('evSetor').value = novo.nome;
      document.getElementById('novoSetorInline').classList.add('hidden');
      document.getElementById('evNovoSetorNome').value = '';
    } catch (err) {
      toast(err.message, 'erro');
    }
  });

  document.getElementById('formEvento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const setorValor = document.getElementById('evSetor').value;
    if (!setorValor) {
      toast('Cadastre ou selecione um setor antes de salvar.', 'erro');
      return;
    }
    const payload = {
      tipo: document.getElementById('evTipo').value,
      titulo: document.getElementById('evTitulo').value.trim(),
      setor: setorValor,
      data: document.getElementById('evData').value,
      observacao: document.getElementById('evObs').value.trim()
    };
    try {
      await Api.criarEvento(payload);
      toast('Evento registrado com sucesso.', 'sucesso');
      fecharModalEvento();
      await atualizarPainelGeral();
      if (document.getElementById('page-eventos').classList.contains('active')) carregarTabelaCompleta();
      if (document.getElementById('page-setores').classList.contains('active')) carregarSetores(true);
    } catch (err) {
      toast(err.message, 'erro');
    }
  });

  // ============================================================
  // PÁGINA SETORES
  // ============================================================
  document.getElementById('formNovoSetor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('setorNome').value.trim();
    const descricao = document.getElementById('setorDescricao').value.trim();
    if (!nome) return;
    try {
      await Api.criarSetor({ nome, descricao });
      toast(`Setor "${nome}" adicionado.`, 'sucesso');
      document.getElementById('formNovoSetor').reset();
      await carregarSetoresParaSelects();
      await carregarSetores();
    } catch (err) {
      toast(err.message, 'erro');
    }
  });

  async function carregarSetores(manterSelecao) {
    const dados = await Api.resumoSetores();
    CONFIG.minimoAceitavel = dados.minimoAceitavel;
    CONFIG.limiares = dados.limiares;

    const grid = document.getElementById('sectorsGrid');
    if (dados.setores.length === 0) {
      grid.innerHTML = `<div class="sector-empty">Nenhum setor cadastrado ainda. Use o formulário acima para adicionar o primeiro.</div>`;
      document.getElementById('sectorDetailPanel').style.display = 'none';
      document.getElementById('pickASector').style.display = 'block';
      return;
    }

    grid.innerHTML = dados.setores.map(s => `
      <div class="sector-card ${setorSelecionado === s.setor ? 'selected' : ''}" data-setor="${escapeHtml(s.setor)}">
        <button class="sc-del" data-id="${s._id}" title="Remover setor">✕</button>
        <div class="sc-head">
          <div class="sc-name">${escapeHtml(s.setor)}</div>
        </div>
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
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('sc-del')) return;
        selecionarSetor(card.dataset.setor);
      });
    });
    grid.querySelectorAll('.sc-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Remover este setor da lista? Os eventos já registrados com ele permanecem no histórico.')) return;
        try {
          await Api.removerSetor(btn.dataset.id);
          toast('Setor removido.', 'sucesso');
          await carregarSetoresParaSelects();
          await carregarSetores();
        } catch (err) {
          toast(err.message, 'erro');
        }
      });
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
    const painel = document.getElementById('sectorDetailPanel');
    painel.style.display = 'block';
    document.getElementById('sectorDetailName').textContent = nome;

    const setorInfo = SETORES_CACHE.find(s => s.nome === nome);
    document.getElementById('sectorDetailDesc').textContent = setorInfo?.descricao || '';

    try {
      const dados = await Api.curva(RANGE_SETOR, nome);
      renderizarCurvaEmCanvas('curveChartSetor', dados, CONFIG.limiares, CONFIG.minimoAceitavel);
    } catch (err) {
      toast('Erro ao carregar a curva do setor: ' + err.message, 'erro');
    }

    const eventos = await Api.eventos({ setor: nome });
    const tbody = document.querySelector('#tabelaSetorEventos tbody');
    if (eventos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nenhum evento registrado para este setor ainda.</div></td></tr>`;
    } else {
      tbody.innerHTML = eventos.slice(0, 15).map(ev => `
        <tr>
          <td class="ev-date">${formatarData(ev.data)}</td>
          <td class="ev-title">${escapeHtml(ev.titulo)}</td>
          <td><span class="type-pill ${pillClasse(ev.tipo)}">${CONFIG.labels[ev.tipo] || ev.tipo}</span></td>
          <td class="row-actions"><button data-id="${ev._id}" class="btn-del-evento" title="Remover">✕</button></td>
        </tr>
      `).join('');
      bindRemoverEvento(tbody);
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
  // PÁGINA DIRETRIZES & PESOS
  // ============================================================
  async function carregarConfigForm() {
    const cfg = CONFIG || await Api.config();
    document.getElementById('cfgMinimo').value = cfg.minimoAceitavel;
    document.getElementById('cfgBaseline').value = cfg.baseline;
    document.getElementById('cfgRecovery').value = cfg.recoveryPerDay;

    document.getElementById('weightsGrid').innerHTML = Object.keys(cfg.pesos).map(tipo => `
      <div class="weight-item">
        <span class="w-label">${cfg.labels[tipo] || tipo}</span>
        <input type="number" data-tipo="${tipo}" value="${cfg.pesos[tipo]}" step="1">
      </div>
    `).join('');
  }

  document.getElementById('btnSalvarConfig').addEventListener('click', async () => {
    const pesos = {};
    document.querySelectorAll('#weightsGrid input').forEach(inp => { pesos[inp.dataset.tipo] = Number(inp.value); });
    const payload = {
      minimoAceitavel: Number(document.getElementById('cfgMinimo').value),
      baseline: Number(document.getElementById('cfgBaseline').value),
      recoveryPerDay: Number(document.getElementById('cfgRecovery').value),
      pesos
    };
    try {
      CONFIG = await Api.salvarConfig(payload);
      toast('Diretrizes atualizadas.', 'sucesso');
      await atualizarPainelGeral();
    } catch (err) {
      toast(err.message, 'erro');
    }
  });

  // ============================================================
  // Boot
  // ============================================================
  async function atualizarPainelGeral() {
    await Promise.all([renderizarCurvaGeral(), renderizarCards(), renderizarRecentes()]);
  }

  async function boot() {
    await checarConexao();
    await carregarConfig();
    await carregarSetoresParaSelects();
    await atualizarPainelGeral();
  }

  boot().catch(err => toast(err.message, 'erro'));

})();
