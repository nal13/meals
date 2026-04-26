import pathlib
p = pathlib.Path(r'C:/Users/nanobreg/Downloads/meal-planner')

# ── index.html ────────────────────────────────────────────────────────────────
html = """\
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Planeador de Refeicoes</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<header>
    <h1>Planeador de Refeicoes</h1>
    <button class="btn-outline" id="open-add-recipe">+ Nova Receita</button>
</header>

<main>
    <div class="left-col">

        <section>
            <h2>Semana</h2>
            <div class="week-grid" id="week-grid"></div>
        </section>

        <section>
            <div class="section-header">
                <h2>Extra</h2>
                <button class="btn-small" id="add-extra-row">+ Adicionar</button>
            </div>
            <div id="extra-list"></div>
            <div id="extra-empty" class="empty-msg">Adiciona refeicoes extra aqui.</div>
        </section>

        <section>
            <h2>As Minhas Receitas</h2>
            <div id="recipes-grid" class="recipes-grid"></div>
            <div id="recipes-empty" class="empty-msg hidden">Ainda nao tens receitas.</div>
        </section>

    </div>

    <aside class="shopping-panel">
        <div class="shopping-header">
            <h2>Lista de Compras</h2>
            <button class="btn-primary" id="download-btn">Download</button>
        </div>
        <div id="shopping-empty" class="empty-msg">Atribui receitas para gerar a lista.</div>
        <ul id="shopping-list"></ul>
    </aside>
</main>

<!-- Modal Adicionar/Editar Receita -->
<div class="modal-overlay hidden" id="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3 id="modal-title">Nova Receita</h3>
            <button class="modal-close" id="modal-close">X</button>
        </div>
        <div class="modal-body">
            <label>Nome da receita
                <input type="text" id="recipe-name-input" placeholder="ex: Esparguete a Bolonhesa">
            </label>
            <div>
                <div class="img-label-row">
                    <span class="field-label">Imagem (opcional)</span>
                    <label class="btn-small" for="img-input">Escolher imagem</label>
                    <input type="file" id="img-input" accept="image/*" hidden>
                    <button class="btn-icon hidden" id="img-remove" title="Remover imagem">X</button>
                </div>
                <img id="img-preview" class="img-preview hidden" alt="preview">
            </div>
            <div class="ingredients-header">
                <span class="field-label">Ingredientes</span>
                <button class="btn-small" id="add-ingredient-row">+ Adicionar</button>
            </div>
            <div id="ingredients-list"></div>
        </div>
        <div class="modal-footer">
            <button class="btn-outline" id="modal-cancel">Cancelar</button>
            <button class="btn-primary" id="modal-save">Guardar Receita</button>
        </div>
    </div>
</div>

<!-- Modal Ver Receita -->
<div class="modal-overlay hidden" id="view-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3 id="view-title"></h3>
            <button class="modal-close" id="view-close">X</button>
        </div>
        <div class="modal-body" id="view-body"></div>
        <div class="modal-footer">
            <button class="btn-outline" id="view-edit">Editar</button>
            <button class="btn-danger" id="view-delete">Apagar</button>
            <button class="btn-primary" id="view-close-btn">Fechar</button>
        </div>
    </div>
</div>

<script src="script.js"></script>
</body>
</html>
"""

