// =============================================
//  TWO DREAMERS — PRECIFICAÇÃO  |  app.js  v2
// =============================================
'use strict';

// -----------------------------------------------
//  ESTADO
// -----------------------------------------------
let custos   = JSON.parse(localStorage.getItem('td_custos')   || '[]');
let clientes = JSON.parse(localStorage.getItem('td_clientes') || '[]');
let cart     = JSON.parse(localStorage.getItem('td_cart')     || '[]');
let modelos  = JSON.parse(localStorage.getItem('td_modelos')  || '[]');

// Tiers: { prata:5, ouro:10, diamante:15 }
let tiers = JSON.parse(localStorage.getItem('td_tiers') || 'null') || { prata:5, ouro:10, diamante:15 };

// Observações persistentes
let obs = localStorage.getItem('td_obs') || '';

// Itens selecionados no calculador: { id: quantidade }
let sel = {};

// ID editado no form de custo
let editCId = null;

// -----------------------------------------------
//  PERSIST / UTILS
// -----------------------------------------------
const persist = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmt(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function fmtDate() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// -----------------------------------------------
//  TOAST
// -----------------------------------------------
function toast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// -----------------------------------------------
//  TABS
// -----------------------------------------------
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab').forEach(c =>
    c.classList.toggle('active', c.id === 'tab-' + tab)
  );
  document.getElementById('pbar').style.display = tab === 'calcular' ? 'flex' : 'none';

  if (tab === 'calcular') renderCalc();
  if (tab === 'custos')   { renderCustoList(); loadTierInputs(); }
  if (tab === 'pedido')   renderCart();
  if (tab === 'clientes') renderClients();
}

// -----------------------------------------------
//  MODAIS
// -----------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
document.querySelectorAll('.overlay').forEach(ov =>
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); })
);

// -----------------------------------------------
//  COLLAPSIBLE / RANGE
// -----------------------------------------------
function toggleColl(id, btn) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
  btn.querySelector('span:last-child').textContent = el.classList.contains('open') ? '▲' : '▼';
}

function updRange(inputId, displayId, suffix) {
  document.getElementById(displayId).textContent =
    document.getElementById(inputId).value + suffix;
}

// -----------------------------------------------
//  OBSERVAÇÕES
// -----------------------------------------------
function saveObs() {
  obs = document.getElementById('contract-obs')?.value
     || document.getElementById('proposta-obs')?.value
     || '';
  localStorage.setItem('td_obs', obs);
  // Sync both textareas
  const po = document.getElementById('proposta-obs');
  const co = document.getElementById('contract-obs');
  if (po && po !== document.activeElement) po.value = obs;
  if (co && co !== document.activeElement) co.value = obs;
}

function loadObs() {
  obs = localStorage.getItem('td_obs') || '';
  const po = document.getElementById('proposta-obs');
  const co = document.getElementById('contract-obs');
  if (po) po.value = obs;
  if (co) co.value = obs;
}

// -----------------------------------------------
//  TIERS CONFIG
// -----------------------------------------------
function saveTiers() {
  tiers = {
    prata:    parseFloat(document.getElementById('tier-prata').value)    || 0,
    ouro:     parseFloat(document.getElementById('tier-ouro').value)     || 0,
    diamante: parseFloat(document.getElementById('tier-diamante').value) || 0,
  };
  persist('td_tiers', tiers);
}

function loadTierInputs() {
  document.getElementById('tier-prata').value    = tiers.prata;
  document.getElementById('tier-ouro').value     = tiers.ouro;
  document.getElementById('tier-diamante').value = tiers.diamante;
}

function setTierInfo() {
  const tier = document.getElementById('p-tier').value;
  const el   = document.getElementById('tier-info');
  const pct  = tiers[tier];
  if (tier === 'nenhum' || !pct) {
    el.style.display = 'none';
    return;
  }
  const labels = { prata: '🥈 Prata', ouro: '🥇 Ouro', diamante: '💎 Diamante' };
  el.style.display = 'block';
  el.textContent = `${labels[tier]}: desconto automático de ${pct}% aplicado ao preço base`;
}

// =============================================
//  ABA CALCULAR
// =============================================

function renderCalc() {
  renderModels();
  renderCselList();
  updatePbar();
}

function updatePbar() {
  const custo = calcCusto();
  document.getElementById('pbar-val').textContent = fmt(custo > 0 ? custo / 0.5 : 0);
}

function calcCusto() {
  return Object.entries(sel).reduce((acc, [id, qty]) => {
    const c = custos.find(x => x.id === id);
    if (!c) return acc;
    return acc + (c.tipo === 'mes' ? c.valor : c.valor * qty);
  }, 0);
}

// --- MODELOS ---
function renderModels() {
  const row = document.getElementById('models-scroll');
  if (!modelos.length) {
    row.innerHTML = `<p style="font-size:13px;color:var(--muted);padding:2px 0 10px;">
      Nenhum modelo salvo. Calcule um serviço e clique em "Salvar como modelo".
    </p>`;
    return;
  }
  row.innerHTML = modelos.map(m => {
    const preco = calcModelPrice(m);
    return `<div class="mcard" onclick="loadModel('${m.id}')">
      <button class="mcard-del" onclick="event.stopPropagation();delModel('${m.id}')">🗑️</button>
      <div class="mcard-name">${esc(m.nome)}</div>
      <div class="mcard-price">${fmt(preco)}</div>
    </div>`;
  }).join('');
}

function calcModelPrice(m, margem = 50) {
  const custo = (m.itens || []).reduce((acc, it) => {
    const c = custos.find(x => x.id === it.id);
    if (!c) return acc;
    return acc + (c.tipo === 'mes' ? c.valor : c.valor * it.qtd);
  }, 0);
  return custo > 0 ? custo / (1 - margem / 100) : 0;
}

function loadModel(id) {
  const m = modelos.find(x => x.id === id);
  if (!m) return;
  sel = {};
  (m.itens || []).forEach(it => { sel[it.id] = it.qtd; });
  renderCselList();
  updatePbar();
  if (m.tipoMidia?.ativo) {
    document.getElementById('p-midia').checked = true;
    document.getElementById('p-verba').value   = m.tipoMidia.verba    || 0;
    document.getElementById('p-tadmin').value  = m.tipoMidia.taxaAdmin || 15;
    document.getElementById('midia-bloco').style.display = 'block';
  }
  toast(`Modelo "${m.nome}" carregado`);
}

