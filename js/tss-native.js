/*!
 * tss-native.js — JS ENXUTO da busca nativa do Tera Smart Search.
 * Substitui o hijack de 119KB do Worker. Faz so o que precisa de cliente:
 *   1) Adicionar ao carrinho direto do card (mesmo endpoint legado /ShoppingCart/addItem.obj).
 *   2) Autocomplete (dropdown) na caixa de busca, consultando o search-api (servidor DO).
 * Os RESULTADOS da /busca sao renderizados server-side em PHP (TeraSmartSearchRender) —
 * este arquivo NAO renderiza/hijacka a pagina de resultados. __TSS_RENDER__
 */
(function () {
  'use strict';
  if (window.__tssNative) return;
  window.__tssNative = true;
  var API = 'https://search-api.terabyteshop.com.br/api/search/';

  function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }
  function fmt(v) { v = parseFloat(v); if (!isFinite(v)) return ''; return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* ---------------- Adicionar ao carrinho (mesmo endpoint do legado) ---------------- */
  function updateCartCount(n) { var pq = document.getElementById('pedido-qtd-itens'); if (pq) { var c = parseInt(pq.textContent, 10) || 0; pq.innerHTML = String(c + n); } }
  function syncLegacyMiniCart(j) {
    try {
      var pq = document.getElementById('pedido-qtd-itens');
      if (pq && j && j.volumes != null) pq.innerHTML = String(j.volumes); else updateCartCount(1);
      var sm = document.getElementById('s_mcart');
      if (sm && j && j.mncart) sm.innerHTML = j.mncart;
      if (typeof window.initInputsCart === 'function') window.initInputsCart();
      if (typeof window.addCloseMiniCart === 'function') window.addCloseMiniCart();
      if (typeof window.updateCartButtonState === 'function') window.updateCartButtonState();
      else { var mc = document.getElementById('mcart'); if (mc) { mc.removeAttribute('disabled'); mc.classList.remove('cart-disabled'); } }
    } catch (e) { updateCartCount(1); }
  }
  // Toggle de visualizacao lista <-> card. Cliente escolhe; persiste em cookie (server-side ja
  // renderiza a view certa na proxima busca). So mexe na apresentacao (classe do grid). __TSS_VIEW__
  document.addEventListener('click', function (e) {
    var vb = e.target.closest && e.target.closest('[data-tss-setview]');
    if (!vb) return;
    e.preventDefault();
    if (vb.classList.contains('tss-active')) return; // ja esta nesse modo
    var mode = vb.getAttribute('data-tss-setview') === 'list' ? 'list' : 'cards';
    try { document.cookie = 'tss_view=' + mode + ';path=/;max-age=' + (60 * 60 * 24 * 365); } catch (err) {}
    // card = cards nativos (.product-item) / list = cards TSS: markups distintos -> re-render server-side.
    location.reload();
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.tss-card-cart-btn, .tss-item-cart-btn');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    var id = btn.getAttribute('data-tss-add');
    var link = btn.getAttribute('data-tss-link') || '#';
    var c1 = btn.getAttribute('data-tss-c1') || '1', c2 = btn.getAttribute('data-tss-c2') || '1';
    if (!id) { window.location = link; return; }
    if (btn.classList.contains('tss-added') || btn.classList.contains('tss-loading')) return;
    btn.classList.add('tss-loading');
    var body = 'app=true&idproduto=' + encodeURIComponent(id) + '&c1=' + encodeURIComponent(c1) + '&c2=' + encodeURIComponent(c2) + '&quantidade=1';
    fetch('/ShoppingCart/addItem.obj', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j = {}; try { j = JSON.parse(t); } catch (_) { }
        btn.classList.remove('tss-loading');
        if (j && j.error === false) {
          var orig = btn.innerHTML; btn.classList.add('tss-added');
          btn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
          syncLegacyMiniCart(j);
          setTimeout(function () { btn.classList.remove('tss-added'); btn.innerHTML = orig; }, 2500);
        } else { window.location = link; }
      })
      .catch(function () { btn.classList.remove('tss-loading'); window.location = link; });
  }, true);

  /* ---------------- Filtro sidebar (IGUAL producao, construido dos cards NATIVOS) ----------------
   * Producao usa o .tss-filter-sidebar do Worker (FILTROS / Ordenar / Marcas + contadores / toggles
   * Frete-Estoque-Promo), client-side. Aqui montamos o MESMO sidebar a partir dos data-attrs dos
   * cards server-side (marca/preco/frete/estoque/promo) e operamos client-side, sem recarregar.
   * Esconde o filtro legado (dropdowns do topo). So age quando .tss-results-grid existe. */
  function tssToggleSection(title, label, cls) {
    return '<div class="tss-filter-section"><div class="tss-filter-section-title">' + title + '</div>'
      + '<div class="tss-filter-toggle-row"><span>' + label + '</span>'
      + '<label class="tss-filter-toggle"><input type="checkbox" class="' + cls + '"><span class="tss-filter-toggle-slider"></span></label></div></div>';
  }
  function buildFilterSidebar() {
    var grid = document.querySelector('.tss-results-grid');
    if (!grid || document.querySelector('.tss-filter-sidebar')) return;
    var cards = [].slice.call(grid.querySelectorAll('.tss-result-card, .product-item'));
    if (!cards.length) return;
    // marcas + contagem a partir dos cards
    var brands = {};
    cards.forEach(function (c) { var b = (c.getAttribute('data-tss-brand') || '').trim(); if (b) brands[b] = (brands[b] || 0) + 1; });
    var brandList = Object.keys(brands).sort(function (a, b) { return brands[b] - brands[a] || a.localeCompare(b); });
    var sb = document.createElement('div'); sb.className = 'tss-filter-sidebar';
    sb.innerHTML = '<div class="tss-filter-sidebar-inner">'
      + '<div class="tss-filter-title"><i class="bi bi-sliders"></i> FILTROS</div>'
      + '<div class="tss-filter-section"><div class="tss-filter-section-title">Ordenar por Preço</div>'
      + '<div class="tss-price-sort-container">'
      + '<button class="tss-price-sort-btn" data-sort="asc"><i class="bi bi-sort-up"></i> Menor Preço</button>'
      + '<button class="tss-price-sort-btn" data-sort="desc"><i class="bi bi-sort-down"></i> Maior Preço</button>'
      + '</div></div>'
      + '<div class="tss-filter-section"><div class="tss-filter-section-title">Marcas</div>'
      + '<input type="text" class="tss-search-input" placeholder="Buscar marca...">'
      + '<div class="tss-filter-checkbox-list">'
      + brandList.map(function (b) { return '<label class="tss-filter-checkbox-item"><input type="checkbox" class="tss-brand-cb" value="' + esc(b) + '"><span>' + esc(b) + '</span><span class="tss-filter-count">(' + brands[b] + ')</span></label>'; }).join('')
      + '</div></div>'
      + tssToggleSection('Frete Grátis', 'Apenas Frete Grátis', 'tss-toggle-frete')
      + tssToggleSection('Estoque', 'Apenas Esgotados', 'tss-toggle-esgotado')
      + tssToggleSection('Promoção', 'Apenas em Promoção', 'tss-toggle-promo')
      + '</div>';
    // layout igual producao: .tss-search-layout > [.tss-filter-sidebar, .tss-search-main(.tss-filter-results-count + grid)]
    var layout = document.createElement('div'); layout.className = 'tss-search-layout';
    var main = document.createElement('div'); main.className = 'tss-search-main';
    var countLine = document.createElement('div'); countLine.className = 'tss-filter-results-count';
    countLine.textContent = 'Exibindo ' + cards.length + ' de ' + cards.length + ' produtos encontrados';
    grid.parentNode.insertBefore(layout, grid);
    layout.appendChild(sb);
    layout.appendChild(main);
    // badge "Resultado inteligente por IA" quando o search-api usou IA (marcado server-side no grid)
    if (grid.getAttribute('data-tss-usedai') === '1') {
      var aiBadge = document.createElement('div');
      aiBadge.className = 'tss-ai-badge';
      aiBadge.innerHTML = '<i class="bi bi-stars"></i> Resultado inteligente por IA';
      main.appendChild(aiBadge);
    }
    main.appendChild(countLine);
    main.appendChild(grid);
    // esconde o filtro legado (caixa .filterbox + barra sticky .filterSticky do topo), igual producao
    ['.filterbox', '.filterSticky'].forEach(function (s) { var el = document.querySelector(s); if (el) el.style.display = 'none'; });
    // ALINHAMENTO: o layout ja nasce dentro do .container central (o MESMO do header/menu),
    // entao alinha naturalmente com o bloco de departamento. NAO estender pro <departamento>
    // (full-width, left=0) com margem negativa -> isso puxava a busca pra esquerda, fora do menu.
    // ---- interacoes (tudo nos cards nativos) ----
    function applyFilters() {
      var checked = [].slice.call(sb.querySelectorAll('.tss-brand-cb:checked')).map(function (c) { return c.value.toLowerCase(); });
      var frete = sb.querySelector('.tss-toggle-frete').checked;
      var esg = sb.querySelector('.tss-toggle-esgotado').checked;
      var promo = sb.querySelector('.tss-toggle-promo').checked;
      cards.forEach(function (c) {
        var ok = true;
        if (checked.length && checked.indexOf((c.getAttribute('data-tss-brand') || '').toLowerCase()) < 0) ok = false;
        if (frete && c.getAttribute('data-tss-frete') !== '1') ok = false;
        if (esg && c.getAttribute('data-tss-estoque') !== '0') ok = false;
        if (promo && c.getAttribute('data-tss-promo') !== '1') ok = false;
        // BUGFIX: cada card fica dentro de um wrapper .product-item-frame (que e' o item do grid).
        // Esconder o .product-item interno deixava o wrapper como celula fantasma de altura 0 ->
        // buracos no grid (1o card isolado ao filtrar marca). Esconde o HOST (o frame, se existir;
        // senao o proprio card). Robusto para os dois layouts (com e sem wrapper).
        (c.closest('.product-item-frame') || c).style.display = ok ? '' : 'none';
      });
    }
    sb.querySelectorAll('.tss-price-sort-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = btn.getAttribute('data-sort');
        [].slice.call(grid.querySelectorAll('.tss-result-card, .product-item')).sort(function (a, b) {
          var ea = a.getAttribute('data-tss-estoque') === '1' ? 0 : 1, eb = b.getAttribute('data-tss-estoque') === '1' ? 0 : 1;
          if (ea !== eb) return ea - eb; // estoque primeiro
          var pa = parseFloat(a.getAttribute('data-tss-price')) || 0, pb = parseFloat(b.getAttribute('data-tss-price')) || 0;
          return order === 'desc' ? pb - pa : pa - pb;
        }).forEach(function (c) { grid.appendChild(c.closest('.product-item-frame') || c); }); // move o wrapper (item do grid), nao o card interno
        sb.querySelectorAll('.tss-price-sort-btn').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
    sb.querySelectorAll('.tss-brand-cb, .tss-toggle-frete, .tss-toggle-esgotado, .tss-toggle-promo').forEach(function (el) { el.addEventListener('change', applyFilters); });
    var si = sb.querySelector('.tss-search-input');
    si.addEventListener('input', function () {
      var q = si.value.toLowerCase();
      sb.querySelectorAll('.tss-filter-checkbox-item').forEach(function (it) { it.style.display = it.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; });
    });
    // ---- MOBILE: barra "FILTROS" + drawer (bottom-sheet). Controla os MESMOS inputs do sidebar (reusa applyFilters + sort). ----
    var mb = document.createElement('div');
    mb.className = 'tss-mobile-filter-bar';
    mb.innerHTML = '<button class="tss-mobile-filter-btn" id="tss-open-drawer"><i class="bi bi-sliders"></i> FILTROS</button>';
    main.insertBefore(mb, main.firstChild);
    var dr = document.createElement('div');
    dr.className = 'tss-filter-drawer-overlay';
    dr.id = 'tss-drawer-overlay';
    dr.innerHTML = '<div class="tss-filter-drawer">'
      + '<div class="tss-filter-drawer-header"><h3>FILTROS</h3><button class="tss-filter-drawer-close" id="tss-close-drawer">&times;</button></div>'
      + '<div class="tss-filter-drawer-body">'
      + '<div class="tss-filter-section"><div class="tss-filter-section-title">Ordenar por Preço</div><div class="tss-price-sort-container">'
      + '<button class="tss-price-sort-btn" data-sort="asc"><i class="bi bi-sort-up"></i> Menor Preço</button>'
      + '<button class="tss-price-sort-btn" data-sort="desc"><i class="bi bi-sort-down"></i> Maior Preço</button>'
      + '</div></div>'
      + '<div class="tss-filter-section"><div class="tss-filter-section-title">Marcas</div><div class="tss-filter-checkbox-list">'
      + brandList.map(function (b) { return '<label class="tss-filter-checkbox-item"><input type="checkbox" class="tss-brand-cb-m" value="' + esc(b) + '"><span>' + esc(b) + '</span><span class="tss-filter-count">(' + brands[b] + ')</span></label>'; }).join('')
      + '</div></div>'
      + tssToggleSection('Frete Grátis', 'Apenas Frete Grátis', 'tss-toggle-frete-m')
      + tssToggleSection('Estoque', 'Apenas Esgotados', 'tss-toggle-esgotado-m')
      + tssToggleSection('Promoção', 'Apenas em Promoção', 'tss-toggle-promo-m')
      + '</div>'
      + '<div class="tss-filter-drawer-footer"><button class="tss-filter-drawer-clear" id="tss-drawer-clear">Limpar</button><button class="tss-filter-drawer-apply" id="tss-drawer-apply">Aplicar Filtros</button></div>'
      + '</div>';
    document.body.appendChild(dr);
    function tssSyncMobile() {
      [].slice.call(dr.querySelectorAll('.tss-brand-cb-m')).forEach(function (mcb) {
        var dcb = [].slice.call(sb.querySelectorAll('.tss-brand-cb')).filter(function (d) { return d.value === mcb.value; })[0];
        if (dcb) dcb.checked = mcb.checked;
      });
      [['tss-toggle-frete-m', 'tss-toggle-frete'], ['tss-toggle-esgotado-m', 'tss-toggle-esgotado'], ['tss-toggle-promo-m', 'tss-toggle-promo']].forEach(function (p) {
        var m = dr.querySelector('.' + p[0]), d = sb.querySelector('.' + p[1]); if (m && d) d.checked = m.checked;
      });
      applyFilters();
    }
    function tssCloseDrawer() { dr.classList.remove('open'); document.body.style.overflow = ''; }
    mb.querySelector('#tss-open-drawer').addEventListener('click', function () { dr.classList.add('open'); document.body.style.overflow = 'hidden'; });
    dr.querySelector('#tss-close-drawer').addEventListener('click', tssCloseDrawer);
    dr.addEventListener('click', function (e) { if (e.target === dr) tssCloseDrawer(); });
    [].slice.call(dr.querySelectorAll('.tss-brand-cb-m, .tss-toggle-frete-m, .tss-toggle-esgotado-m, .tss-toggle-promo-m')).forEach(function (el) { el.addEventListener('change', tssSyncMobile); });
    [].slice.call(dr.querySelectorAll('.tss-price-sort-btn')).forEach(function (btn) { btn.addEventListener('click', function () { var b = sb.querySelector('.tss-price-sort-btn[data-sort="' + btn.getAttribute('data-sort') + '"]'); if (b) b.click(); }); });
    dr.querySelector('#tss-drawer-apply').addEventListener('click', function () { tssSyncMobile(); tssCloseDrawer(); });
    dr.querySelector('#tss-drawer-clear').addEventListener('click', function () { [].slice.call(dr.querySelectorAll('input[type=checkbox]')).forEach(function (i) { i.checked = false; }); tssSyncMobile(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildFilterSidebar);
  else buildFilterSidebar();

  /* ---------------- Autocomplete (renderiza no #suggestions do legado, igual o Worker) ---------------- */
  var MIN_CHARS = 2, MAX_AC = 8;
  var LOADER_MIN_MS = 500; // tempo minimo (ms) do loader visivel (proposital/elegante) — ajuste aqui
  function showPageLoader() {
    var sugg = document.getElementById("suggestions");
    var cont = document.getElementById("tss-container");
    if (cont) cont.innerHTML = LOADER_HTML;
    if (sugg) { sugg.style.display = "block"; sugg.style.opacity = "1"; }
  }
  window.addEventListener("pageshow", function () { var sugg = document.getElementById("suggestions"); if (sugg) sugg.style.display = "none"; });
  var LOADER_HTML = '<div class="tss-section" style="text-align:center;padding:26px 12px;"><div style="display:inline-block;width:22px;height:22px;border:2px solid #00a000;border-top-color:transparent;border-radius:50%;animation:tssspin .6s linear infinite;"></div><style>@keyframes tssspin{to{transform:rotate(360deg)}}</style><div style="margin-top:10px;color:#666;font-size:13px;">Buscando com Tera Smart Search...</div></div>';
  function bpl(p) { var e = p.externalId || p.external_id, s = p.slug; if (!s) return '#'; if (('' + s).indexOf('http') === 0) return s; return e ? ('/produto/' + e + '/' + s) : ('/' + s); }
  function disc(p) { var o = parseFloat(p.precoAntigo || p.preco_antigo || 0), n = parseFloat(p.preco || 0); return (o > 0 && n > 0 && o > n) ? Math.round((1 - n / o) * 100) : 0; }
  function isFC(p) { return String(p.mpn || '').toUpperCase() === 'FULLCUSTOM' || p.fullcustom === true || p.fullcustom === 'true'; }
  function isPromo(p) { return p.isPromo == 1 || p.is_promo == 1; }
  function showPromo(p) { return ((parseInt(p.id, 10) || 0) % 5) < 2; }
  function clCat(s) { var d = document.createElement('div'); d.innerHTML = (s == null ? '' : String(s)); return d.textContent; }
  function stars(rating, count) {
    rating = parseFloat(rating) || 0; count = parseInt(count, 10) || 0;
    if (!count || !rating) return '';
    // markup IDENTICO ao Worker (size 'small' -> tss-item-rating); CSS colore .tss-stars de #f5a623
    var s = ''; for (var i = 1; i <= 5; i++) s += (i <= Math.round(rating)) ? '<span>★</span>' : '<span class="tss-star-empty">★</span>';
    return '<div class="tss-item-rating"><span class="tss-stars">' + s + '</span>'
      + '<span class="tss-rating-value">' + rating.toFixed(1) + '</span>'
      + '<span class="tss-rating-count">(' + count + ')</span></div>';
  }
  var CART_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9 5.5a.5.5 0 0 0-1 0V7H6.5a.5.5 0 0 0 0 1H8v1.5a.5.5 0 0 0 1 0V8h1.5a.5.5 0 0 0 0-1H9V5.5z"/><path d="M.5 1a.5.5 0 0 0 0 1h1.11l.401 1.607 1.498 7.985A.5.5 0 0 0 4 12h1a2 2 0 1 0 0 4 2 2 0 0 0 0-4h7a2 2 0 1 0 0 4 2 2 0 0 0 0-4h1a.5.5 0 0 0 .491-.408l1.5-8A.5.5 0 0 0 15 3H2.89l-.405-1.621A.5.5 0 0 0 2 1H.5zm3.915 10L3.102 4h11.319l-1.313 7h-8.69zM6 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>';
  function itemHtml(p) {
    var link = bpl(p), d = disc(p), frete = (p.freteGratis == 1 || p.frete_gratis == 1), out = (p.estoque === 0 || p.estoque === '0');
    return '<a class="tss-item" href="' + esc(link) + '" data-tss-product="' + esc(p.id || '') + '">'
      + (p.imagem ? '<img class="tss-item-img" src="' + esc(p.imagem) + '" alt="" loading="lazy">' : '')
      + '<div class="tss-item-info"><div class="tss-item-name">' + esc(p.nome || '') + '</div><div>'
      + (isFC(p)
          ? '<span class="tss-item-config" style="color:#2C63C6;font-weight:700">Monte do seu jeito</span>'
          : ('<span class="tss-item-price">' + fmt(p.preco) + '</span>'
            + (((p.precoAntigo || p.preco_antigo) && d > 0) ? '<span class="tss-item-old-price">' + fmt(p.precoAntigo || p.preco_antigo) + '</span>' : '')
            + (p.hasCoupon ? '<span class="tss-item-coupon">🎫 CUPOM ' + ((p.couponValue > 0) ? (p.tipodesconto === 'P' ? Math.round(p.couponValue) + '% OFF' : 'R$ ' + Math.round(p.couponValue) + ' OFF') : '') + '</span>' : '')
            + ((isPromo(p) && showPromo(p)) ? '<span class="tss-item-promo">🔥 em promoção</span>' : '')
            + (frete ? '<span class="tss-item-frete">Frete Grátis</span>' : '')))
      + '</div>'
      + (p.categoria ? '<div class="tss-item-category">' + esc(clCat(p.categoria)) + '</div>' : '')
      + stars(p.rating || p.avgRating, p.ratingCount || p.reviewCount)
      + '</div>'
      + ((!out && !isFC(p) && (p.externalId || p.external_id)) ? '<button type="button" class="tss-item-cart-btn" data-tss-add="' + esc(String(p.externalId || p.external_id)) + '" data-tss-link="' + esc(link) + '" data-tss-c1="1" data-tss-c2="1" aria-label="Adicionar ao carrinho" title="Adicionar ao carrinho">' + CART_SVG + '</button>' : '')
      + '</a>';
  }
  function renderItems(prods, q, total, usedAi) {
    if (!prods.length) return '<div class="tss-empty">Nenhum produto encontrado para "<strong>' + esc(q) + '</strong>"</div>';
    var aiNote = usedAi ? '<div class="tss-ai-badge"><i class="bi bi-stars"></i> Resultado inteligente por IA</div>' : '';
    var items = prods.slice(0, MAX_AC).map(itemHtml).join('');
    var viewAll = total > MAX_AC ? '<a class="tss-view-all" href="/busca?str=' + encodeURIComponent(q) + '">Ver todos os ' + total + ' resultados →</a>' : '';
    return '<div class="tss-section"><div class="tss-section-title">PRODUTOS ENCONTRADOS (' + total + ')</div>' + aiNote + items + '</div>' + viewAll;
  }
  // Vitrine "Mais buscados" no dropdown vazio. Fonte: GET /api/search/ranking (top produtos mais buscados). __TSS_POPULAR__
  var FIRE = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="vertical-align:-2px"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C12 14 10.157 15 8 15z"/></svg>';
  var POP_KEY = 'tss_popular_cache';
  function renderPopular(prods) {
    if (!prods || !prods.length) return '';
    var items = prods.slice(0, MAX_AC).map(itemHtml).join('');
    return '<div class="tss-section"><div class="tss-section-title">' + FIRE + ' MAIS BUSCADOS</div>' + items + '</div>';
  }
  function fetchPopular(cb) {
    // 1) Preferir os produtos embutidos server-side (tss_inject.php) — same-origin, sem CORS, sem latencia.
    try { var wp = window.__TSS_POPULAR__; if (wp && wp.products && wp.products.length) { cb(wp.products); return; } } catch (e) {}
    // 2) Cache de sessao
    try { var c = JSON.parse(sessionStorage.getItem(POP_KEY) || 'null'); if (c && c.t && (Date.now() - c.t < 600000) && c.p) { cb(c.p); return; } } catch (e) {}
    // 3) Fallback: fetch direto (funciona quando o CORS do /ranking estiver ok na borda)
    fetch(API + 'ranking?limit=' + MAX_AC, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { var p = (j && j.products) || []; try { sessionStorage.setItem(POP_KEY, JSON.stringify({ t: Date.now(), p: p })); } catch (e) {} cb(p); })
      .catch(function () { cb([]); });
  }
  /* ---------------- Historico de buscas recentes (localStorage) ---------------- */
  var HIST_KEY = 'tss_local_history', HIST_MAX = 10, HIST_SHOW = 5;
  var CLOCK = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="vertical-align:-2px"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>';
  function getHist() { try { var r = localStorage.getItem(HIST_KEY); return r ? (JSON.parse(r) || []) : []; } catch (e) { return []; } }
  function saveHist(q) { if (!q) return; q = String(q).trim(); if (!q || q.length < 2) return; try { var h = getHist().filter(function (x) { return String(x).toLowerCase() !== q.toLowerCase(); }); h.unshift(q); localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, HIST_MAX))); } catch (e) { } }
  function renderHist() {
    var h = getHist().slice(0, HIST_SHOW);
    if (!h.length) return '';
    var items = h.map(function (q) {
      return '<a class="tss-item tss-hist-item" href="/busca?str=' + encodeURIComponent(q) + '" data-tss-search="' + esc(q) + '">'
        + '<span class="tss-item-icon">' + CLOCK + '</span>'
        + '<span class="tss-item-name">' + esc(q) + '</span></a>';
    }).join('');
    return '<div class="tss-section"><div class="tss-section-title">' + CLOCK + ' BUSCAS RECENTES</div>' + items + '</div>';
  }
  function initAutocomplete() {
    var sugg = document.getElementById('suggestions');
    var primary = document.getElementById('isearch') || document.getElementById('misearch');
    if (!sugg || !primary) return;
    var cont = document.getElementById('tss-container');
    if (!cont) { cont = document.createElement('div'); cont.id = 'tss-container'; sugg.appendChild(cont); }
    // Neutraliza o autocomplete legado (jQuery keyup -> .suggestions-results; o CSS ja esconde,
    // e o MutationObserver limpa qualquer conteudo que ele tente injetar).
    if (window.jQuery) { try { jQuery('#isearch').off('keyup').off('input'); jQuery('#misearch').off('keyup').off('input'); jQuery('.busca').off('keyup'); } catch (e) { } }
    var sr = document.querySelector('.suggestions-results');
    if (sr) { try { new MutationObserver(function () { if (sr.innerHTML.trim() !== '') sr.innerHTML = ''; }).observe(sr, { childList: true, subtree: true }); } catch (e) { } }
    var inputs = [primary]; var mi = document.getElementById('misearch'); if (mi && mi !== primary) inputs.push(mi);
    var timer = null, lastQ = '';
    function show() { sugg.style.display = 'block'; sugg.style.opacity = '1'; }
    function hide() { sugg.style.display = 'none'; }
    function showHist() {
      var hist = renderHist();
      if (hist) { cont.innerHTML = hist; show(); } // historico na hora (se houver)
      fetchPopular(function (prods) {               // anexa "Mais buscados" (cacheado 10min)
        var html = hist + renderPopular(prods);
        if (html) { cont.innerHTML = html; show(); } else { hide(); }
      });
    }
    function run(q) {
      var _t0 = Date.now();
      cont.innerHTML = LOADER_HTML; show();
      fetch(API + '?q=' + encodeURIComponent(q) + '&limit=' + MAX_AC, { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (q !== lastQ) return;
          var prods = (j && j.products) || []; var total = (j && j.total) || prods.length;
          var _render = function () { if (q !== lastQ) return; cont.innerHTML = renderItems(prods, q, total, !!(j && j.usedAi)); show(); };
          var _el = Date.now() - _t0;
          if (_el < LOADER_MIN_MS) setTimeout(_render, LOADER_MIN_MS - _el); else _render();
        })
        .catch(function () { });
    }
    inputs.forEach(function (inp) {
      inp.setAttribute('autocomplete', 'off');
      inp.addEventListener('keyup', function (e) { if (e.keyCode === 13 || e.keyCode === 27) return; e.stopImmediatePropagation(); }, true);
      inp.addEventListener('input', function () {
        var q = inp.value.trim(); lastQ = q;
        if (timer) clearTimeout(timer);
        if (q.length < MIN_CHARS) { showHist(); return; }
        timer = setTimeout(function () { run(q); }, 250);
      });
      inp.addEventListener('focus', function () { setTimeout(function () { if (inp.value.trim().length >= MIN_CHARS) { if (cont.innerHTML.trim() !== '') show(); } else { showHist(); } }, 0); });
    });
    inputs.forEach(function (inp) { var f = inp.form || (inp.closest && inp.closest('form')); if (f && !f.__tssHist) { f.__tssHist = 1; f.addEventListener('submit', function () { saveHist(inp.value); if (inp.value.trim().length >= MIN_CHARS) showPageLoader(); }); } });
    cont.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('.tss-hist-item'); if (a) { saveHist(a.getAttribute('data-tss-search')); showPageLoader(); } else if (e.target.closest && e.target.closest('.tss-view-all')) { showPageLoader(); } });
    try { if (location.pathname.indexOf('/busca') === 0) { var _m = /[?&]str=([^&]+)/.exec(location.search); if (_m) saveHist(decodeURIComponent(_m[1].replace(/\+/g, ' '))); } } catch (e) { }
    document.addEventListener('click', function (e) { if (!sugg.contains(e.target) && inputs.indexOf(e.target) === -1) hide(); });
  }
  /* ---------------- Track-click: registra clique em resultado -> alimenta clickPopularity (ranking). __TSS_CLICK__
   * productId = id INTERNO do catalogo (data-tss-product), que e a chave do clickPopularity no Meili.
   * Fire-and-forget (keepalive) para nao atrasar a navegacao ao produto. */
  function tssCurrentQuery() {
    try {
      if (location.pathname.indexOf('/busca') !== 0) return '';
      var m = /[?&]str=([^&]+)/.exec(location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    } catch (e) { return ''; }
  }
  function tssTrackClick(productId, externalId, source, q) {
    if (!productId) return;
    try {
      var payload = { productId: String(productId), source: source, searchQuery: q || '' };
      if (externalId) payload.externalId = String(externalId);
      fetch(API + 'track-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
  }
  // Clique num card de resultado da /busca (ignora botao de carrinho/view) -> source search_results
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.tss-card-cart-btn, .tss-item-cart-btn, [data-tss-setview]')) return;
    var card = e.target.closest('.product-item[data-tss-product], .tss-result-card[data-tss-product]');
    if (!card) return;
    var pid = card.getAttribute('data-tss-product');
    var b = card.querySelector('[data-tss-add]'); var eid = b ? (b.getAttribute('data-tss-add') || '') : '';
    if (pid) tssTrackClick(pid, eid, 'search_results', tssCurrentQuery());
  }, true);
  // Clique num item do autocomplete (ignora botao de carrinho) -> source autocomplete
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.tss-item-cart-btn')) return;
    var it = e.target.closest('.tss-item[data-tss-product]');
    if (!it) return;
    var pid = it.getAttribute('data-tss-product');
    var b = it.querySelector('[data-tss-add]'); var eid = b ? (b.getAttribute('data-tss-add') || '') : '';
    if (pid) tssTrackClick(pid, eid, 'autocomplete', tssCurrentQuery());
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAutocomplete);
  else initAutocomplete();
})();
