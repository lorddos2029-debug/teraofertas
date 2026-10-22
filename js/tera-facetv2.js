/* Tera Dept Filter V2 (Opcao A) — sidebar SERVER-DRIVEN, estavel.
   Le as contagens EXATAS de #tera-facet-counts (categoria/marca/preco, do banco) e, ao filtrar
   (categoria + marca + ordem), chama o AJAX NATIVO do departamento com o combo -> o servidor devolve
   os cards que casam (COM preco), paginado. Injeta so os cards no grid (mantem o sidebar montado).
   Sem filtragem client-side, sem observer, sem juggling -> nao oscila, nao dá branco. Fail-safe total. */
(function () {
  "use strict";
  try {
    if (location.pathname.indexOf("/produto/") === 0 || location.pathname.indexOf("/busca") === 0) return;
    if (window.__tfv2_done || typeof window.jQuery === "undefined") return;

    function svg(inner, s) { return '<svg width="' + (s || 15) + '" height="' + (s || 15) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>"; }
    var IC = { chev: '<polyline points="6 9 12 15 18 9"/>', check: '<polyline points="20 6 9 17 4 12"/>', up: '<line x1="12" y1="19" x2="12" y2="6"/><polyline points="6 12 12 6 18 12"/>', down: '<line x1="12" y1="5" x2="12" y2="18"/><polyline points="6 12 12 18 18 12"/>', sliders: '<line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="10" cy="8" r="2.4"/><circle cx="15" cy="16" r="2.4"/>' };
    function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

    // Parse TOLERANTE: extrai o 1o objeto JSON do inicio da resposta, ignorando lixo APENDADO depois.
    // Necessario porque um CF Worker de SEO (faq-injector) injeta HTML de FAQ NO FIM da resposta do
    // AJAX de categoria (que e' JSON) -> JSON.parse puro quebra (parsererror) e o filtro nao aplicava
    // em subdepartamentos com FAQ. Varre contando chaves, respeitando strings/escapes. Fail-safe: null.
    function parseLeadingJson(text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (e) {}
      var start = text.indexOf("{"); if (start < 0) return null;
      var depth = 0, inStr = false, esc2 = false;
      for (var i = start; i < text.length; i++) {
        var ch = text[i];
        if (inStr) { if (esc2) { esc2 = false; } else if (ch === "\\") { esc2 = true; } else if (ch === '"') { inStr = false; } }
        else { if (ch === '"') { inStr = true; } else if (ch === "{") { depth++; } else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; } } } }
      }
      return null;
    }

    function boot() { try { run(); } catch (e) { if (window.console) console.log("[TFV2-ERR] " + (e && e.message) + " @ " + (e && e.stack ? e.stack.split("\n")[1] : "?")); } }

    function run() {
      var fcEl = document.getElementById("tera-facet-counts");
      if (!fcEl) return;
      var FC; try { FC = JSON.parse(fcEl.textContent || "{}"); } catch (e) { return; }
      if (!FC || !FC.total) return;
      // grade de listagem do departamento (>=4 cards diretos dentro do #prodarea)
      // 23/09/2026: o card passou a vir embrulhado em .product-item-frame (PR #1603, badge do card,
      // na 2.4.10). Contar so ".product-item" como filho DIRETO passou a dar zero, a grade nunca era
      // encontrada e o sidebar inteiro sumia do site — sem erro no console, porque aqui so se retorna.
      var CARD_DIRETO = ":scope > .product-item, :scope > .product-item-frame";
      var grid = null, pgs = [].slice.call(document.querySelectorAll("#prodarea .products-grid"));
      for (var gi = 0; gi < pgs.length; gi++) { if (pgs[gi].querySelectorAll(CARD_DIRETO).length >= 4) { grid = pgs[gi]; break; } }
      if (!grid || !grid.parentElement) return;
      window.__tfv2_done = true;
      var container = grid.closest("#prodarea") || grid.parentElement;

      try { ["subopcoes", "bfabricante", "bordenarpor"].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = "none"; }); } catch (e) {}

      var layout = document.createElement("div"); layout.className = "tdf-layout";
      var side = document.createElement("aside"); side.className = "tdf-side";
      var main = document.createElement("div"); main.className = "tdf-main";
      grid.parentNode.insertBefore(layout, grid);
      layout.appendChild(side); layout.appendChild(main); main.appendChild(grid);
      var bar = document.createElement("div"); bar.className = "tdf-bar"; main.insertBefore(bar, grid);
      // NOSSO "ver mais" (id proprio) — pagina o conjunto FILTRADO. Escondemos o #pdmore nativo pra
      // o handler do js/app.js (que ignora a categoria) nao disparar. O nativo indica se ha +paginas.
      var nativeMore = document.getElementById("pdmore"); var hadNativeMore = !!(nativeMore && nativeMore.getBoundingClientRect().height > 0);
      if (nativeMore) nativeMore.style.display = "none";
      var tfMore = document.createElement("a"); tfMore.className = "arrow-down btn btn-pdmore tfv2-more"; tfMore.href = "javascript:void(0)"; tfMore.setAttribute("role", "button"); tfMore.innerHTML = '<span class="hidden-xs hidden-sm">CLIQUE PARA</span> VER MAIS PRODUTOS'; tfMore.style.display = hadNativeMore ? "" : "none";
      main.appendChild(tfMore);
      tfMore.addEventListener("click", function (e) { e.preventDefault(); loadMore(); });

      var state = { order: "", marca: "", marcaNome: "", categoria: "", attr: {}, attrCat: "", pg: 1, busy: false, seq: 0 };

      side.innerHTML = '<div class="tdf-hd"><b>FILTROS</b><span class="tdf-ic">' + svg(IC.sliders, 18) + '</span><button class="tdf-close" aria-label="Fechar">&times;</button></div>' +
        '<div class="tdf-sub"><b id="tdf-count">' + FC.total + '</b> produtos</div>' +
        '<div id="tdf-facets"></div>';
      var fx = side.querySelector("#tdf-facets");
      var _hdr = document.getElementById("header"); var HH = _hdr ? Math.round(_hdr.getBoundingClientRect().height) : 90;
      side.style.setProperty("--tdf-top", (HH + 10) + "px"); layout.style.scrollMarginTop = (HH + 12) + "px";
      function scrollToResults() { var sc = document.scrollingElement || document.documentElement; var y = layout.getBoundingClientRect().top + (sc.scrollTop || window.pageYOffset || 0) - (HH + 12); try { sc.scrollTo({ top: Math.max(0, Math.round(y)), behavior: "smooth" }); } catch (e) { try { window.scrollTo(0, Math.max(0, y)); } catch (e2) {} } }

      function fgroup(title, build, target) { var g = document.createElement("div"); g.className = "tdf-fg"; g.innerHTML = '<div class="tdf-t">' + esc(title) + '<span class="tdf-cv">' + svg(IC.chev) + '</span></div>'; g.querySelector(".tdf-t").addEventListener("click", function () { g.classList.toggle("tdf-cl"); }); var bd = document.createElement("div"); bd.className = "tdf-body"; g.appendChild(bd); build(bd); (target || fx).appendChild(g); return g; }

      // ORDENAR POR PREÇO (server-side)
      fgroup("Ordenar por preço", function (bd) {
        var wrap = document.createElement("div"); wrap.className = "tdf-sort";
        [["preco_asc", "Menor preço", IC.up], ["preco_desc", "Maior preço", IC.down]].forEach(function (o) {
          var b = document.createElement("button"); b.className = "tdf-sortbtn"; b.innerHTML = svg(o[2], 14) + "<span>" + o[1] + "</span>";
          b.addEventListener("click", function () { var was = b.classList.contains("tdf-on"); [].forEach.call(wrap.querySelectorAll(".tdf-sortbtn"), function (x) { x.classList.remove("tdf-on"); }); state.order = was ? "" : o[0]; if (!was) b.classList.add("tdf-on"); apply(); });
          wrap.appendChild(b);
        });
        bd.appendChild(wrap);
      });
      // TIPO DE PRODUTO (categoria enriquecida) e MARCA (fabricante) — contagens exatas do banco.
      // Guardamos os corpos p/ RE-RENDERIZAR no drill-down (a cada filtro, o backend devolve as
      // contagens ja recortadas -> so aparece opcao que existe no combo, nunca dead-end/branco).
      var bdCat = null, bdMarca = null, marcaGroup = null;
      // [Marca inline] Em certas categorias a Marca (fabricante nativo) e' encaixada NO MEIO do fluxo
      // de atributos, na posicao indicada (indice = quantos atributos vem ANTES dela). Ex.: Placa de
      // Video -> Fabricante(0), Marca, Modelo, VRAM. Fora dessas, a Marca fica no grupo nativo do fim.
      var MARCA_INLINE = { "Placa de Vídeo": 1 };
      var curMarcas = FC.marcas || [];
      if ((FC.categorias || []).length) fgroup("Tipo de produto", function (bd) { bdCat = bd; fillOpts(bd, FC.categorias, "categoria"); });
      // [Atributos] container p/ facetas de spec (RAM: Capacidade/Velocidade; GPU: VRAM/Modelo...). So
      // aparecem quando ha UMA categoria em foco (o backend manda FC.attrs + FC.attrCat). Re-renderizado
      // a cada drill-down. Fica ENTRE Tipo e Marca.
      var attrsBox = document.createElement("div"); attrsBox.id = "tdf-attrs"; fx.appendChild(attrsBox);
      if ((FC.marcas || []).length) marcaGroup = fgroup("Marca", function (bd) { bdMarca = bd; fillOpts(bd, FC.marcas, "marca"); });

      // renderiza (ou re-renderiza) os grupos de atributo a partir de uma lista attrs [{key,label,suf,num,options}]
      function renderAttrs(attrs, attrCat) {
        attrsBox.innerHTML = "";
        state.attrCat = attrCat || "";
        // Marca inline? esconde o grupo nativo de Marca e a encaixa no fluxo (posicao MARCA_INLINE[cat]).
        var inlineAt = (attrCat && Object.prototype.hasOwnProperty.call(MARCA_INLINE, attrCat)) ? MARCA_INLINE[attrCat] : -1;
        if (marcaGroup) marcaGroup.style.display = (inlineAt >= 0) ? "none" : "";
        function addMarca() { if (curMarcas && curMarcas.length) fgroup("Marca", function (bd) { fillOpts(bd, curMarcas, "marca"); }, attrsBox); }
        var list = attrs || [];
        if (!list.length && inlineAt < 0) return;
        list.forEach(function (at, i) {
          if (i === inlineAt) addMarca();
          fgroup(at.label, function (bd) { fillAttrOpts(bd, at); }, attrsBox);
        });
        if (inlineAt >= 0 && inlineAt >= list.length) addMarca(); // Marca no fim se o indice passa do total
      }
      function fillAttrOpts(bd, at) {
        bd.innerHTML = "";
        // [MULTIATTR] state.attr[chave] agora e LISTA de valores (varios marcaveis por faceta)
        var active = state.attr[at.key]; if (active == null) active = []; if (!Array.isArray(active)) active = [String(active)];
        (at.options || []).forEach(function (op, i) {
          var isOn = active.indexOf(String(op.v)) !== -1; // [MULTIATTR]
          var r = document.createElement("div"); r.className = "tdf-opt" + (isOn ? " tdf-on" : "") + (i >= 8 ? " tdf-xtra" : ""); if (i >= 8 && !isOn) r.style.display = "none";
          var lbl = esc(String(op.v)) + (at.suf ? " " + esc(at.suf) : "");
          r.innerHTML = '<span class="tdf-box">' + svg(IC.check, 11) + '</span><span class="tdf-lbl">' + lbl + '</span><span class="tdf-ct">' + op.c + "</span>";
          r.addEventListener("click", function () {
            // [MULTIATTR] alterna SO esta opcao — as irmas continuam marcadas (OU dentro da faceta)
            var on = r.classList.contains("tdf-on");
            var cur = state.attr[at.key]; if (cur == null) cur = []; if (!Array.isArray(cur)) cur = [String(cur)];
            var v = String(op.v), ix = cur.indexOf(v);
            if (on) { if (ix !== -1) cur.splice(ix, 1); r.classList.remove("tdf-on"); }
            else { if (ix === -1) cur.push(v); r.classList.add("tdf-on"); }
            if (cur.length) { state.attr[at.key] = cur; } else { delete state.attr[at.key]; }
            apply();
          });
          bd.appendChild(r);
        });
        if ((at.options || []).length > 8) { var m = document.createElement("div"); m.className = "tdf-more"; m.textContent = "+ ver mais " + (at.options.length - 8); m.addEventListener("click", function () { [].forEach.call(bd.querySelectorAll(".tdf-xtra"), function (e) { e.style.display = "flex"; }); m.remove(); }); bd.appendChild(m); }
      }
      renderAttrs(FC.attrs, FC.attrCat);

      function fillOpts(bd, arr, kind) {
        bd.innerHTML = "";
        var activeVal = (kind === "categoria") ? state.categoria : state.marca;
        // garante que a opcao ATIVA apareca mesmo que o drill-down a devolva sozinha
        arr.forEach(function (item, i) {
          var val = (kind === "categoria") ? item.v : String(item.id);
          var isOn = (activeVal && String(val) === String(activeVal));
          var r = document.createElement("div"); r.className = "tdf-opt" + (isOn ? " tdf-on" : "") + (i >= 8 ? " tdf-xtra" : ""); if (i >= 8 && !isOn) r.style.display = "none";
          r.innerHTML = '<span class="tdf-box">' + svg(IC.check, 11) + '</span><span class="tdf-lbl">' + esc(item.v) + '</span><span class="tdf-ct">' + item.c + "</span>";
          r.addEventListener("click", function () {
            var on = r.classList.contains("tdf-on");
            [].forEach.call(bd.querySelectorAll(".tdf-opt.tdf-on"), function (x) { x.classList.remove("tdf-on"); });
            if (kind === "categoria") { state.categoria = on ? "" : item.v; state.attr = {}; }
            else { state.marca = on ? "" : String(item.id); state.marcaNome = on ? "" : item.v; }
            if (!on) r.classList.add("tdf-on");
            apply();
          });
          bd.appendChild(r);
        });
        if (arr.length > 8) { var m = document.createElement("div"); m.className = "tdf-more"; m.textContent = "+ ver mais " + (arr.length - 8); m.addEventListener("click", function () { [].forEach.call(bd.querySelectorAll(".tdf-xtra"), function (e) { e.style.display = "flex"; }); m.remove(); }); bd.appendChild(m); }
      }
      // DRILL-DOWN: re-renderiza as facetas com as contagens novas (recortadas pelo filtro ativo).
      function updateFacets(fc) {
        if (!fc) return;
        if (fc.marcas) curMarcas = fc.marcas; // p/ a Marca inline re-renderizar recortada no drill-down
        if (bdCat && fc.categorias) fillOpts(bdCat, fc.categorias, "categoria");
        if (bdMarca && fc.marcas) fillOpts(bdMarca, fc.marcas, "marca");
        renderAttrs(fc.attrs, fc.attrCat); // facetas de atributo (+ Marca inline) re-recortadas (drill-down)
      }

      // AJAX nativo do departamento com o combo -> cards que casam (com preco)
      function fetchPage(pg) {
        // pg=1 NAO manda 'more' (o PHP getParam le a string "false" como truthy -> devolveria fragmento).
        // [Fase 2] pp=48: carrega menos cards por vez (payload ~3x menor); o "ver mais" traz o resto.
        // categoria: usa a selecionada OU a categoria ativa dos attrs (subdepto de categoria unica) —
        // necessaria pro backend aplicar os filtros de atributo. attr: mapa chave->valor dos specs.
        var cat = state.categoria || (Object.keys(state.attr).length ? state.attrCat : "") || "";
        var flt = { marca: state.marca || "", order: state.order || "", categoria: cat, pg: String(pg), pp: "30", str: "", puro: "1" };
        // [CF] Os atributos vao como chaves de UM colchete (filter[attr_<chave>]=valor). O WAF do
        // Cloudflare DESCARTA silenciosamente parametros de DOIS colchetes (filter[attr][chave]) ->
        // antes o filtro de atributo nunca chegava ao backend em producao. Aqui o mapa vira flat.
        // [MULTIATTR] varios valores viajam num parametro so, separados por "|"
        for (var ak in state.attr) { if (state.attr.hasOwnProperty(ak)) { var vv = state.attr[ak]; if (!Array.isArray(vv)) vv = (vv === "" || vv == null) ? [] : [String(vv)]; if (vv.length) { flt["attr_" + ak] = vv.join("|"); } } }
        var data = { app: true, url: location.pathname, filter: flt };
        if (pg > 1) { data.more = true; }
        return new Promise(function (resolve) {
          // dataType:"text" + parse tolerante (a resposta pode vir com FAQ do CF Worker apendada no fim).
          window.jQuery.ajax({ url: location.pathname, type: "POST", cache: false, dataType: "text", data: data, success: function (t) { resolve(parseLeadingJson(t)); }, error: function () { resolve(null); } });
        });
      }
      // Pegar o .product-item-frame quando existir: injetar o card PELADO no meio de uma grade de
      // frames deixaria os cards filtrados com aparencia diferente dos que ja estavam na tela.
      function cardsFrom(html) { var doc = new DOMParser().parseFromString(html || "", "text/html"); var c = doc.querySelectorAll("#prodarea .products-grid > .product-item-frame"); if (!c.length) c = doc.querySelectorAll(".products-grid > .product-item-frame"); if (!c.length) c = doc.querySelectorAll(".product-item-frame"); if (!c.length) c = doc.querySelectorAll("#prodarea .products-grid .product-item"); if (!c.length) c = doc.querySelectorAll(".products-grid .product-item"); if (!c.length) c = doc.querySelectorAll(".product-item"); return { cards: c, pdmore: doc.getElementById("pdmore") }; }
      function inject(cards, replace) { if (replace) grid.innerHTML = ""; var frag = document.createDocumentFragment(); [].forEach.call(cards, function (c) { frag.appendChild(document.importNode(c, true)); }); grid.appendChild(frag); }
      function setMore(hasMore) { tfMore.style.display = hasMore ? "" : "none"; }
      function activeCount() { // contador estavel a partir das contagens do banco (faceta unica); combo -> mostra "+"
        if (state.categoria && !state.marca) { var c = (FC.categorias || []).filter(function (x) { return x.v === state.categoria; })[0]; return c ? c.c : null; }
        if (state.marca && !state.categoria) { var m = (FC.marcas || []).filter(function (x) { return String(x.id) === state.marca; })[0]; return m ? m.c : null; }
        if (!state.marca && !state.categoria) return FC.total;
        return null; // combo
      }

      function apply() {
        var mySeq = ++state.seq; state.pg = 1; grid.style.opacity = "0.5";
        fetchPage(1).then(function (h) {
          if (mySeq !== state.seq) return; // filtro mudou no meio -> descarta
          grid.style.opacity = "";
          if (!h) return;
          var ex = cardsFrom(h.body || h.more || "");
          inject(ex.cards, true);
          setMore(!!ex.pdmore);
          updateFacets(h.facets); // DRILL-DOWN: atualiza as opcoes/contagens das facetas
          var cEl = document.getElementById("tdf-count");
          var total = (h.facets && typeof h.facets.total === "number") ? h.facets.total : activeCount();
          if (cEl) cEl.textContent = (total != null ? total : (ex.cards.length + "+"));
          chips(); scrollToResults();
        });
      }
      function loadMore() {
        if (state.busy) return; state.busy = true; state.pg++;
        var lbl = tfMore.innerHTML; tfMore.innerHTML = "Carregando...";
        fetchPage(state.pg).then(function (h) {
          state.busy = false; tfMore.innerHTML = lbl;
          if (!h) { return; }
          // pg>1 -> resposta {more: cards, bpg: botao}. O bpg indica se ainda ha proxima pagina.
          var exCards = cardsFrom(h.more || h.body || "");
          var maisPaginas = h.bpg ? !!cardsFrom(h.bpg).pdmore : !!exCards.pdmore;
          inject(exCards.cards, false);
          setMore(maisPaginas);
        });
      }

      // [Scroll infinito] carrega a proxima pagina automaticamente quando o "ver mais" se aproxima
      // da viewport (rootMargin adianta ~500px). O botao continua clicavel como fallback (sem JS/IO).
      // So dispara se houver proxima pagina (tfMore visivel) e nao estiver carregando.
      try {
        if ("IntersectionObserver" in window) {
          var __ioMore = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].isIntersecting && tfMore.style.display !== "none" && !state.busy) { loadMore(); }
            }
          }, { root: null, rootMargin: "500px 0px", threshold: 0 });
          __ioMore.observe(tfMore);
        }
      } catch (e) {}

      function chips() {
        bar.innerHTML = ""; var any = false;
        function chip(label, clear) { any = true; var c = document.createElement("span"); c.className = "tdf-chip"; c.innerHTML = esc(label) + ' <span class="tdf-x">&times;</span>'; c.querySelector(".tdf-x").addEventListener("click", clear); bar.appendChild(c); }
        function clearOptIn(rx) { [].forEach.call(side.querySelectorAll(".tdf-fg"), function (g) { var t = g.querySelector(".tdf-t"); if (t && rx.test(t.textContent)) [].forEach.call(g.querySelectorAll(".tdf-opt.tdf-on"), function (o) { o.classList.remove("tdf-on"); }); }); }
        if (state.categoria) chip(state.categoria, function () { state.categoria = ""; state.attr = {}; clearOptIn(/tipo de produto/i); apply(); });
        // [MULTIATTR] um chip por valor; o X remove so aquele valor
        Object.keys(state.attr).forEach(function (k) {
          var vs = state.attr[k]; if (!Array.isArray(vs)) vs = [String(vs)];
          vs.forEach(function (v) { chip(String(v), function () {
            var cur = state.attr[k]; if (!Array.isArray(cur)) cur = [String(cur)];
            var ix = cur.indexOf(String(v)); if (ix !== -1) cur.splice(ix, 1);
            if (cur.length) { state.attr[k] = cur; } else { delete state.attr[k]; }
            [].forEach.call(side.querySelectorAll(".tdf-opt.tdf-on"), function (o) {
              var l = o.querySelector(".tdf-lbl"); if (l && l.textContent.trim() === String(v)) o.classList.remove("tdf-on");
            });
            apply();
          }); });
        });
        if (state.marca) chip(state.marcaNome || "Marca", function () { state.marca = ""; state.marcaNome = ""; clearOptIn(/marca/i); apply(); });
        if (state.order) chip(state.order === "preco_asc" ? "Menor preço" : "Maior preço", function () { state.order = ""; [].forEach.call(side.querySelectorAll(".tdf-sortbtn.tdf-on"), function (o) { o.classList.remove("tdf-on"); }); apply(); });
        if (any) { var cl = document.createElement("span"); cl.className = "tdf-chip tdf-clear"; cl.textContent = "Limpar filtros"; cl.addEventListener("click", function () { state.categoria = ""; state.marca = ""; state.marcaNome = ""; state.order = ""; state.attr = {}; [].forEach.call(side.querySelectorAll(".tdf-opt.tdf-on,.tdf-sortbtn.tdf-on"), function (o) { o.classList.remove("tdf-on"); }); apply(); }); bar.appendChild(cl); }
      }

      // MOBILE
      var mbtn = document.createElement("button"); mbtn.className = "tdf-mobile-btn"; mbtn.innerHTML = svg(IC.sliders, 16) + " FILTROS"; main.insertBefore(mbtn, main.firstChild);
      mbtn.addEventListener("click", function () { if (side.parentNode !== document.body) document.body.appendChild(side); void side.offsetWidth; side.classList.add("tdf-open"); document.body.style.overflow = "hidden"; });
      var _cx = side.querySelector(".tdf-close"); if (_cx) _cx.addEventListener("click", function () { side.classList.remove("tdf-open"); document.body.style.overflow = ""; setTimeout(function () { if (!side.classList.contains("tdf-open") && side.parentNode === document.body) layout.insertBefore(side, main); }, 280); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  } catch (e) {}
})();