function delModel(id) {
  modelos = modelos.filter(m => m.id !== id);
  persist('td_modelos', modelos);
  renderModels();
  toast('Modelo removido');
}

// --- LISTA DE SELEÇÃO AGRUPADA POR CATEGORIA ---
function renderCselList() {
  const el = document.getElementById('csel-list');
  if (!custos.length) {
    el.innerHTML = `<div class="empty">
      <div class="eic">⚙️</div>
      <p>Nenhum item cadastrado ainda.<br>Vá em <strong>Custos</strong> para começar.</p>
    </div>`;
    return;
  }

  const colaboradores = custos.filter(c => (c.categoria || 'colaborador') === 'colaborador');
  const ferramentas   = custos.filter(c => c.categoria === 'ferramenta');
  let html = '';

  if (colaboradores.length) {
    html += `<div class="csel-header">👤 Colaboradores</div>`;
    html += colaboradores.map(c => renderCselItem(c)).join('');
  }
  if (ferramentas.length) {
    if (colaboradores.length) html += '<div style="height:6px;"></div>';
    html += `<div class="csel-header">🛠 Ferramentas & Assinaturas</div>`;
    html += ferramentas.map(c => renderCselItem(c)).join('');
  }

  el.innerHTML = html;
}

function renderCselItem(c) {
  const on  = c.id in sel;
  const qty = sel[c.id] || 1;
  const parcial  = on ? (c.tipo === 'mes' ? c.valor : c.valor * qty) : 0;
  const isColab  = (c.categoria || 'colaborador') === 'colaborador';
  const qtyLabel = isColab && c.tipo === 'hora' ? 'h no projeto' : '';

  return `<div class="csel-row">
    <div class="csel-chk${on ? ' on' : ''}" onclick="toggleSel('${c.id}')"></div>
    <div class="csel-info">
      <div class="csel-name">${esc(c.nome)}</div>
      <div class="csel-sub">${fmt(c.valor)}/${c.tipo === 'hora' ? 'hora' : 'mês fixo'}</div>
    </div>
    ${on ? `
      <div class="csel-qty">
        ${c.tipo === 'mes'
          ? `<input type="number" value="1" disabled>`
          : `<input type="number" value="${qty}" min="1" max="9999"
               oninput="updSel('${c.id}',this.value)"
               onclick="event.stopPropagation()">`
        }
        ${qtyLabel ? `<div class="csel-qty-lbl">${qtyLabel}</div>` : ''}
      </div>
      <div class="csel-val">${fmt(parcial)}</div>
    ` : ''}
  </div>`;
}

function toggleSel(id) {
  if (id in sel) delete sel[id];
  else sel[id] = 1;
  renderCselList();
  updatePbar();
}

function updSel(id, rawVal) {
  sel[id] = Math.max(1, parseFloat(rawVal) || 1);
  updatePbar();
  renderCselList();
}

// =============================================
//  ABA CUSTOS
// =============================================

