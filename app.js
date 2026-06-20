// =============================================
//  TWO DREAMERS — PRECIFICAÇÃO  |  app.js
// =============================================

'use strict';

// -----------------------------------------------
//  ESTADO
// -----------------------------------------------
let custos  = JSON.parse(localStorage.getItem('td_custos')   || '[]');
let clientes = JSON.parse(localStorage.getItem('td_clientes') || '[]');
let cart    = JSON.parse(localStorage.getItem('td_cart')      || '[]');
let modelos = JSON.parse(localStorage.getItem('td_modelos')   || '[]');

// Itens selecionados no calculador: { id: quantidade }
let sel = {};

// ID sendo editado no form de custo
let editCId = null;

// -----------------------------------------------
//  PERSISTÊNCIA
// -----------------------------------------------
const persist = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// -----------------------------------------------
//  FORMATAÇÃO
// -----------------------------------------------
function fmt(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDate() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
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
//  ABAS
// -----------------------------------------------
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab').forEach(c =>
    c.classList.toggle('active', c.id === 'tab-' + tab)
  );

  const pbar = document.getElementById('pbar');
  pbar.style.display = tab === 'calcular' ? 'flex' : 'none';

  if (tab === 'calcular') renderCalc();
  if (tab === 'custos')   renderCustoList();
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

// Fechar clicando fora do mbox
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target === ov) closeModal(ov.id);
  });
});

// -----------------------------------------------
//  COLLAPSIBLE
// -----------------------------------------------
function toggleColl(id, btn) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
  btn.querySelector('span:last-child').textContent =
    el.classList.contains('open') ? '▲' : '▼';
}

// -----------------------------------------------
//  RANGE DISPLAY
// -----------------------------------------------
function updRange(inputId, displayId, suffix) {
  document.getElementById(displayId).textContent =
    document.getElementById(inputId).value + suffix;
}

// =============================================
//  ABA CALCULAR
// =============================================

function renderCalc() {
  renderModels();
  renderCselList();
  updatePbar();
}

// --- Barra de preço (estimativa 50%) ---
function updatePbar() {
  const custo = calcCusto();
  const preco = custo > 0 ? custo / 0.5 : 0; // 50% margem
  document.getElementById('pbar-val').textContent = fmt(preco);
}

// --- Custo total dos itens selecionados ---
function calcCusto() {
  return Object.entries(sel).reduce((acc, [id, qty]) => {
    const c = custos.find(x => x.id === id);
    if (!c) return acc;
    return acc + (c.tipo === 'mes' ? c.valor : c.valor * qty);
  }, 0);
}