# ── style.css ─────────────────────────────────────────────────────────────────
css = """\
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --bg: #f6f8fa;
    --surface: #ffffff;
    --border: #d0d7de;
    --border-light: #eaecef;
    --text: #1f2328;
    --muted: #656d76;
    --accent: #0969da;
    --accent-hover: #0757ba;
    --accent-light: #ddf4ff;
    --red: #cf222e;
    --radius: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
}

html { font-size: 15px; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
}

header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: .9rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: var(--shadow);
}
header h1 { font-size: 1.25rem; }

.btn-primary {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    padding: .45rem 1rem;
    cursor: pointer;
    font-size: .875rem;
    font-weight: 600;
    transition: background .15s;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: .4; cursor: not-allowed; }

.btn-outline {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: .45rem 1rem;
    cursor: pointer;
    font-size: .875rem;
    font-weight: 600;
    transition: background .15s;
}
.btn-outline:hover { background: var(--accent-light); }

.btn-small {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: .25rem .65rem;
    cursor: pointer;
    font-size: .8rem;
    font-weight: 600;
}
.btn-small:hover { background: var(--accent-hover); }

.btn-danger {
    background: var(--red);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    padding: .45rem 1rem;
    cursor: pointer;
    font-size: .875rem;
    font-weight: 600;
}
.btn-danger:hover { background: #a40e26; }

.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: .85rem;
    padding: .2rem .4rem;
    border-radius: 4px;
    transition: color .15s;
}
.btn-icon:hover { color: var(--red); }

main {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.5rem;
    max-width: 1300px;
    margin: 1.5rem auto;
    padding: 0 1.5rem;
    align-items: start;
}
@media (max-width: 900px) { main { grid-template-columns: 1fr; } }

.left-col { display: flex; flex-direction: column; gap: 1.75rem; }

h2 {
    font-size: .82rem;
    margin-bottom: .85rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .07em;
    font-weight: 700;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: .85rem;
}
.section-header h2 { margin: 0; }

.week-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: .85rem;
}

.day-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .9rem 1rem;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: .55rem;
}
.day-name { font-weight: 700; font-size: .95rem; }

.day-select {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: .35rem .5rem;
    font-size: .85rem;
    color: var(--text);
    cursor: pointer;
    outline: none;
}
.day-select:focus { border-color: var(--accent); }

.day-recipe-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .35rem;
    min-height: 1.4rem;
}
.day-recipe-name {
    font-size: .8rem;
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.extra-row {
    display: grid;
    grid-template-columns: 1fr auto 70px auto;
    gap: .5rem;
    align-items: center;
    margin-bottom: .5rem;
}
.extra-times {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: .35rem .5rem;
    font-size: .875rem;
    color: var(--text);
    width: 100%;
    text-align: center;
    outline: none;
}
.extra-times:focus { border-color: var(--accent); }
.extra-x { color: var(--muted); font-weight: 700; }

.shopping-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.1rem;
    box-shadow: var(--shadow);
    position: sticky;
    top: 70px;
}
.shopping-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: .85rem;
}
.shopping-header h2 { margin: 0; }

.empty-msg { color: var(--muted); font-size: .875rem; padding: .4rem 0; }

#shopping-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: .4rem;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
}
.shop-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: .4rem .6rem;
    border-radius: 6px;
    background: var(--bg);
    font-size: .875rem;
}
.shop-item-qty { font-weight: 700; color: var(--accent); }

.recipes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: .85rem;
}
.recipe-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.recipe-card-img {
    width: 100%;
    height: 115px;
    object-fit: cover;
    display: block;
}
.recipe-card-placeholder {
    width: 100%;
    height: 115px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .8rem;
    color: var(--muted);
    font-style: italic;
}
.recipe-card-info {
    padding: .55rem .7rem;
    display: flex;
    align-items: center;
    gap: .4rem;
}
.recipe-card-name {
    font-size: .875rem;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    color: var(--accent);
}
.recipe-card-name:hover { text-decoration: underline; }
.recipe-card-actions { display: flex; gap: .1rem; flex-shrink: 0; }

.field-label { font-size: .875rem; font-weight: 600; }
.img-label-row { display: flex; align-items: center; gap: .5rem; margin-bottom: .4rem; }
.img-preview {
    width: 100%;
    max-height: 180px;
    object-fit: cover;
    border-radius: var(--radius);
    border: 1px solid var(--border);
}
.view-recipe-img {
    width: 100%;
    max-height: 230px;
    object-fit: cover;
    border-radius: var(--radius);
    margin-bottom: .85rem;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.4);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}
.modal-overlay.hidden { display: none; }
.modal {
    background: var(--surface);
    border-radius: var(--radius);
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 25px rgba(0,0,0,.2);
}
.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-light);
}
.modal-header h3 { font-size: 1.05rem; }
.modal-close {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: var(--muted);
    padding: .2rem .5rem;
    border-radius: 4px;
    font-weight: 700;
}
.modal-close:hover { background: var(--bg); }
.modal-body {
    padding: 1.1rem 1.25rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: .9rem;
}
.modal-body label {
    display: flex;
    flex-direction: column;
    gap: .35rem;
    font-size: .875rem;
    font-weight: 600;
}
.modal-body input[type="text"],
.modal-body input[type="number"] {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: .45rem .65rem;
    font-size: .875rem;
    color: var(--text);
    outline: none;
    width: 100%;
}
.modal-body input:focus { border-color: var(--accent); }

.ingredients-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: .875rem;
    font-weight: 600;
}
.ingredient-row {
    display: grid;
    grid-template-columns: 1fr 90px auto;
    gap: .4rem;
    align-items: center;
    margin-bottom: .4rem;
}
.ingredient-row input { font-size: .85rem; }

.modal-footer {
    display: flex;
    gap: .5rem;
    justify-content: flex-end;
    padding: .9rem 1.25rem;
    border-top: 1px solid var(--border-light);
    flex-wrap: wrap;
}

.view-ingredient-list { list-style: none; display: flex; flex-direction: column; gap: .35rem; }
.view-ingredient-list li {
    display: flex;
    justify-content: space-between;
    padding: .35rem .5rem;
    border-radius: 6px;
    background: var(--bg);
    font-size: .875rem;
}
.view-ingredient-qty { font-weight: 700; color: var(--accent); }

.hidden { display: none !important; }
"""