function setCCat(cat, btn) {
  document.getElementById('c-cat').value = cat;
  document.querySelectorAll('#seg-cat button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Sugestão de tipo padrão por categoria
  if (cat === 'colaborador') setCTipoById('hora');
  else setCTipoById('mes');
}

function setCTipo(tipo, btn) {
  document.getElementById('c-tipo').value = tipo;
  document.querySelectorAll('#seg-tipo button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('c-valor-lbl').textContent =
    tipo === 'hora' ? 'Custo por hora (R$)' : 'Custo mensal fixo (R$)';
}

function setCTipoById(tipo) {
  const btns = document.querySelectorAll('#seg-tipo button');
  btns.forEach((b, i) => b.classList.toggle('active', (i === 0 && tipo === 'hora') || (i === 1 && tipo === 'mes')));
  document.getElementById('c-tipo').value = tipo;
  document.getElementById('c-valor-lbl').textContent =
    tipo === 'hora' ? 'Custo por hora (R$)' : 'Custo mensal fixo (R$)';
}

function saveCusto() {
  const nome  = document.getElementById('c-nome').value.trim();
  const cat   = document.getElementById('c-cat').value || 'colaborador';
  const tipo  = document.getElementById('c-tipo').value;
  const valor = parseFloat(document.getElementById('c-valor').value);

  if (!nome)               { toast('❌ Informe o nome do item'); return; }
  if (!valor || valor <= 0) { toast('❌ Informe um valor válido'); return; }

  if (editCId) {
    const i = custos.findIndex(c => c.id === editCId);
    if (i >= 0) custos[i] = { ...custos[i], nome, categoria: cat, tipo, valor };
    editCId = null;
    document.getElementById('custo-form-title').textContent = 'Novo item de custo';
    document.getElementById('c-cancel').style.display = 'none';
    toast('✅ Item atualizado');
  } else {
    custos.push({ id: uid(), nome, categoria: cat, tipo, valor, criadoEm: Date.now() });
    toast('✅ Item salvo');
  }

  persist('td_custos', custos);
  document.getElementById('c-nome').value  = '';
  document.getElementById('c-valor').value = '';
  renderCustoList();
}

function cancelCEdit() {
  editCId = null;
  document.getElementById('c-nome').value  = '';
  document.getElementById('c-valor').value = '';
  document.getElementById('custo-form-title').textContent = 'Novo item de custo';
  document.getElementById('c-cancel').style.display = 'none';
}

function editCusto(id) {
  const c = custos.find(x => x.id === id);
  if (!c) return;
  editCId = id;
  document.getElementById('c-nome').value  = c.nome;
  document.getElementById('c-valor').value = c.valor;

  const cat = c.categoria || 'colaborador';
  document.getElementById('c-cat').value = cat;
  document.querySelectorAll('#seg-cat button').forEach((b, i) =>
    b.classList.toggle('active', (i === 0 && cat === 'colaborador') || (i === 1 && cat === 'ferramenta'))
  );
  setCTipoById(c.tipo);
  document.getElementById('custo-form-title').textContent = 'Editar item';
  document.getElementById('c-cancel').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function delCusto(id) {
  custos = custos.filter(c => c.id !== id);
  delete sel[id];
  persist('td_custos', custos);
  renderCustoList();
  toast('🗑️ Item removido');
}

function renderCustoList() {
  const el = document.getElementById('custo-list');
  if (!custos.length) {
    el.innerHTML = `<div class="empty" style="padding:24px 0;">
      <div class="eic">📝</div><p>Nenhum item ainda. Cadastre acima.</p>
    </div>`;
    return;
  }

  // Agrupar por categoria
  const colaboradores = custos.filter(c => (c.categoria || 'colaborador') === 'colaborador');
  const ferramentas   = custos.filter(c => c.categoria === 'ferramenta');

  const renderGroup = (items, label) => items.length
    ? `<div style="font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;
         font-weight:700;padding:12px 0 4px;">${label}</div>` +
      items.map(c => `
        <div class="litem">
          <div class="litem-info">
            <div class="litem-name">${esc(c.nome)}</div>
            <div class="litem-sub">${fmt(c.valor)} / ${c.tipo === 'hora' ? 'hora' : 'mês fixo'}</div>
          </div>
          <div class="litem-acts">
            <button class="btn btn-ghost btn-sm" onclick="editCusto('${c.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="delCusto('${c.id}')">🗑️</button>
          </div>
        </div>`).join('')
    : '';

  el.innerHTML =
    renderGroup(colaboradores, '👤 Colaboradores') +
    renderGroup(ferramentas, '🛠 Ferramentas & Assinaturas');
}

// =============================================
//  CALCULADORA
// =============================================

function openCalc(editIdx = -1) {
  document.getElementById('p-edit-idx').value = editIdx;

  if (editIdx >= 0) {
    loadCartIntoCalc(cart[editIdx]);
    document.getElementById('btn-cart').textContent = '💾 Salvar edição';
  } else {
    document.getElementById('btn-cart').textContent = '➕ Adicionar ao Pedido';
  }

  showRegraByTipo(document.getElementById('p-tipo').value);
  setTierInfo();
  renderModalItems();
  calcPreco();
  openModal('ov-calc');
}

function loadCartIntoCalc(item) {
  sel = {};
  (item.itens || []).forEach(it => { sel[it.id] = it.qtd; });
  renderCselList();
  updatePbar();

  const tipo = item.tipo || 'mensal';
  document.getElementById('p-tipo').value = tipo;
  // sync seg-ctrl tipo cobrança
  const segBtns = document.querySelectorAll('#ov-calc .seg:first-of-type button');
  segBtns.forEach((b, i) =>
    b.classList.toggle('active', (i === 0 && tipo === 'mensal') || (i === 1 && tipo === 'projeto'))
  );
  document.getElementById('p-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
  showRegraByTipo(tipo);

  document.getElementById('p-meses').value   = item.meses      || 1;
  document.getElementById('p-margem').value  = item.margem     || 50;
  document.getElementById('p-margem-d').textContent = (item.margem || 50) + '%';
  document.getElementById('p-cartao').value  = item.taxaCartao || 0;
  document.getElementById('p-imposto').value = item.imposto    || 0;
  document.getElementById('p-desc').value    = item.desconto   || 0;
  document.getElementById('p-desc-d').textContent = (item.desconto || 0) + '%';
  document.getElementById('p-drec').value    = item.descontoRec   || 0;
  document.getElementById('p-drec-d').textContent = (item.descontoRec || 0) + '%';
  document.getElementById('p-sproj').value   = item.sobretaxaProj || 0;
  document.getElementById('p-sproj-d').textContent = (item.sobretaxaProj || 0) + '%';
  document.getElementById('p-nome').value    = item.nomeServico || '';
  document.getElementById('p-tier').value    = item.tier        || 'nenhum';
  document.getElementById('p-escopo').value  = item.escopo      || '';

  const m = item.midia;
  document.getElementById('p-midia').checked = !!(m?.ativo);
  document.getElementById('midia-bloco').style.display = m?.ativo ? 'block' : 'none';
  if (m?.ativo) {
    document.getElementById('p-verba').value  = m.verba    || 0;
    document.getElementById('p-tadmin').value = m.taxaAdmin || 15;
  }
}

function setTipoCob(tipo, btn) {
  document.getElementById('p-tipo').value = tipo;
  btn.closest('.seg').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('p-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
  showRegraByTipo(tipo);
  calcPreco();
}

function showRegraByTipo(tipo) {
  document.getElementById('regra-recorrente').style.display = tipo === 'mensal'  ? 'block' : 'none';
  document.getElementById('regra-projeto').style.display    = tipo === 'projeto' ? 'block' : 'none';
}

function toggleMidia() {
  document.getElementById('midia-bloco').style.display =
    document.getElementById('p-midia').checked ? 'block' : 'none';
}

function renderModalItems() {
  const el = document.getElementById('modal-items');
  const entries = Object.entries(sel);
  if (!entries.length) {
    el.innerHTML = '<p style="font-size:13.5px;color:var(--muted);padding:6px 0;">Nenhum item selecionado.</p>';
    return;
  }

  let html = entries.map(([id, qty]) => {
    const c = custos.find(x => x.id === id);
    if (!c) return '';
    const val  = c.tipo === 'mes' ? c.valor : c.valor * qty;
    const isColab = (c.categoria || 'colaborador') === 'colaborador';
    const unit = c.tipo === 'hora' ? `${qty}h` : 'fixo';
    return `<div class="rrow">
      <span class="rk">${esc(c.nome)} <small style="opacity:.5">(${unit}${isColab && c.tipo === 'hora' ? ' no projeto' : ''})</small></span>
      <span class="rv">${fmt(val)}</span>
    </div>`;
  }).join('');

  const total = calcCusto();
  html += `<div class="rrow" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--gold-mid);">
    <span class="rk" style="font-weight:600">Custo total</span>
    <span class="rv gold" style="font-size:15px;">${fmt(total)}</span>
  </div>`;
  el.innerHTML = html;
}

// =============================================
//  FÓRMULA DE PRECIFICAÇÃO
// =============================================

function getParams() {
  return {
    custo:         calcCusto(),
    margem:        parseFloat(document.getElementById('p-margem').value)  / 100,
    taxaCart:      parseFloat(document.getElementById('p-cartao').value)  / 100  || 0,
    imposto:       parseFloat(document.getElementById('p-imposto').value) / 100  || 0,
    desconto:      parseFloat(document.getElementById('p-desc').value)    / 100  || 0,
    descontoRec:   parseFloat(document.getElementById('p-drec').value)    || 0,
    sobretaxaProj: parseFloat(document.getElementById('p-sproj').value)   || 0,
    tipo:          document.getElementById('p-tipo').value,
    meses:         parseInt(document.getElementById('p-meses').value)     || 1,
    midiaOn:       document.getElementById('p-midia').checked,
    verba:         parseFloat(document.getElementById('p-verba').value)   || 0,
    taxaAdmin:     parseFloat(document.getElementById('p-tadmin').value)  / 100  || 0,
    tier:          document.getElementById('p-tier').value || 'nenhum',
  };
}

function computePreco(p) {
  const custoEf = p.custo * (1 + p.imposto);

  // 1. Preço base puro (custo + margem + taxa cartão)
  const precoBase = custoEf > 0
    ? custoEf / ((1 - p.margem) * (1 - p.taxaCart))
    : 0;

  // 2. Fator por tipo de contrato
  const fatorTipo = p.tipo === 'mensal'
    ? (1 - p.descontoRec / 100)
    : (1 + p.sobretaxaProj / 100);

  // 3. Fator de tier
  const tierPct   = tiers[p.tier] || 0;
  const fatorTier = 1 - tierPct / 100;

  // 4. Preço ajustado (antes do desconto manual) = o que se cobra normalmente
  const precoAjustado = precoBase * fatorTipo * fatorTier;

  // 5. Desconto manual ad-hoc
  const precoServ = precoAjustado * (1 - p.desconto);

  // 6. Mídia
  const adminVal = p.midiaOn ? p.verba * p.taxaAdmin : 0;
  const total    = precoServ + adminVal;

  // 7. Lucro e margem
  const lucro   = precoServ - custoEf;
  const margemR = precoServ > 0 ? (lucro / precoServ) * 100 : 0;

  // 8. Margem de manobra (floor: 20%)
  const precoMin = custoEf > 0
    ? custoEf / ((1 - 0.20) * (1 - p.taxaCart))
    : 0;
  const espaco   = Math.max(0, precoAjustado - precoMin);
  const maxDesc  = precoAjustado > 0 ? (espaco / precoAjustado) * 100 : 0;

  return {
    custoEf, precoBase, fatorTipo, tierPct, precoAjustado,
    precoServ, adminVal, total, lucro, margemR,
    precoMin, espaco, maxDesc,
  };
}

function calcPreco() {
  const p = getParams();
  const r = computePreco(p);
  const tem = p.custo > 0 || (p.midiaOn && p.verba > 0);

  // Exibição do preço destaque
  const precoBox = document.getElementById('preco-box');
  const rcard    = document.getElementById('rcard');
  const compSec  = document.getElementById('comp-sec');

  precoBox.style.display = tem ? 'block' : 'none';
  rcard.style.display    = tem ? 'block' : 'none';
  compSec.style.display  = p.custo > 0 ? 'block' : 'none';

  if (!tem) return;

  // --- PREÇO DESTAQUE ---
  document.getElementById('pb-val').textContent = fmt(r.precoAjustado);
  document.getElementById('pb-sub').textContent =
    p.tipo === 'mensal' ? 'Mensal do serviço' : 'Valor do projeto (fechado)';

  // Ajustes aplicados
  const ajustes = [];
  if (p.descontoRec > 0 && p.tipo === 'mensal')
    ajustes.push(`−${p.descontoRec}% desconto recorrência`);
  if (p.sobretaxaProj > 0 && p.tipo === 'projeto')
    ajustes.push(`+${p.sobretaxaProj}% adicional projeto único`);
  if (r.tierPct > 0)
    ajustes.push(`−${r.tierPct}% tier ${p.tier}`);
  if (ajustes.length) {
    const aj = document.getElementById('pb-ajustes');
    aj.style.display = 'block';
    aj.innerHTML = `Ajustes: ${ajustes.join(' · ')}<br>Preço base (sem ajustes): ${fmt(r.precoBase)}`;
  } else {
    document.getElementById('pb-ajustes').style.display = 'none';
  }

  // --- TAXA ADMIN MÍDIA ---
  const showAdmin = p.midiaOn && r.adminVal > 0;
  document.getElementById('r-admin-linha').style.display = showAdmin ? 'block' : 'none';
  document.getElementById('r-admin-val').textContent = fmt(r.adminVal);

  // Total proposta
  document.getElementById('r-total-prop').style.display = showAdmin ? 'block' : 'none';
  document.getElementById('r-total-val').textContent = fmt(r.total);

  // Nota de mídia
  if (p.midiaOn) {
    const nota = document.getElementById('midia-nota');
    nota.style.display = 'block';
    nota.innerHTML = `Taxa de administração: <strong>${fmt(r.adminVal)}</strong>
      (${(p.taxaAdmin * 100).toFixed(0)}% sobre verba de ${fmt(p.verba)} —
      gerida na conta do cliente, não passa pela Two Dreamers)`;
  } else {
    document.getElementById('midia-nota').style.display = 'none';
  }

  // --- DESCONTO MANUAL ---
  if (p.desconto > 0) {
    document.getElementById('r-desc-bloco').style.display = 'block';
    document.getElementById('r-orig').textContent     = fmt(r.precoAjustado);
    document.getElementById('r-com-desc').textContent = fmt(r.precoServ);
    document.getElementById('r-desc-pct').textContent =
      `Desconto manual de ${(p.desconto * 100).toFixed(0)}%`;
  } else {
    document.getElementById('r-desc-bloco').style.display = 'none';
  }

  // --- MÉTRICAS ---
  document.getElementById('r-custo').textContent  = fmt(r.custoEf);
  document.getElementById('r-lucro').textContent  = fmt(r.lucro);
  document.getElementById('r-margem').textContent = r.margemR.toFixed(1) + '%';

  // --- MARGEM DE MANOBRA ---
  if (p.custo > 0 && r.precoAjustado > 0) {
    document.getElementById('r-manobra').style.display  = 'block';
    document.getElementById('r-preco-min').textContent  = fmt(r.precoMin);
    document.getElementById('r-max-desc').textContent   = r.maxDesc.toFixed(1) + '%';
    document.getElementById('r-espaco').textContent     = fmt(r.espaco);
  } else {
    document.getElementById('r-manobra').style.display = 'none';
  }

  // --- BLOCO MESES ---
  if (p.tipo === 'mensal' && p.meses > 1) {
    document.getElementById('r-meses-bloco').style.display = 'block';
    document.getElementById('r-mensal').textContent        = fmt(r.total);
    document.getElementById('r-meses-lbl').textContent     = `Total do contrato (${p.meses} meses)`;
    document.getElementById('r-contrato').textContent      = fmt(r.total * p.meses);
  } else {
    document.getElementById('r-meses-bloco').style.display = 'none';
  }

  // --- TABELA COMPARATIVA ---
  renderCompTable(p, r);
  renderModalItems();
}

function renderCompTable(p, r) {
  const selectedM = Math.round(p.margem * 100);
  const margens   = [30, 40, 50, 60, 70];
  document.getElementById('comp-body').innerHTML = margens.map(m => {
    const custoEf = p.custo * (1 + p.imposto);
    const pb = custoEf > 0 ? custoEf / ((1 - m / 100) * (1 - p.taxaCart)) : 0;
    const pa = pb * (p.tipo === 'mensal' ? (1 - p.descontoRec / 100) : (1 + p.sobretaxaProj / 100))
                  * (1 - (tiers[p.tier] || 0) / 100);
    const ps = pa * (1 - p.desconto);
    const lc = ps - custoEf;
    return `<tr class="${m === selectedM ? 'hl' : ''}">
      <td>${m}%</td><td>${fmt(ps)}</td><td>${fmt(lc)}</td>
    </tr>`;
  }).join('');
}

// =============================================
//  CARRINHO
// =============================================

function addToCart() {
  const p    = getParams();
  const r    = computePreco(p);
  const nome = document.getElementById('p-nome').value.trim() || 'Sem nome';
  const idx  = parseInt(document.getElementById('p-edit-idx').value);

  const item = {
    id:            idx >= 0 ? cart[idx].id : uid(),
    nomeServico:   nome,
    tipo:          p.tipo,
    margem:        Math.round(p.margem    * 100),
    taxaCartao:    Math.round(p.taxaCart  * 1000) / 10,
    imposto:       Math.round(p.imposto   * 1000) / 10,
    desconto:      Math.round(p.desconto  * 100),
    descontoRec:   p.descontoRec,
    sobretaxaProj: p.sobretaxaProj,
    meses:         p.meses,
    tier:          p.tier,
    itens:         Object.entries(sel).map(([id, qtd]) => ({ id, qtd })),
    midia:         p.midiaOn
      ? { ativo: true, verba: p.verba, taxaAdmin: Math.round(p.taxaAdmin * 1000) / 10 }
      : null,
    escopo:        document.getElementById('p-escopo').value.trim(),
    custoTotal:    p.custo,
    precoBase:     r.precoBase,
    precoAjustado: r.precoAjustado,
    precoServico:  r.precoServ,
    taxaAdminVal:  r.adminVal,
    precoTotal:    r.total,
    lucro:         r.lucro,
    margemReal:    r.margemR,
  };

  if (idx >= 0) {
    cart[idx] = item;
    toast('✅ Item atualizado no pedido');
  } else {
    cart.push(item);
    toast('✅ Adicionado ao pedido');
  }

  persist('td_cart', cart);
  updCartBadge();
  closeModal('ov-calc');
}

function updCartBadge() {
  const el = document.getElementById('cart-badge');
  el.style.display = cart.length ? 'flex' : 'none';
  el.textContent   = cart.length;
}

function renderCart() {
  const listEl   = document.getElementById('cart-list');
  const totalsEl = document.getElementById('cart-totals');
  const actsEl   = document.getElementById('cart-acts');
  const obsGroup = document.getElementById('obs-group');

  loadObs();

  if (!cart.length) {
    listEl.innerHTML = `<div class="empty">
      <div class="eic">📋</div>
      <p>Nenhum item ainda.<br>Vá em <strong>Calcular</strong> para montar sua proposta.</p>
    </div>`;
    totalsEl.innerHTML = '';
    actsEl.style.display   = 'none';
    obsGroup.style.display = 'none';
    return;
  }

  actsEl.style.display   = 'block';
  obsGroup.style.display = 'block';

  listEl.innerHTML = cart.map((it, i) => {
    const tierLabel = it.tier && it.tier !== 'nenhum'
      ? `&nbsp;·&nbsp;<span class="tier-${it.tier}">${
          { prata:'🥈 Prata', ouro:'🥇 Ouro', diamante:'💎 Diamante' }[it.tier]
        }</span>` : '';
    const totalContrato = it.tipo === 'mensal' && it.meses > 1
      ? ` <span style="font-size:13px;color:var(--muted)">&nbsp;× ${it.meses} meses = ${fmt(it.precoTotal * it.meses)}</span>`
      : '';

    const regraInfo = [];
    if ((it.descontoRec || 0) > 0 && it.tipo === 'mensal')
      regraInfo.push(`−${it.descontoRec}% recorrência`);
    if ((it.sobretaxaProj || 0) > 0 && it.tipo === 'projeto')
      regraInfo.push(`+${it.sobretaxaProj}% projeto único`);
    if (it.tier && it.tier !== 'nenhum' && tiers[it.tier])
      regraInfo.push(`−${tiers[it.tier]}% ${it.tier}`);

    return `<div class="citem">
      <div class="citem-hd">
        <div class="citem-name">${esc(it.nomeServico)}</div>
        <div class="citem-acts">
          <button class="btn btn-ghost btn-sm" onclick="editCart(${i})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="remCart(${i})">🗑️</button>
        </div>
      </div>
      <div class="citem-meta">
        ${it.tipo === 'mensal'
          ? `Mensal · ${it.meses} ${it.meses > 1 ? 'meses' : 'mês'}`
          : 'Projeto único'}
        &nbsp;·&nbsp; Margem ${it.margem}%${tierLabel}
        ${it.desconto > 0 ? ` · Desconto ${it.desconto}%` : ''}
        ${regraInfo.length ? `<br>📐 ${regraInfo.join(' · ')}` : ''}
        ${it.midia ? `<br>🎯 Verba de mídia ${fmt(it.midia.verba)} — taxa ${fmt(it.taxaAdminVal)}` : ''}
      </div>
      <div class="citem-price">${fmt(it.precoTotal)}${totalContrato}</div>
      ${it.escopo ? `<div class="citem-escopo">📝 ${esc(it.escopo)}</div>` : ''}
    </div>`;
  }).join('');

  const totServ  = cart.reduce((s, i) => s + i.precoServico, 0);
  const totAdmin = cart.reduce((s, i) => s + (i.taxaAdminVal || 0), 0);
  const totGeral = cart.reduce((s, i) => s + i.precoTotal, 0);
  const totLucro = cart.reduce((s, i) => s + i.lucro, 0);

  totalsEl.innerHTML = `
    <div class="tcard">
      <div class="trow"><span class="tk">Itens na proposta</span><span>${cart.length}</span></div>
      <div class="trow"><span class="tk">Subtotal serviços</span><span>${fmt(totServ)}</span></div>
      ${totAdmin > 0 ? `<div class="trow"><span class="tk">Total taxas de administração</span><span>${fmt(totAdmin)}</span></div>` : ''}
      <div class="trow"><span class="tk">Lucro estimado</span><span style="color:var(--success)">${fmt(totLucro)}</span></div>
      <div class="trow big"><span>TOTAL GERAL</span><span>${fmt(totGeral)}</span></div>
    </div>`;
}

function editCart(idx) {
  const it = cart[idx];
  sel = {};
  (it.itens || []).forEach(x => { sel[x.id] = x.qtd; });
  renderCselList();
  updatePbar();
  openCalc(idx);
}

function remCart(idx) {
  cart.splice(idx, 1);
  persist('td_cart', cart);
  updCartBadge();
  renderCart();
  toast('🗑️ Item removido');
}

function clearCart() {
  if (!confirm('Limpar todo o pedido atual?')) return;
  cart = [];
  persist('td_cart', cart);
  updCartBadge();
  renderCart();
  toast('Pedido limpo');
}

// =============================================
//  RESUMO DA PROPOSTA
// =============================================

function openSummary() {
  const body = document.getElementById('sum-body');
  const data = fmtDate();

  let html = `<div class="sum-brand">Two Dreamers</div>
    <div class="sum-date">Proposta gerada em ${data}</div>`;

  cart.forEach(it => {
    const tipoLabel = it.tipo === 'mensal'
      ? `Recorrente — ${it.meses} ${it.meses > 1 ? 'meses' : 'mês'}`
      : 'Projeto único (valor fechado)';
    html += `<div class="sum-item">
      <div class="sum-iname">${esc(it.nomeServico)}</div>
      <div class="sum-itype">${tipoLabel}</div>
      <div class="sum-iprice">${fmt(it.precoServico)}</div>
      ${it.escopo ? `<div class="sum-inote">📝 ${esc(it.escopo)}</div>` : ''}
      ${it.midia && it.taxaAdminVal > 0 ? `
        <div class="sum-inote">
          🎯 Gestão de mídia paga: ${fmt(it.taxaAdminVal)}/mês<br>
          A verba de mídia (${fmt(it.midia.verba)}/mês) é gerida na conta do cliente —
          não transita pelo caixa da Two Dreamers.
        </div>` : ''}
    </div>`;
  });

  const totServ  = cart.reduce((s, i) => s + i.precoServico, 0);
  const totAdmin = cart.reduce((s, i) => s + (i.taxaAdminVal || 0), 0);
  const totGeral = cart.reduce((s, i) => s + i.precoTotal, 0);

  html += `<div style="margin-top:14px;">
    ${totAdmin > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--muted);padding:5px 0;">
        <span>Subtotal serviços</span><span>${fmt(totServ)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--muted);padding:5px 0;">
        <span>Gestão de mídia paga</span><span>${fmt(totAdmin)}</span>
      </div>` : ''}
    <div class="sum-total"><span>Total</span><span style="color:var(--gold)">${fmt(totGeral)}</span></div>
  </div>
  <div class="sum-pay">
    <strong style="color:var(--gold)">Formas de pagamento</strong><br>
    ✅ PIX — sem acréscimo<br>
    ✅ Boleto / transferência bancária — sem acréscimo<br>
    💳 Cartão — taxa operacional repassada (confirmada no fechamento)
  </div>
  ${obs ? `<div class="sum-pay" style="margin-top:12px;"><strong style="color:var(--gold)">Observações</strong><br>${esc(obs).replace(/\n/g,'<br>')}</div>` : ''}
  <div class="sum-footer">
    Fico à disposição para tirar dúvidas e alinhar os detalhes.
    Assim que você confirmar, seguimos para os próximos passos.
  </div>
  <div class="gap2"></div>
  <button class="btn btn-outline btn-full" onclick="copySummary()">📋 Copiar proposta</button>
  <div class="gap"></div>`;

  body.innerHTML = html;
  openModal('ov-sum');
}

function copySummary() {
  const data = fmtDate();
  let txt = `Two Dreamers — Proposta\n${data}\n\n`;
  cart.forEach(it => {
    const tipoLabel = it.tipo === 'mensal'
      ? `Recorrente — ${it.meses} ${it.meses > 1 ? 'meses' : 'mês'}`
      : 'Projeto único';
    txt += `📌 ${it.nomeServico}\n   ${tipoLabel}\n   ${fmt(it.precoServico)}\n`;
    if (it.escopo) txt += `   Escopo: ${it.escopo}\n`;
    if (it.midia && it.taxaAdminVal > 0)
      txt += `   🎯 Gestão de mídia: ${fmt(it.taxaAdminVal)}/mês (verba ${fmt(it.midia.verba)} na conta do cliente)\n`;
    txt += '\n';
  });
  const totGeral = cart.reduce((s, i) => s + i.precoTotal, 0);
  txt += `─────────────────────────\nTOTAL: ${fmt(totGeral)}\n\n`;
  txt += `✅ PIX — sem acréscimo\n✅ Boleto / transferência — sem acréscimo\n💳 Cartão — taxa repassada\n`;
  if (obs) txt += `\nObservações:\n${obs}\n`;
  copyText(txt);
}

// =============================================
//  CONTRATO
// =============================================

function openContract() {
  loadObs();
  const co = document.getElementById('contract-obs');
  if (co) co.value = obs;
  renderContractPreview();
  openModal('ov-contract');
}

function renderContractPreview() {
  const el = document.getElementById('contract-preview');
  if (!el) return;
  el.textContent = buildContractText();
}


function buildContractText() {
  var data = fmtDate();
  var obsLocal = (document.getElementById('contract-obs') && document.getElementById('contract-obs').value) || obs;
  var txt = '';
  txt += 'PROPOSTA COMERCIAL\n';
  txt += 'Two Dreamers -- Marketing Digital\n';
  txt += '================================\n\n';
  txt += 'Data: ' + data + '\n';
  txt += 'Validade: 15 dias\n\n';
  txt += 'SERVICOS CONTRATADOS\n';
  txt += '================================\n\n';
  cart.forEach(function(it, i) {
    var tipoLabel = it.tipo === 'mensal'
      ? ('Recorrente -- ' + it.meses + ' ' + (it.meses > 1 ? 'meses' : 'mes'))
      : 'Projeto unico (valor fechado)';
    txt += (i + 1) + '. ' + it.nomeServico + '\n';
    txt += '   Tipo: ' + tipoLabel + '\n';
    if (it.tier && it.tier !== 'nenhum') {
      var tl = { prata: 'Prata', ouro: 'Ouro', diamante: 'Diamante' }[it.tier];
      txt += '   Tier: ' + tl + '\n';
    }
    if (it.escopo) {
      txt += '   Escopo:\n';
      it.escopo.split('\n').forEach(function(l) { txt += '     ' + l + '\n'; });
    }
    var colabs = (it.itens || []).filter(function(x) {
      var c = custos.find(function(cx) { return cx.id === x.id; });
      return c && (c.categoria || 'colaborador') === 'colaborador' && c.tipo === 'hora';
    });
    if (colabs.length) {
      txt += '   Equipe:\n';
      colabs.forEach(function(x) {
        var c = custos.find(function(cx) { return cx.id === x.id; });
        if (c) txt += '     * ' + c.nome + ': ' + x.qtd + 'h' + (it.tipo === 'mensal' ? '/mes' : ' no projeto') + '\n';
      });
    }
    txt += '   Valor: ' + fmt(it.precoServico) + '\n';
    if (it.tipo === 'mensal' && it.meses > 1)
      txt += '   Total (' + it.meses + ' meses): ' + fmt(it.precoServico * it.meses) + '\n';
    if (it.midia && it.taxaAdminVal > 0) {
      txt += '   + Gestao de midia: ' + fmt(it.taxaAdminVal) + '/mes\n';
      txt += '     (Verba ' + fmt(it.midia.verba) + '/mes na conta do cliente)\n';
    }
    txt += '\n';
  });
  var totServ  = cart.reduce(function(s, x) { return s + x.precoServico; }, 0);
  var totAdmin = cart.reduce(function(s, x) { return s + (x.taxaAdminVal || 0); }, 0);
  var totGeral = cart.reduce(function(s, x) { return s + x.precoTotal; }, 0);
  txt += 'INVESTIMENTO\n================================\n\n';
  if (totAdmin > 0) {
    txt += 'Subtotal servicos: ' + fmt(totServ) + '\n';
    txt += 'Gestao de midia: ' + fmt(totAdmin) + '\n';
  }
  txt += 'TOTAL: ' + fmt(totGeral) + '\n\n';
  txt += 'FORMAS DE PAGAMENTO\n================================\n\n';
  txt += 'PIX -- sem acrescimo\n';
  txt += 'Boleto / transferencia -- sem acrescimo\n';
  txt += 'Cartao -- taxa operacional repassada\n\n';
  if (obsLocal && obsLocal.trim()) {
    txt += 'OBSERVACOES\n================================\n\n';
    txt += obsLocal.trim() + '\n\n';
  }
  txt += 'ACEITE\n================================\n\n';
  txt += 'Two Dreamers: _______________________  Data: ___/___/______\n\n';
  txt += 'Cliente:      _______________________  Data: ___/___/______\n';
  return txt;
}

function copyContract() {
  copyText(buildContractText());
}

function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() { toast('Copiado!'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copiado!');
  }
}

function saveModel() {
  var itens = Object.entries(sel).map(function(e) { return { id: e[0], qtd: e[1] }; });
  if (!itens.length) { toast('Selecione ao menos um item'); return; }
  var nome = prompt('Nome do modelo:');
  if (!nome || !nome.trim()) return;
  var midiaOn = document.getElementById('p-midia').checked;
  modelos.push({
    id: uid(), nome: nome.trim(), itens: itens,
    tipoMidia: midiaOn ? {
      ativo: true,
      verba: parseFloat(document.getElementById('p-verba').value) || 0,
      taxaAdmin: parseFloat(document.getElementById('p-tadmin').value) || 15,
    } : null,
    criadoEm: Date.now(),
  });
  persist('td_modelos', modelos);
  toast('Modelo "' + nome.trim() + '" salvo');
}

function saveClient() {
  var nome = document.getElementById('p-nome').value.trim();
  if (!nome) { toast('Informe o nome do cliente'); return; }
  var p = getParams();
  var r = computePreco(p);
  var existing = clientes.find(function(c) { return c.nome.toLowerCase() === nome.toLowerCase(); });
  var id = existing ? existing.id : uid();
  var data = {
    id: id, nome: nome, tipo: p.tipo, margem: Math.round(p.margem * 100),
    taxaCartao: Math.round(p.taxaCart * 1000) / 10,
    imposto: Math.round(p.imposto * 1000) / 10,
    desconto: Math.round(p.desconto * 100),
    descontoRec: p.descontoRec, sobretaxaProj: p.sobretaxaProj,
    meses: p.meses, tier: p.tier,
    itens: Object.entries(sel).map(function(e) { return { id: e[0], qtd: e[1] }; }),
    midia: p.midiaOn ? { ativo: true, verba: p.verba, taxaAdmin: Math.round(p.taxaAdmin * 1000) / 10 } : null,
    escopo: document.getElementById('p-escopo').value.trim(),
    custoTotal: p.custo, precoServico: r.precoServ, taxaAdminVal: r.adminVal,
    precoTotal: r.total, lucro: r.lucro,
    data: new Date().toLocaleDateString('pt-BR'), criadoEm: Date.now(),
  };
  var idx = clientes.findIndex(function(c) { return c.id === id; });
  if (idx >= 0) { clientes[idx] = data; toast('"' + nome + '" atualizado'); }
  else          { clientes.push(data);  toast('"' + nome + '" salvo'); }
  persist('td_clientes', clientes);
}

function renderClients() {
  var el = document.getElementById('clients-list');
  if (!clientes.length) {
    el.innerHTML = '<div class="empty"><div class="eic">👥</div><p>Nenhum cliente salvo ainda.</p></div>';
    return;
  }
  el.innerHTML = clientes.map(function(c) {
    var tierLabel = (c.tier && c.tier !== 'nenhum')
      ? ('&nbsp;&middot;&nbsp;<span class="tier-' + c.tier + '">' + ({ prata:'🥈 Prata', ouro:'🥇 Ouro', diamante:'💎 Diamante' }[c.tier] || '') + '</span>')
      : '';
    return '<div class="clcard">' +
      '<div class="clcard-hd"><div class="clcard-name">' + esc(c.nome) + '</div>' +
      '<button class="btn btn-danger btn-sm" onclick="delClient(\'' + c.id + '\')">🗑️</button></div>' +
      '<div class="clcard-meta">' + (c.data || '') + '&nbsp;&middot;&nbsp;' +
      (c.tipo === 'mensal' ? ('Mensal &middot; ' + (c.meses || 1) + ' meses') : 'Projeto unico') +
      '&nbsp;&middot;&nbsp; Margem ' + (c.margem || 50) + '%' + tierLabel + '</div>' +
      '<div class="clcard-price">' + fmt(c.precoTotal) + '</div>' +
      '<div class="clcard-acts">' +
      '<button class="btn btn-outline btn-sm" onclick="recalcClient(\'' + c.id + '\')">📊 Recalcular</button> ' +
      '<button class="btn btn-ghost btn-sm" onclick="openEditClient(\'' + c.id + '\')">✏️ Editar</button>' +
      '</div></div>';
  }).join('');
}

function delClient(id) {
  clientes = clientes.filter(function(c) { return c.id !== id; });
  persist('td_clientes', clientes);
  renderClients();
  toast('Cliente removido');
}

function recalcClient(id) {
  var c = clientes.find(function(x) { return x.id === id; });
  if (!c) return;
  sel = {};
  (c.itens || []).forEach(function(it) { sel[it.id] = it.qtd; });
  document.getElementById('p-nome').value    = c.nome;
  document.getElementById('p-margem').value  = c.margem || 50;
  document.getElementById('p-margem-d').textContent = (c.margem || 50) + '%';
  document.getElementById('p-cartao').value  = c.taxaCartao || 0;
  document.getElementById('p-imposto').value = c.imposto || 0;
  document.getElementById('p-desc').value    = c.desconto || 0;
  document.getElementById('p-desc-d').textContent = (c.desconto || 0) + '%';
  document.getElementById('p-drec').value    = c.descontoRec || 0;
  document.getElementById('p-drec-d').textContent = (c.descontoRec || 0) + '%';
  document.getElementById('p-sproj').value   = c.sobretaxaProj || 0;
  document.getElementById('p-sproj-d').textContent = (c.sobretaxaProj || 0) + '%';
  document.getElementById('p-tier').value    = c.tier || 'nenhum';
  document.getElementById('p-escopo').value  = c.escopo || '';
  var tipo = c.tipo || 'mensal';
  document.getElementById('p-tipo').value  = tipo;
  document.getElementById('p-meses').value = c.meses || 1;
  document.getElementById('p-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
  showRegraByTipo(tipo);
  if (c.midia && c.midia.ativo) {
    document.getElementById('p-midia').checked = true;
    document.getElementById('p-verba').value   = c.midia.verba || 0;
    document.getElementById('p-tadmin').value  = c.midia.taxaAdmin || 15;
    document.getElementById('midia-bloco').style.display = 'block';
  } else {
    document.getElementById('p-midia').checked = false;
    document.getElementById('midia-bloco').style.display = 'none';
  }
  switchTab('calcular');
  setTimeout(function() {
    renderCselList(); updatePbar(); setTierInfo(); renderModalItems(); calcPreco();
    document.getElementById('p-edit-idx').value = -1;
    document.getElementById('btn-cart').textContent = '+ Adicionar ao Pedido';
    openModal('ov-calc');
  }, 80);
}

function openEditClient(id) {
  var c = clientes.find(function(x) { return x.id === id; });
  if (!c) return;
  document.getElementById('ec-id').value    = id;
  document.getElementById('ec-nome').value  = c.nome;
  document.getElementById('ec-valor').value = c.precoServico;
  document.getElementById('ec-meses').value = c.meses || 1;
  var tipo = c.tipo || 'mensal';
  document.getElementById('ec-tipo').value = tipo;
  document.querySelectorAll('#seg-ec-tipo button').forEach(function(b, i) {
    b.classList.toggle('active', (i === 0 && tipo === 'mensal') || (i === 1 && tipo === 'projeto'));
  });
  document.getElementById('ec-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
  openModal('ov-eclient');
}

function setECTipo(tipo, btn) {
  document.getElementById('ec-tipo').value = tipo;
  document.querySelectorAll('#seg-ec-tipo button').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('ec-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
}

function updateClient() {
  var id    = document.getElementById('ec-id').value;
  var nome  = document.getElementById('ec-nome').value.trim();
  var valor = parseFloat(document.getElementById('ec-valor').value) || 0;
  var tipo  = document.getElementById('ec-tipo').value;
  var meses = parseInt(document.getElementById('ec-meses').value) || 1;
  if (!nome) { toast('Informe o nome'); return; }
  var idx = clientes.findIndex(function(c) { return c.id === id; });
  if (idx < 0) return;
  var adminVal = clientes[idx].taxaAdminVal || 0;
  clientes[idx] = Object.assign({}, clientes[idx], {
    nome: nome, precoServico: valor, precoTotal: valor + adminVal,
    tipo: tipo, meses: meses, data: new Date().toLocaleDateString('pt-BR'),
  });
  persist('td_clientes', clientes);
  renderClients();
  closeModal('ov-eclient');
  toast('Cliente atualizado');
}

function ecToCart() {
  var id    = document.getElementById('ec-id').value;
  var c     = clientes.find(function(x) { return x.id === id; });
  if (!c) return;
  var nome  = document.getElementById('ec-nome').value.trim() || c.nome;
  var valor = parseFloat(document.getElementById('ec-valor').value) || c.precoServico;
  var tipo  = document.getElementById('ec-tipo').value;
  var meses = parseInt(document.getElementById('ec-meses').value) || 1;
  cart.push({
    id: uid(), nomeServico: nome, tipo: tipo, meses: meses,
    margem: c.margem || 50, taxaCartao: c.taxaCartao || 0,
    imposto: c.imposto || 0, desconto: c.desconto || 0,
    descontoRec: c.descontoRec || 0, sobretaxaProj: c.sobretaxaProj || 0,
    tier: c.tier || 'nenhum', itens: c.itens || [], midia: c.midia || null,
    escopo: c.escopo || '', custoTotal: c.custoTotal || 0,
    precoBase: valor, precoAjustado: valor, precoServico: valor,
    taxaAdminVal: c.taxaAdminVal || 0, precoTotal: valor + (c.taxaAdminVal || 0),
    lucro: c.lucro || 0, margemReal: c.margem || 50,
  });
  persist('td_cart', cart);
  updCartBadge();
  closeModal('ov-eclient');
  toast('Adicionado ao pedido');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').catch(function() {});
  });
}

function init() {
  updCartBadge();
  loadObs();
  loadTierInputs();
  renderCalc();
  document.getElementById('pbar').style.display = 'flex';
  showRegraByTipo('mensal');
}

init();