// --- Modelos (scroll horizontal) ---
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
    return `
      <div class="mcard" onclick="loadModel('${m.id}')">
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

  // Pré-carregar mídia se existir
  if (m.tipoMidia?.ativo) {
    document.getElementById('p-midia').checked = true;
    document.getElementById('p-verba').value  = m.tipoMidia.verba   || 0;
    document.getElementById('p-tadmin').value = m.tipoMidia.taxaAdmin || 15;
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

// --- Lista de seleção de custos ---
function renderCselList() {
  const el = document.getElementById('csel-list');
  if (!custos.length) {
    el.innerHTML = `<div class="empty">
      <div class="eic">⚙️</div>
      <p>Nenhum item cadastrado ainda.<br>Vá em <strong>Custos</strong> para começar.</p>
    </div>`;
    return;
  }

  el.innerHTML = custos.map(c => {
    const on  = c.id in sel;
    const qty = sel[c.id] || 1;
    const parcial = on ? (c.tipo === 'mes' ? c.valor : c.valor * qty) : 0;

    return `
      <div class="csel-row">
        <div class="csel-chk${on ? ' on' : ''}" onclick="toggleSel('${c.id}')"></div>
        <div class="csel-info">
          <div class="csel-name">${esc(c.nome)}</div>
          <div class="csel-sub">${fmt(c.valor)}/${c.tipo === 'hora' ? 'hora' : 'mês fixo'}</div>
        </div>
        ${on ? `
          <div class="csel-qty">
            ${c.tipo === 'mes'
              ? `<input type="number" value="1" disabled>`
              : `<input type="number" value="${qty}" min="1" max="999"
                   oninput="updSel('${c.id}',this.value)"
                   onclick="event.stopPropagation()">`
            }
          </div>
          <div class="csel-val">${fmt(parcial)}</div>
        ` : ''}
      </div>`;
  }).join('');
}

function toggleSel(id) {
  if (id in sel) delete sel[id];
  else sel[id] = 1;
  renderCselList();
  updatePbar();
}

function updSel(id, rawVal) {
  const qty = Math.max(1, parseFloat(rawVal) || 1);
  sel[id] = qty;
  updatePbar();
  // Atualiza só o parcial sem re-renderizar tudo
  renderCselList();
}

// =============================================
//  ABA CUSTOS
// =============================================

function setCTipo(tipo, btn) {
  document.getElementById('c-tipo').value = tipo;
  document.querySelectorAll('#seg-tipo button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('c-valor-lbl').textContent =
    tipo === 'hora' ? 'Valor por hora (R$)' : 'Valor mensal fixo (R$)';
}

function saveCusto() {
  const nome  = document.getElementById('c-nome').value.trim();
  const tipo  = document.getElementById('c-tipo').value;
  const valor = parseFloat(document.getElementById('c-valor').value);

  if (!nome)              { toast('❌ Informe o nome do item'); return; }
  if (!valor || valor <= 0) { toast('❌ Informe um valor válido'); return; }

  if (editCId) {
    const i = custos.findIndex(c => c.id === editCId);
    if (i >= 0) custos[i] = { ...custos[i], nome, tipo, valor };
    editCId = null;
    document.getElementById('custo-form-title').textContent = 'Novo item de custo';
    document.getElementById('c-cancel').style.display = 'none';
    toast('✅ Item atualizado');
  } else {
    custos.push({ id: uid(), nome, tipo, valor, criadoEm: Date.now() });
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
  document.getElementById('c-tipo').value  = c.tipo;

  // Atualiza seg-ctrl
  document.querySelectorAll('#seg-tipo button').forEach((b, i) =>
    b.classList.toggle('active', (i === 0 && c.tipo === 'hora') || (i === 1 && c.tipo === 'mes'))
  );
  document.getElementById('c-valor-lbl').textContent =
    c.tipo === 'hora' ? 'Valor por hora (R$)' : 'Valor mensal fixo (R$)';
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
      <div class="eic">📝</div>
      <p>Nenhum item ainda. Cadastre acima.</p>
    </div>`;
    return;
  }
  el.innerHTML = custos.map(c => `
    <div class="litem">
      <div class="litem-info">
        <div class="litem-name">${esc(c.nome)}</div>
        <div class="litem-sub">${fmt(c.valor)} / ${c.tipo === 'hora' ? 'hora' : 'mês fixo'}</div>
      </div>
      <div class="litem-acts">
        <button class="btn btn-ghost btn-sm" onclick="editCusto('${c.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="delCusto('${c.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

// =============================================
//  CALCULADORA (MODAL)
// =============================================

function openCalc(editIdx = -1) {
  document.getElementById('p-edit-idx').value = editIdx;

  if (editIdx >= 0) {
    loadCartIntoCalc(cart[editIdx]);
    document.getElementById('btn-cart').textContent = '💾 Salvar edição';
  } else {
    document.getElementById('btn-cart').textContent = '➕ Adicionar ao Pedido';
  }

  renderModalItems();
  calcPreco();
  openModal('ov-calc');
}

function loadCartIntoCalc(item) {
  sel = {};
  (item.itens || []).forEach(it => { sel[it.id] = it.qtd; });
  renderCselList();
  updatePbar();

  // Tipo
  const tipo = item.tipo || 'mensal';
  document.getElementById('p-tipo').value = tipo;
  document.querySelectorAll('#ov-calc .seg:nth-of-type(1) button').forEach((b, i) =>
    b.classList.toggle('active',
      (i === 0 && tipo === 'mensal') || (i === 1 && tipo === 'projeto')
    )
  );
  document.getElementById('p-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
  document.getElementById('p-meses').value   = item.meses    || 1;
  document.getElementById('p-margem').value  = item.margem   || 50;
  document.getElementById('p-margem-d').textContent = (item.margem || 50) + '%';
  document.getElementById('p-cartao').value  = item.taxaCartao || 0;
  document.getElementById('p-imposto').value = item.imposto  || 0;
  document.getElementById('p-desc').value    = item.desconto || 0;
  document.getElementById('p-desc-d').textContent = (item.desconto || 0) + '%';
  document.getElementById('p-nome').value    = item.nomeServico || '';

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
  calcPreco();
}

function toggleMidia() {
  const on = document.getElementById('p-midia').checked;
  document.getElementById('midia-bloco').style.display = on ? 'block' : 'none';
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
    const unit = c.tipo === 'hora' ? `${qty}h` : 'fixo';
    return `<div class="rrow">
      <span class="rk">${esc(c.nome)} <small style="opacity:.55">(${unit})</small></span>
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

// --- FÓRMULA CENTRAL ---
function getParams() {
  return {
    custo:     calcCusto(),
    margem:    parseFloat(document.getElementById('p-margem').value)  / 100,
    taxaCart:  parseFloat(document.getElementById('p-cartao').value)  / 100  || 0,
    imposto:   parseFloat(document.getElementById('p-imposto').value) / 100  || 0,
    desconto:  parseFloat(document.getElementById('p-desc').value)    / 100  || 0,
    tipo:      document.getElementById('p-tipo').value,
    meses:     parseInt(document.getElementById('p-meses').value)     || 1,
    midiaOn:   document.getElementById('p-midia').checked,
    verba:     parseFloat(document.getElementById('p-verba').value)   || 0,
    taxaAdmin: parseFloat(document.getElementById('p-tadmin').value)  / 100  || 0,
  };
}

function computePreco(p) {
  const custoEf   = p.custo * (1 + p.imposto);
  const precoBase = custoEf > 0
    ? custoEf / ((1 - p.margem) * (1 - p.taxaCart))
    : 0;
  const precoServ = precoBase * (1 - p.desconto);
  const adminVal  = p.midiaOn ? p.verba * p.taxaAdmin : 0;
  const total     = precoServ + adminVal;
  const lucro     = precoServ - custoEf;
  const margemR   = precoServ > 0 ? (lucro / precoServ) * 100 : 0;
  return { custoEf, precoBase, precoServ, adminVal, total, lucro, margemR };
}

function calcPreco() {
  const p = getParams();
  const r = computePreco(p);
  const tem = p.custo > 0 || (p.midiaOn && p.verba > 0);

  document.getElementById('rcard').style.display    = tem ? 'block' : 'none';
  document.getElementById('comp-sec').style.display = p.custo > 0 ? 'block' : 'none';

  if (!tem) return;

  // Preço principal
  document.getElementById('r-preco').textContent =
    fmt(r.precoServ);
  document.getElementById('r-label').textContent =
    p.tipo === 'mensal' ? 'Preço mensal do serviço' : 'Preço do projeto (fechado)';

  // Taxa admin de mídia
  const showAdmin = p.midiaOn && r.adminVal > 0;
  document.getElementById('r-admin-linha').style.display = showAdmin ? 'block' : 'none';
  document.getElementById('r-admin-val').textContent = fmt(r.adminVal);

  // Total da proposta (só quando há mídia)
  const tpEl = document.getElementById('r-total-prop');
  tpEl.style.display = showAdmin ? 'block' : 'none';
  document.getElementById('r-total-val').textContent = fmt(r.total);

  // Nota de mídia
  if (p.midiaOn) {
    const nota = document.getElementById('midia-nota');
    nota.style.display = 'block';
    nota.innerHTML = `Taxa de administração: <strong>${fmt(r.adminVal)}</strong>
      (${(p.taxaAdmin * 100).toFixed(0)}% sobre verba de ${fmt(p.verba)} —
      administrada diretamente na conta do cliente, não passa pela Two Dreamers)`;
  } else {
    document.getElementById('midia-nota').style.display = 'none';
  }

  // Desconto
  if (p.desconto > 0) {
    document.getElementById('r-desc-bloco').style.display = 'block';
    document.getElementById('r-orig').textContent     = fmt(r.precoBase);
    document.getElementById('r-com-desc').textContent = fmt(r.precoServ);
    document.getElementById('r-desc-pct').textContent =
      `Desconto de ${(p.desconto * 100).toFixed(0)}%`;
  } else {
    document.getElementById('r-desc-bloco').style.display = 'none';
  }

  document.getElementById('r-custo').textContent  = fmt(r.custoEf);
  document.getElementById('r-lucro').textContent  = fmt(r.lucro);
  document.getElementById('r-margem').textContent = r.margemR.toFixed(1) + '%';

  // Bloco de meses
  if (p.tipo === 'mensal' && p.meses > 1) {
    document.getElementById('r-meses-bloco').style.display = 'block';
    document.getElementById('r-mensal').textContent      = fmt(r.total);
    document.getElementById('r-meses-lbl').textContent   = `Total do contrato (${p.meses} meses)`;
    document.getElementById('r-contrato').textContent    = fmt(r.total * p.meses);
  } else {
    document.getElementById('r-meses-bloco').style.display = 'none';
  }

  // Tabela comparativa
  renderCompTable(p, r);
  renderModalItems();
}

function renderCompTable(p, r) {
  const selectedM = Math.round(p.margem * 100);
  const margens   = [30, 40, 50, 60, 70];

  document.getElementById('comp-body').innerHTML = margens.map(m => {
    const pb = p.custo > 0
      ? (p.custo * (1 + p.imposto)) / ((1 - m / 100) * (1 - p.taxaCart))
      : 0;
    const ps = pb * (1 - p.desconto);
    const lc = ps - p.custo * (1 + p.imposto);
    const hl = m === selectedM;
    return `<tr class="${hl ? 'hl' : ''}">
      <td>${m}%</td>
      <td>${fmt(ps)}</td>
      <td>${fmt(lc)}</td>
    </tr>`;
  }).join('');
}

// =============================================
//  CARRINHO
// =============================================

function addToCart() {
  const p   = getParams();
  const r   = computePreco(p);
  const nome = document.getElementById('p-nome').value.trim() || 'Sem nome';
  const idx  = parseInt(document.getElementById('p-edit-idx').value);

  const item = {
    id:          idx >= 0 ? cart[idx].id : uid(),
    nomeServico: nome,
    tipo:        p.tipo,
    margem:      Math.round(p.margem    * 100),
    taxaCartao:  Math.round(p.taxaCart  * 1000) / 10,
    imposto:     Math.round(p.imposto   * 1000) / 10,
    desconto:    Math.round(p.desconto  * 100),
    meses:       p.meses,
    itens:       Object.entries(sel).map(([id, qtd]) => ({ id, qtd })),
    midia:       p.midiaOn
      ? { ativo: true, verba: p.verba, taxaAdmin: Math.round(p.taxaAdmin * 1000) / 10 }
      : null,
    custoTotal:  p.custo,
    precoBase:   r.precoBase,
    precoServico: r.precoServ,
    taxaAdminVal: r.adminVal,
    precoTotal:  r.total,
    lucro:       r.lucro,
    margemReal:  r.margemR,
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

  if (!cart.length) {
    listEl.innerHTML = `<div class="empty">
      <div class="eic">📋</div>
      <p>Nenhum item ainda.<br>Vá em <strong>Calcular</strong> e monte sua proposta.</p>
    </div>`;
    totalsEl.innerHTML = '';
    actsEl.style.display = 'none';
    return;
  }

  actsEl.style.display = 'block';

  listEl.innerHTML = cart.map((it, i) => {
    const totalContrato = it.tipo === 'mensal' && it.meses > 1
      ? fmt(it.precoTotal * it.meses)
      : null;
    return `
      <div class="citem">
        <div class="citem-hd">
          <div class="citem-name">${esc(it.nomeServico)}</div>
          <div class="citem-acts">
            <button class="btn btn-ghost btn-sm" onclick="editCart(${i})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="remCart(${i})">🗑️</button>
          </div>
        </div>
        <div class="citem-meta">
          ${it.tipo === 'mensal' ? `Mensal · ${it.meses} ${it.meses > 1 ? 'meses' : 'mês'}` : 'Projeto único'}
          &nbsp;·&nbsp; Margem ${it.margem}%
          ${it.desconto > 0 ? ` · Desconto ${it.desconto}%` : ''}
          ${it.midia ? `<br>🎯 Verba de mídia ${fmt(it.midia.verba)} — taxa ${fmt(it.taxaAdminVal)}` : ''}
        </div>
        <div class="citem-price">
          ${fmt(it.precoTotal)}
          ${totalContrato ? `<span style="font-size:13px;color:var(--muted);margin-left:8px;">× ${it.meses} meses = ${totalContrato}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const totServ  = cart.reduce((s, i) => s + i.precoServico, 0);
  const totAdmin = cart.reduce((s, i) => s + (i.taxaAdminVal || 0), 0);
  const totGeral = cart.reduce((s, i) => s + i.precoTotal, 0);
  const totLucro = cart.reduce((s, i) => s + i.lucro, 0);

  totalsEl.innerHTML = `
    <div class="tcard">
      <div class="trow"><span class="tk">Itens na proposta</span><span>${cart.length}</span></div>
      <div class="trow"><span class="tk">Subtotal de serviços</span><span>${fmt(totServ)}</span></div>
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

  let html = `
    <div class="sum-brand">Two Dreamers</div>
    <div class="sum-date">Proposta gerada em ${data}</div>`;

  cart.forEach(it => {
    const tipoLabel = it.tipo === 'mensal'
      ? `Recorrente — ${it.meses} ${it.meses > 1 ? 'meses' : 'mês'}`
      : 'Projeto único (valor fechado)';

    html += `<div class="sum-item">
      <div class="sum-iname">${esc(it.nomeServico)}</div>
      <div class="sum-itype">${tipoLabel}</div>
      <div class="sum-iprice">${fmt(it.precoServico)}</div>
      ${it.midia && it.taxaAdminVal > 0 ? `
        <div class="sum-inote">
          🎯 Gestão de mídia paga: ${fmt(it.taxaAdminVal)}/mês<br>
          A verba de mídia (${fmt(it.midia.verba)}/mês) é administrada diretamente na conta do cliente —
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
    <div class="sum-total">
      <span>Total</span>
      <span style="color:var(--gold)">${fmt(totGeral)}</span>
    </div>
  </div>

  <div class="sum-pay">
    <strong style="color:var(--gold)">Formas de pagamento</strong><br>
    ✅ PIX — sem acréscimo<br>
    ✅ Boleto / transferência bancária — sem acréscimo<br>
    💳 Cartão — taxa operacional repassada (confirmada no fechamento)
  </div>

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
    txt += `📌 ${it.nomeServico}\n`;
    txt += `   ${tipoLabel}\n`;
    txt += `   ${fmt(it.precoServico)}\n`;
    if (it.midia && it.taxaAdminVal > 0) {
      txt += `   🎯 Gestão de mídia: ${fmt(it.taxaAdminVal)}/mês\n`;
      txt += `   (Verba de ${fmt(it.midia.verba)}/mês administrada na conta do cliente)\n`;
    }
    txt += '\n';
  });

  const totGeral = cart.reduce((s, i) => s + i.precoTotal, 0);
  txt += `─────────────────────────\n`;
  txt += `TOTAL: ${fmt(totGeral)}\n\n`;
  txt += `Formas de pagamento:\n`;
  txt += `✅ PIX — sem acréscimo\n`;
  txt += `✅ Boleto / transferência — sem acréscimo\n`;
  txt += `💳 Cartão — taxa operacional repassada (confirmada no fechamento)\n`;

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast('📋 Proposta copiada!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('📋 Proposta copiada!');
  }
}

// =============================================
//  SALVAR MODELO
// =============================================

function saveModel() {
  const itens = Object.entries(sel).map(([id, qtd]) => ({ id, qtd }));
  if (!itens.length) { toast('❌ Selecione ao menos um item de custo'); return; }

  const nome = prompt('Nome do modelo:');
  if (!nome?.trim()) return;

  const midiaOn = document.getElementById('p-midia').checked;
  modelos.push({
    id:      uid(),
    nome:    nome.trim(),
    itens,
    tipoMidia: midiaOn ? {
      ativo:     true,
      verba:     parseFloat(document.getElementById('p-verba').value)  || 0,
      taxaAdmin: parseFloat(document.getElementById('p-tadmin').value) || 15,
    } : null,
    criadoEm: Date.now(),
  });

  persist('td_modelos', modelos);
  toast(`✅ Modelo "${nome.trim()}" salvo`);
}

// =============================================
//  SALVAR CLIENTE
// =============================================

function saveClient() {
  const nome = document.getElementById('p-nome').value.trim();
  if (!nome) { toast('❌ Informe o nome do cliente'); return; }

  const p  = getParams();
  const r  = computePreco(p);
  const id = clientes.find(c => c.nome.toLowerCase() === nome.toLowerCase())?.id || uid();

  const data = {
    id,
    nome,
    tipo:        p.tipo,
    margem:      Math.round(p.margem   * 100),
    taxaCartao:  Math.round(p.taxaCart * 1000) / 10,
    imposto:     Math.round(p.imposto  * 1000) / 10,
    desconto:    Math.round(p.desconto * 100),
    meses:       p.meses,
    itens:       Object.entries(sel).map(([id, qtd]) => ({ id, qtd })),
    midia:       p.midiaOn
      ? { ativo: true, verba: p.verba, taxaAdmin: Math.round(p.taxaAdmin * 1000) / 10 }
      : null,
    custoTotal:  p.custo,
    precoServico: r.precoServ,
    taxaAdminVal: r.adminVal,
    precoTotal:  r.total,
    lucro:       r.lucro,
    data:        new Date().toLocaleDateString('pt-BR'),
    criadoEm:   Date.now(),
  };

  const idx = clientes.findIndex(c => c.id === id);
  if (idx >= 0) { clientes[idx] = data; toast(`✅ "${nome}" atualizado`); }
  else          { clientes.push(data);  toast(`✅ "${nome}" salvo`); }

  persist('td_clientes', clientes);
}

// =============================================
//  ABA CLIENTES
// =============================================

function renderClients() {
  const el = document.getElementById('clients-list');
  if (!clientes.length) {
    el.innerHTML = `<div class="empty">
      <div class="eic">👥</div>
      <p>Nenhum cliente salvo ainda.<br>Calcule um preço e clique em "Salvar cliente".</p>
    </div>`;
    return;
  }

  el.innerHTML = clientes.map(c => `
    <div class="clcard">
      <div class="clcard-hd">
        <div class="clcard-name">${esc(c.nome)}</div>
        <button class="btn btn-danger btn-sm" onclick="delClient('${c.id}')">🗑️</button>
      </div>
      <div class="clcard-meta">
        ${c.data} &nbsp;·&nbsp;
        ${c.tipo === 'mensal' ? `Mensal · ${c.meses} ${c.meses > 1 ? 'meses' : 'mês'}` : 'Projeto único'}
        &nbsp;·&nbsp; Margem ${c.margem}%
        ${c.midia ? ` · 🎯 Mídia` : ''}
      </div>
      <div class="clcard-price">${fmt(c.precoTotal)}</div>
      <div class="clcard-acts">
        <button class="btn btn-outline btn-sm" onclick="recalcClient('${c.id}')">📊 Recalcular</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditClient('${c.id}')">✏️ Editar</button>
      </div>
    </div>`).join('');
}

function delClient(id) {
  clientes = clientes.filter(c => c.id !== id);
  persist('td_clientes', clientes);
  renderClients();
  toast('🗑️ Cliente removido');
}

function recalcClient(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  sel = {};
  (c.itens || []).forEach(it => { sel[it.id] = it.qtd; });

  // Pré-preenche os campos do modal
  document.getElementById('p-nome').value    = c.nome;
  document.getElementById('p-margem').value  = c.margem || 50;
  document.getElementById('p-margem-d').textContent = (c.margem || 50) + '%';
  document.getElementById('p-cartao').value  = c.taxaCartao || 0;
  document.getElementById('p-imposto').value = c.imposto    || 0;
  document.getElementById('p-desc').value    = c.desconto   || 0;
  document.getElementById('p-desc-d').textContent = (c.desconto || 0) + '%';

  const tipo = c.tipo || 'mensal';
  document.getElementById('p-tipo').value = tipo;
  document.getElementById('p-meses').value = c.meses || 1;
  document.getElementById('p-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';

  if (c.midia?.ativo) {
    document.getElementById('p-midia').checked = true;
    document.getElementById('p-verba').value   = c.midia.verba    || 0;
    document.getElementById('p-tadmin').value  = c.midia.taxaAdmin || 15;
    document.getElementById('midia-bloco').style.display = 'block';
  } else {
    document.getElementById('p-midia').checked = false;
    document.getElementById('midia-bloco').style.display = 'none';
  }

  // Atualiza seg-ctrl tipo cobrança
  document.querySelectorAll('#ov-calc .fgroup:nth-of-type(1) .seg button').forEach((b, i) =>
    b.classList.toggle('active',
      (i === 0 && tipo === 'mensal') || (i === 1 && tipo === 'projeto')
    )
  );

  switchTab('calcular');
  setTimeout(() => {
    renderCselList();
    updatePbar();
    renderModalItems();
    calcPreco();
    document.getElementById('p-edit-idx').value = -1;
    document.getElementById('btn-cart').textContent = '➕ Adicionar ao Pedido';
    openModal('ov-calc');
  }, 80);
}

// Modal editar cliente
function openEditClient(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  document.getElementById('ec-id').value    = id;
  document.getElementById('ec-nome').value  = c.nome;
  document.getElementById('ec-valor').value = c.precoServico;
  document.getElementById('ec-meses').value = c.meses || 1;

  const tipo = c.tipo || 'mensal';
  document.getElementById('ec-tipo').value = tipo;
  document.querySelectorAll('#seg-ec-tipo button').forEach((b, i) =>
    b.classList.toggle('active',
      (i === 0 && tipo === 'mensal') || (i === 1 && tipo === 'projeto')
    )
  );
  document.getElementById('ec-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';

  openModal('ov-eclient');
}

function setECTipo(tipo, btn) {
  document.getElementById('ec-tipo').value = tipo;
  document.querySelectorAll('#seg-ec-tipo button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ec-meses-g').style.display = tipo === 'mensal' ? 'block' : 'none';
}

function updateClient() {
  const id    = document.getElementById('ec-id').value;
  const nome  = document.getElementById('ec-nome').value.trim();
  const valor = parseFloat(document.getElementById('ec-valor').value) || 0;
  const tipo  = document.getElementById('ec-tipo').value;
  const meses = parseInt(document.getElementById('ec-meses').value) || 1;

  if (!nome) { toast('❌ Informe o nome'); return; }

  const idx = clientes.findIndex(c => c.id === id);
  if (idx < 0) return;

  const adminVal = clientes[idx].taxaAdminVal || 0;
  clientes[idx] = {
    ...clientes[idx],
    nome,
    precoServico: valor,
    precoTotal:   valor + adminVal,
    tipo, meses,
    data: new Date().toLocaleDateString('pt-BR'),
  };

  persist('td_clientes', clientes);
  renderClients();
  closeModal('ov-eclient');
  toast('✅ Cliente atualizado');
}

function ecToCart() {
  const id    = document.getElementById('ec-id').value;
  const c     = clientes.find(x => x.id === id);
  if (!c) return;

  const nome  = document.getElementById('ec-nome').value.trim()    || c.nome;
  const valor = parseFloat(document.getElementById('ec-valor').value) || c.precoServico;
  const tipo  = document.getElementById('ec-tipo').value;
  const meses = parseInt(document.getElementById('ec-meses').value) || 1;

  cart.push({
    id:           uid(),
    nomeServico:  nome,
    tipo, meses,
    margem:       c.margem    || 50,
    taxaCartao:   c.taxaCartao || 0,
    imposto:      c.imposto   || 0,
    desconto:     c.desconto  || 0,
    itens:        c.itens     || [],
    midia:        c.midia     || null,
    custoTotal:   c.custoTotal || 0,
    precoBase:    valor,
    precoServico: valor,
    taxaAdminVal: c.taxaAdminVal || 0,
    precoTotal:   valor + (c.taxaAdminVal || 0),
    lucro:        c.lucro     || 0,
    margemReal:   c.margem    || 50,
  });

  persist('td_cart', cart);
  updCartBadge();
  closeModal('ov-eclient');
  toast('✅ Adicionado ao pedido');
}

// =============================================
//  UTILITÁRIOS
// =============================================

// Escape HTML básico para prevenir XSS
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
//  PWA — SERVICE WORKER
// =============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// =============================================
//  INICIALIZAÇÃO
// =============================================
function init() {
  updCartBadge();
  renderCalc();
  // Esconde pbar nas outras abas
  document.getElementById('pbar').style.display = 'flex';
}

init();