# ── script.js ─────────────────────────────────────────────────────────────────
js = """\
'use strict';

var RECIPES_KEY = 'mp_recipes';
var WEEK_KEY    = 'mp_week';
var EXTRAS_KEY  = 'mp_extras';
var DAYS = ['Segunda','Terca','Quarta','Quinta','Sexta','Sabado','Domingo'];

function loadRecipes() { try { return JSON.parse(localStorage.getItem(RECIPES_KEY)) || {}; } catch(e) { return {}; } }
function saveRecipes(r) { try { localStorage.setItem(RECIPES_KEY, JSON.stringify(r)); } catch(e) { alert('Sem espaco para guardar. Tenta imagens menores.'); } }
function loadWeek()    { try { return JSON.parse(localStorage.getItem(WEEK_KEY))    || {}; } catch(e) { return {}; } }
function saveWeek(w)   { localStorage.setItem(WEEK_KEY, JSON.stringify(w)); }
function loadExtras()  { try { return JSON.parse(localStorage.getItem(EXTRAS_KEY))  || []; } catch(e) { return []; } }
function saveExtras(e) { localStorage.setItem(EXTRAS_KEY, JSON.stringify(e)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var recipes = loadRecipes();
var week    = loadWeek();
var extras  = loadExtras();

// ---- Week grid ---------------------------------------------------------------

function buildWeekGrid() {
    var grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    DAYS.forEach(function(day, idx) {
        var card = document.createElement('div');
        card.className = 'day-card';

        var nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = day;

        var select = document.createElement('select');
        select.className = 'day-select';
        select.dataset.day = idx;
        rebuildSelectOptions(select);

        var info = document.createElement('div');
        info.className = 'day-recipe-info';

        var link = document.createElement('span');
        link.className = 'day-recipe-name';
        link.dataset.day = idx;

        var clearBtn = document.createElement('button');
        clearBtn.className = 'btn-icon';
        clearBtn.textContent = 'X';
        clearBtn.title = 'Remover';
        (function(i){ clearBtn.addEventListener('click', function() {
            week[i] = null; saveWeek(week); refreshDayCard(i); renderShoppingList();
        }); })(idx);

        info.appendChild(link);
        info.appendChild(clearBtn);
        card.appendChild(nameEl);
        card.appendChild(select);
        card.appendChild(info);
        grid.appendChild(card);

        (function(i){ select.addEventListener('change', function() {
            week[i] = select.value || null; saveWeek(week); refreshDayCard(i); renderShoppingList();
        }); })(idx);

        (function(i){ link.addEventListener('click', function() {
            if (week[i] && recipes[week[i]]) openViewModal(week[i]);
        }); })(idx);

        refreshDayCard(idx);
    });
}

function rebuildSelectOptions(select) {
    var cur = select.value;
    select.innerHTML = '<option value="">-- Sem refeicao --</option>';
    Object.keys(recipes).sort(function(a,b){ return recipes[a].name.localeCompare(recipes[b].name); }).forEach(function(id) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = recipes[id].name;
        select.appendChild(opt);
    });
    select.value = cur || '';
}

function refreshAllSelects() {
    document.querySelectorAll('.day-select').forEach(function(s) {
        var idx = parseInt(s.dataset.day);
        rebuildSelectOptions(s);
        s.value = week[idx] || '';
    });
    document.querySelectorAll('.extra-recipe-select').forEach(function(s) {
        var eid = s.dataset.eid;
        var entry = extras.filter(function(e){ return e.id === eid; })[0];
        rebuildSelectOptions(s);
        if (entry) s.value = entry.rid || '';
    });
    DAYS.forEach(function(_, idx){ refreshDayCard(idx); });
}

function refreshDayCard(dayIdx) {
    var select   = document.querySelector('.day-select[data-day="' + dayIdx + '"]');
    var link     = document.querySelector('.day-recipe-name[data-day="' + dayIdx + '"]');
    var clearBtn = link ? link.nextElementSibling : null;
    var rid = week[dayIdx];
    if (rid && recipes[rid]) {
        if (select) select.value = rid;
        if (link) link.textContent = recipes[rid].name;
        if (clearBtn) clearBtn.style.display = '';
    } else {
        if (select) select.value = '';
        if (link) link.textContent = '';
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

// ---- Extra ------------------------------------------------------------------

function renderExtras() {
    var container = document.getElementById('extra-list');
    var emptyMsg  = document.getElementById('extra-empty');
    container.innerHTML = '';
    if (extras.length === 0) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    extras.forEach(function(entry) { container.appendChild(createExtraRow(entry)); });
}

function createExtraRow(entry) {
    var row = document.createElement('div');
    row.className = 'extra-row';

    var select = document.createElement('select');
    select.className = 'day-select extra-recipe-select';
    select.dataset.eid = entry.id;
    rebuildSelectOptions(select);
    select.value = entry.rid || '';
    (function(eid){ select.addEventListener('change', function() {
        var e = extras.filter(function(x){ return x.id === eid; })[0];
        if (e) { e.rid = select.value || null; saveExtras(extras); renderShoppingList(); }
    }); })(entry.id);

    var xLabel = document.createElement('span');
    xLabel.className = 'extra-x';
    xLabel.textContent = 'x';

    var timesInput = document.createElement('input');
    timesInput.type = 'number';
    timesInput.className = 'extra-times';
    timesInput.min = '1';
    timesInput.value = entry.times || 1;
    (function(eid){ timesInput.addEventListener('input', function() {
        var e = extras.filter(function(x){ return x.id === eid; })[0];
        if (e) { e.times = Math.max(1, parseInt(timesInput.value) || 1); saveExtras(extras); renderShoppingList(); }
    }); })(entry.id);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.textContent = 'X';
    delBtn.title = 'Remover';
    (function(eid){ delBtn.addEventListener('click', function() {
        extras = extras.filter(function(x){ return x.id !== eid; });
        saveExtras(extras); renderExtras(); renderShoppingList();
    }); })(entry.id);

    row.appendChild(select);
    row.appendChild(xLabel);
    row.appendChild(timesInput);
    row.appendChild(delBtn);
    return row;
}

document.getElementById('add-extra-row').addEventListener('click', function() {
    extras.push({ id: uid(), rid: null, times: 1 });
    saveExtras(extras);
    renderExtras();
});

// ---- Shopping list ----------------------------------------------------------

function renderShoppingList() {
    var list     = document.getElementById('shopping-list');
    var emptyMsg = document.getElementById('shopping-empty');
    var dlBtn    = document.getElementById('download-btn');
    var totals   = {};

    function addIngredients(recipeId, times) {
        if (!recipeId || !recipes[recipeId]) return;
        (recipes[recipeId].ingredients || []).forEach(function(ing) {
            var key = ing.name.trim().toLowerCase();
            if (!totals[key]) totals[key] = { name: ing.name.trim(), qty: 0 };
            totals[key].qty += (parseFloat(ing.qty) || 0) * times;
        });
    }

    Object.keys(week).forEach(function(d){ addIngredients(week[d], 1); });
    extras.forEach(function(e){ addIngredients(e.rid, e.times || 1); });

    var items = Object.keys(totals).sort().map(function(k){ return totals[k]; });
    list.innerHTML = '';
    list._items = items;

    if (items.length === 0) {
        emptyMsg.classList.remove('hidden');
        dlBtn.disabled = true; dlBtn.style.opacity = '.4';
        return;
    }
    emptyMsg.classList.add('hidden');
    dlBtn.disabled = false; dlBtn.style.opacity = '';

    items.forEach(function(item) {
        var li = document.createElement('li');
        li.className = 'shop-item';
        var q = Math.round(item.qty * 1000) / 1000;
        li.innerHTML = '<span class="shop-item-name">' + esc(item.name) + '</span><span class="shop-item-qty">' + q + '</span>';
        list.appendChild(li);
    });
}

document.getElementById('download-btn').addEventListener('click', function() {
    var items = document.getElementById('shopping-list')._items;
    if (!items || items.length === 0) return;
    var lines = items.map(function(item) {
        var q = Math.round(item.qty * 1000) / 1000;
        return item.name + ' ' + q;
    });
    var blob = new Blob([lines.join('\\n')], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'lista_compras.txt'; a.click();
    URL.revokeObjectURL(url);
});

// ---- Recipes grid -----------------------------------------------------------

function renderRecipesGrid() {
    var grid     = document.getElementById('recipes-grid');
    var emptyMsg = document.getElementById('recipes-empty');
    grid.innerHTML = '';
    var ids = Object.keys(recipes).sort(function(a,b){ return recipes[a].name.localeCompare(recipes[b].name); });
    if (ids.length === 0) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    ids.forEach(function(rid) {
        var r    = recipes[rid];
        var card = document.createElement('div');
        card.className = 'recipe-card';
        if (r.image) {
            var img = document.createElement('img');
            img.className = 'recipe-card-img'; img.src = r.image; img.alt = r.name;
            card.appendChild(img);
        } else {
            var ph = document.createElement('div');
            ph.className = 'recipe-card-placeholder'; ph.textContent = 'sem imagem';
            card.appendChild(ph);
        }
        var info = document.createElement('div');
        info.className = 'recipe-card-info';
        var name = document.createElement('span');
        name.className = 'recipe-card-name'; name.textContent = r.name; name.title = r.name;
        (function(id){ name.addEventListener('click', function(){ openViewModal(id); }); })(rid);
        var actions = document.createElement('div');
        actions.className = 'recipe-card-actions';
        var editBtn = document.createElement('button');
        editBtn.className = 'btn-icon'; editBtn.title = 'Editar'; editBtn.textContent = '[ed]';
        (function(id){ editBtn.addEventListener('click', function(){ openAddModal(id); }); })(rid);
        var delBtn = document.createElement('button');
        delBtn.className = 'btn-icon'; delBtn.title = 'Apagar'; delBtn.textContent = '[x]';
        (function(id){ delBtn.addEventListener('click', function(){ deleteRecipe(id); }); })(rid);
        actions.appendChild(editBtn); actions.appendChild(delBtn);
        info.appendChild(name); info.appendChild(actions);
        card.appendChild(info);
        grid.appendChild(card);
    });
}

function deleteRecipe(rid) {
    if (!recipes[rid]) return;
    if (!confirm('Apagar "' + recipes[rid].name + '"?')) return;
    Object.keys(week).forEach(function(d){ if (week[d] === rid) week[d] = null; });
    extras = extras.map(function(e){ return e.rid === rid ? Object.assign({}, e, {rid: null}) : e; });
    saveWeek(week); saveExtras(extras);
    delete recipes[rid]; saveRecipes(recipes);
    refreshAllSelects(); renderExtras(); renderShoppingList(); renderRecipesGrid();
}

// ---- Add/Edit Modal ---------------------------------------------------------

var modalOverlay = document.getElementById('modal-overlay');
var editingId    = null;
var pendingImage = null;

function openAddModal(rid) {
    editingId    = rid || null;
    pendingImage = rid ? (recipes[rid].image || null) : null;
    document.getElementById('modal-title').textContent = rid ? 'Editar Receita' : 'Nova Receita';
    document.getElementById('recipe-name-input').value = rid ? recipes[rid].name : '';
    document.getElementById('ingredients-list').innerHTML = '';
    document.getElementById('img-input').value = '';
    var imgPreview = document.getElementById('img-preview');
    var imgRemove  = document.getElementById('img-remove');
    if (pendingImage) {
        imgPreview.src = pendingImage; imgPreview.classList.remove('hidden'); imgRemove.classList.remove('hidden');
    } else {
        imgPreview.src = ''; imgPreview.classList.add('hidden'); imgRemove.classList.add('hidden');
    }
    var ings = rid ? (recipes[rid].ingredients || []) : [];
    if (ings.length > 0) { ings.forEach(function(ing){ addIngredientRow(ing.name, ing.qty); }); }
    else { addIngredientRow(); }
    modalOverlay.classList.remove('hidden');
    document.getElementById('recipe-name-input').focus();
}

function closeModal() { modalOverlay.classList.add('hidden'); editingId = null; pendingImage = null; }

function addIngredientRow(name, qty) {
    name = name || ''; qty = qty || '';
    var row = document.createElement('div');
    row.className = 'ingredient-row';
    var nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.placeholder = 'Ingrediente'; nameIn.value = name; nameIn.className = 'ing-name';
    var qtyIn = document.createElement('input');
    qtyIn.type = 'number'; qtyIn.placeholder = 'Qtd'; qtyIn.min = '0'; qtyIn.step = 'any'; qtyIn.value = qty; qtyIn.className = 'ing-qty';
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-icon'; delBtn.textContent = 'X'; delBtn.type = 'button';
    delBtn.addEventListener('click', function(){ row.remove(); });
    row.appendChild(nameIn); row.appendChild(qtyIn); row.appendChild(delBtn);
    document.getElementById('ingredients-list').appendChild(row);
}

document.getElementById('img-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
            var maxW = 600, maxH = 450, w = img.width, h = img.height;
            if (w > maxW || h > maxH) { var r = Math.min(maxW/w, maxH/h); w = Math.round(w*r); h = Math.round(h*r); }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            pendingImage = canvas.toDataURL('image/jpeg', 0.82);
            var preview = document.getElementById('img-preview');
            preview.src = pendingImage; preview.classList.remove('hidden');
            document.getElementById('img-remove').classList.remove('hidden');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('img-remove').addEventListener('click', function() {
    pendingImage = null;
    var p = document.getElementById('img-preview');
    p.src = ''; p.classList.add('hidden');
    document.getElementById('img-remove').classList.add('hidden');
    document.getElementById('img-input').value = '';
});

document.getElementById('add-ingredient-row').addEventListener('click', function(){ addIngredientRow(); });
document.getElementById('open-add-recipe').addEventListener('click', function(){ openAddModal(null); });
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function(e){ if (e.target === modalOverlay) closeModal(); });

document.getElementById('modal-save').addEventListener('click', function() {
    var nameInput = document.getElementById('recipe-name-input');
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.style.borderColor = 'red'; return; }
    nameInput.style.borderColor = '';
    var ingredients = [];
    document.getElementById('ingredients-list').querySelectorAll('.ingredient-row').forEach(function(row) {
        var n = row.querySelector('.ing-name').value.trim();
        var q = row.querySelector('.ing-qty').value.trim();
        if (n) ingredients.push({ name: n, qty: q || '0' });
    });
    var id = editingId || uid();
    recipes[id] = { name: name, ingredients: ingredients, image: pendingImage };
    saveRecipes(recipes);
    closeModal();
    refreshAllSelects(); renderShoppingList(); renderRecipesGrid();
});

// ---- View Modal -------------------------------------------------------------

var viewOverlay = document.getElementById('view-overlay');
var viewingId = null;

function openViewModal(rid) {
    viewingId = rid;
    var r = recipes[rid];
    document.getElementById('view-title').textContent = r.name;
    var body = document.getElementById('view-body');
    body.innerHTML = '';
    if (r.image) {
        var img = document.createElement('img');
        img.src = r.image; img.className = 'view-recipe-img'; img.alt = r.name;
        body.appendChild(img);
    }
    if (!r.ingredients || r.ingredients.length === 0) {
        var p = document.createElement('p');
        p.style.cssText = 'color:var(--muted);font-size:.875rem';
        p.textContent = 'Sem ingredientes.';
        body.appendChild(p);
    } else {
        var ul = document.createElement('ul');
        ul.className = 'view-ingredient-list';
        r.ingredients.forEach(function(ing) {
            var li = document.createElement('li');
            li.innerHTML = '<span>' + esc(ing.name) + '</span><span class="view-ingredient-qty">' + esc(ing.qty) + '</span>';
            ul.appendChild(li);
        });
        body.appendChild(ul);
    }
    viewOverlay.classList.remove('hidden');
}

function closeViewModal() { viewOverlay.classList.add('hidden'); viewingId = null; }

document.getElementById('view-close').addEventListener('click', closeViewModal);
document.getElementById('view-close-btn').addEventListener('click', closeViewModal);
viewOverlay.addEventListener('click', function(e){ if (e.target === viewOverlay) closeViewModal(); });
document.getElementById('view-edit').addEventListener('click', function() {
    var rid = viewingId; closeViewModal(); openAddModal(rid);
});
document.getElementById('view-delete').addEventListener('click', function() {
    var rid = viewingId; closeViewModal(); deleteRecipe(rid);
});

// ---- Init -------------------------------------------------------------------
buildWeekGrid();
renderExtras();
renderShoppingList();
renderRecipesGrid();
"""

p.joinpath('index.html').write_text(html, encoding='utf-8')
p.joinpath('style.css').write_text(css, encoding='utf-8')
p.joinpath('script.js').write_text(js, encoding='utf-8')
print('All files written OK')
print('index.html:', p.joinpath('index.html').stat().st_size, 'bytes')
print('style.css: ', p.joinpath('style.css').stat().st_size, 'bytes')
print('script.js: ', p.joinpath('script.js').stat().st_size, 'bytes')
