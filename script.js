'use strict';

var DAYS = ['Segunda','Terca','Quarta','Quinta','Sexta','Sabado','Domingo'];

// ---- Firebase ---------------------------------------------------------------

firebase.initializeApp({
    apiKey:            'AIzaSyBZeu871jiEybt8q3fam2IPVuJoq2Xhpmc',
    authDomain:        'meal-planner-eed76.firebaseapp.com',
    projectId:         'meal-planner-eed76',
    storageBucket:     'meal-planner-eed76.firebasestorage.app',
    messagingSenderId: '663930407980',
    appId:             '1:663930407980:web:b194fd8d6ad1f4b5775589'
});

var db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(function () {});

// ---- State ------------------------------------------------------------------
// recipes:     { id: { name, ingredients:[{name,qty}], icon } }
// week:        { '0': recipeId|null, ... }  (0-6 = dias semana)
// extras:      [ { id, ingId, qty } ]  — ingredientes extra semanal
// sopa:        [ { id, ingId, qty } ]  — ingredientes da sopa
// ingredients: { id: { name, canSopa, canExtra } }   — dictionary
// shoppingExtra: [ { id, name, qty } ]  manual additions
// shoppingDone:  { key: true }          hidden items
// generatedFromWeek: [ { name, qty, sources } ]  — gerado por botao "Gerar Lista"

var recipes       = {};
var week          = {};
var extras        = [];
var sopa          = [];
var ingredients   = {};
var shoppingExtra = [];
var shoppingDone  = {};
var generatedFromWeek = [];
var weekHistory = [];  // last 3 snapshots, most-recent first
var historyIdx  = 0;

var _loaded  = { recipes:false, week:false, extras:false, sopa:false, ingredients:false, shopping:false, history:false };
var appReady = false;

function _checkReady() {
    if (Object.keys(_loaded).every(function(k){ return _loaded[k]; }) && !appReady) {
        appReady = true;
        var ov = document.getElementById('loading-overlay');
        if (ov) ov.style.display = 'none';
        buildWeekGrid();
        renderExtras();
        renderSopa();
        renderShoppingList();
        renderRecipesTab();
        renderHistorico();
        // Auto-clean duplicates and fix icons silently on every load
        setTimeout(deduplicateAndFixIconsSilent, 500);
    }
}

db.collection('recipes').onSnapshot(function(snap) {
    snap.docChanges().forEach(function(ch) {
        if (ch.type === 'removed') delete recipes[ch.doc.id];
        else recipes[ch.doc.id] = ch.doc.data();
    });
    if (!_loaded.recipes) { _loaded.recipes = true; _checkReady(); return; }
    if (appReady) { refreshAllSelects(); renderRecipesGrid(); }
});

db.collection('data').doc('week').onSnapshot(function(doc) {
    week = (doc.exists && doc.data().days) ? doc.data().days : {};
    if (!_loaded.week) { _loaded.week = true; _checkReady(); return; }
    if (appReady) { refreshAllSelects(); }
});

db.collection('data').doc('extras').onSnapshot(function(doc) {
    extras = (doc.exists && doc.data().list) ? doc.data().list : [];
    if (!_loaded.extras) { _loaded.extras = true; _checkReady(); return; }
    if (appReady) { renderExtras(); }
});

db.collection('data').doc('sopa').onSnapshot(function(doc) {
    sopa = (doc.exists && doc.data().list) ? doc.data().list : [];
    if (!_loaded.sopa) { _loaded.sopa = true; _checkReady(); return; }
    if (appReady) { renderSopa(); }
});

db.collection('data').doc('ingredients').onSnapshot(function(doc) {
    ingredients = (doc.exists && doc.data().dict) ? doc.data().dict : {};
    if (!_loaded.ingredients) { _loaded.ingredients = true; _checkReady(); return; }
    if (appReady) { renderIngredientsDict(); renderExtras(); renderSopa(); }
});

db.collection('data').doc('shopping').onSnapshot(function(doc) {
    var d = doc.exists ? doc.data() : {};
    shoppingExtra     = d.extra     || [];
    shoppingDone      = d.done      || {};
    generatedFromWeek = d.generated || [];
    if (!_loaded.shopping) { _loaded.shopping = true; _checkReady(); return; }
    if (appReady) { renderShoppingList(); }
});

db.collection('data').doc('history').onSnapshot(function(doc) {
    weekHistory = (doc.exists && doc.data().items) ? doc.data().items : [];
    if (!_loaded.history) { _loaded.history = true; _checkReady(); return; }
    if (appReady) { renderHistorico(); }
});

function saveRecipe(id, data)  { db.collection('recipes').doc(id).set(data).catch(console.error); }
function deleteRecipeDb(id)    { db.collection('recipes').doc(id).delete().catch(console.error); }
function saveWeek(w)           { db.collection('data').doc('week').set({ days: w }).catch(console.error); }
function saveExtras(list)      { db.collection('data').doc('extras').set({ list: list }).catch(console.error); }
function saveSopa(list)        { db.collection('data').doc('sopa').set({ list: list }).catch(console.error); }
function saveIngredients(dict) { db.collection('data').doc('ingredients').set({ dict: dict }).catch(console.error); }
function saveShopping()        { db.collection('data').doc('shopping').set({ extra: shoppingExtra, done: shoppingDone, generated: generatedFromWeek }).catch(console.error); }
function saveHistory(h)        { db.collection('data').doc('history').set({ items: h }).catch(console.error); }

// uid() and esc() are defined in utils.js

// ---- Week grid --------------------------------------------------------------

function buildWeekGrid() {
    var grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    DAYS.forEach(function(day, idx) {
        var card = document.createElement('div');
        card.className = 'day-card';
        card.id = 'day-card-' + idx;
        var nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = day;
        card.appendChild(nameEl);
        card.appendChild(buildDaySlot(idx));
        grid.appendChild(card);
        refreshDayCard(idx);
    });
}

function buildDaySlot(dayIdx) {
    var wrap = document.createElement('div');
    wrap.className = 'meal-slot';

    var select = document.createElement('select');
    select.className = 'day-select slot-select';
    select.dataset.day = dayIdx;
    rebuildSelectOptions(select);
    select.value = week[dayIdx] || '';
    select.addEventListener('change', (function(i) { return function() {
        week[i] = select.value || null;
        saveWeek(week); refreshDayCard(i);
    }; })(dayIdx));
    wrap.appendChild(select);

    var thumb = document.createElement('span');
    thumb.className = 'slot-recipe-icon hidden';
    thumb.dataset.day = dayIdx;
    wrap.appendChild(thumb);

    var info = document.createElement('div');
    info.className = 'day-recipe-info';

    var link = document.createElement('span');
    link.className = 'day-recipe-name';
    link.dataset.day = dayIdx;
    link.addEventListener('click', (function(i) { return function() {
        var rid = week[i];
        if (rid && recipes[rid]) openViewModal(rid);
    }; })(dayIdx));

    var clearBtn = document.createElement('button');
    clearBtn.className = 'btn-icon';
    clearBtn.textContent = '\u2715';
    clearBtn.title = 'Remover';
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', (function(i) { return function() {
        week[i] = null;
        saveWeek(week); refreshDayCard(i);
    }; })(dayIdx));

    info.appendChild(link);
    info.appendChild(clearBtn);
    wrap.appendChild(info);
    return wrap;
}

function rebuildSelectOptions(select) {
    var cur = select.value;
    select.innerHTML = '<option value="">-- Nenhuma --</option>';
    Object.keys(recipes)
        .sort(function(a,b) { return recipes[a].name.localeCompare(recipes[b].name); })
        .forEach(function(id) {
            var opt = document.createElement('option');
            opt.value = id; opt.textContent = recipes[id].name;
            select.appendChild(opt);
        });
    select.value = cur || '';
}

function refreshAllSelects() {
    document.querySelectorAll('.slot-select').forEach(function(s) {
        var idx = parseInt(s.dataset.day);
        rebuildSelectOptions(s);
        s.value = week[idx] || '';
    });
    DAYS.forEach(function(_, idx) { refreshDayCard(idx); });
}

function refreshDayCard(dayIdx) {
    var rid      = week[dayIdx];
    var select   = document.querySelector('.slot-select[data-day="'+dayIdx+'"]');
    var link     = document.querySelector('.day-recipe-name[data-day="'+dayIdx+'"]');
    var clearBtn = link ? link.nextElementSibling : null;
    var thumb    = document.querySelector('.slot-recipe-icon[data-day="'+dayIdx+'"]');
    if (rid && recipes[rid]) {
        if (select) { select.value = rid; select.style.display = 'none'; }
        if (link) link.textContent = recipes[rid].name;
        if (clearBtn) clearBtn.style.display = '';
        if (thumb) { thumb.textContent = recipes[rid].icon || '\ud83c\udf7d\ufe0f'; thumb.classList.remove('hidden'); }
    } else {
        if (select) { select.value = ''; select.style.display = ''; }
        if (link) link.textContent = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (thumb) thumb.classList.add('hidden');
    }
}

// ---- Extras (ingredient-based) -----------------------------------------------

function getIngsByFlag(flag) {
    return Object.keys(ingredients)
        .filter(function(id) { return ingredients[id][flag]; })
        .sort(function(a,b) { return ingredients[a].name.localeCompare(ingredients[b].name); });
}

function buildIngSelectRow(entry, list, flag, saveList, renderFn) {
    var card = document.createElement('div');
    card.className = 'ing-slot-card';

    var ingIds = getIngsByFlag(flag);

    var select = document.createElement('select');
    select.className = 'day-select';
    select.innerHTML = '<option value="">-- Ingrediente --</option>';
    ingIds.forEach(function(id) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = ingredients[id].name;
        if (id === entry.ingId) opt.selected = true;
        select.appendChild(opt);
    });

    var qtyIn = document.createElement('input');
    qtyIn.type = 'number'; qtyIn.min = '0'; qtyIn.step = 'any';
    qtyIn.className = 'ing-slot-qty';
    qtyIn.placeholder = 'Qtd';
    qtyIn.value = entry.qty || '';

    select.addEventListener('change', (function(eid) { return function() {
        var e = list.find(function(x) { return x.id === eid; });
        if (e) { e.ingId = select.value || null; saveList(list); }
    }; })(entry.id));

    qtyIn.addEventListener('change', (function(eid) { return function() {
        var e = list.find(function(x) { return x.id === eid; });
        if (e) { e.qty = parseFloat(qtyIn.value) || 0; saveList(list); }
    }; })(entry.id));

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-icon'; delBtn.textContent = '\u2715'; delBtn.title = 'Remover';
    delBtn.addEventListener('click', (function(eid) { return function() {
        list.splice(list.findIndex(function(x) { return x.id === eid; }), 1);
        saveList(list); renderFn();
    }; })(entry.id));

    card.appendChild(select);
    card.appendChild(qtyIn);
    card.appendChild(delBtn);
    return card;
}

function renderExtras() {
    var container = document.getElementById('extra-list');
    var emptyMsg  = document.getElementById('extra-empty');
    container.innerHTML = '';
    if (!extras.length) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    extras.forEach(function(entry) {
        container.appendChild(buildIngSelectRow(entry, extras, 'canExtra', saveExtras, renderExtras));
    });
}

function renderSopa() {
    var container = document.getElementById('sopa-list');
    var emptyMsg  = document.getElementById('sopa-empty');
    container.innerHTML = '';
    if (!sopa.length) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    sopa.forEach(function(entry) {
        container.appendChild(buildIngSelectRow(entry, sopa, 'canSopa', saveSopa, renderSopa));
    });
}

document.getElementById('add-extra-row').addEventListener('click', function() {
    if (extras.length >= 10) { alert('Maximo de 10 extras atingido.'); return; }
    extras.push({ id: uid(), ingId: null, qty: 0 });
    saveExtras(extras); renderExtras();
});

document.getElementById('add-sopa-row').addEventListener('click', function() {
    if (sopa.length >= 10) { alert('Maximo de 10 ingredientes de sopa.'); return; }
    sopa.push({ id: uid(), ingId: null, qty: 0 });
    saveSopa(sopa); renderSopa();
});

// ---- Shopping list ----------------------------------------------------------

function renderShoppingList() {
    var list     = document.getElementById('shopping-list');
    var emptyMsg = document.getElementById('shopping-empty');
    var totals   = {};

    // Use ingredients generated by "Gerar Lista" button (not auto-computed from week)
    generatedFromWeek.forEach(function(item) {
        var key = item.name.trim().toLowerCase();
        if (!totals[key]) totals[key] = { name: item.name.trim(), qty: 0, sources: item.sources || [] };
        totals[key].qty += parseFloat(item.qty) || 0;
    });
    shoppingExtra.forEach(function(item) {
        var key = item.name.trim().toLowerCase();
        if (!totals[key]) totals[key] = { name: item.name.trim(), qty: 0, sources: [], extraIds: [] };
        totals[key].qty += parseFloat(item.qty) || 0;
        totals[key].extraIds = (totals[key].extraIds || []).concat(item.id);
    });

    var allItems = Object.keys(totals).sort().map(function(k) { return Object.assign({ key: k }, totals[k]); });
    list.innerHTML = '';
    list._items = allItems;

    var active = allItems.filter(function(i) { return !shoppingDone[i.key]; });
    var done   = allItems.filter(function(i) { return  shoppingDone[i.key]; });

    if (!allItems.length) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    function makeItem(item) {
        var li = document.createElement('li');
        li.className = 'shop-item' + (shoppingDone[item.key] ? ' shop-done' : '');

        var left = document.createElement('div');
        left.className = 'shop-item-left';
        var nameEl = document.createElement('span');
        nameEl.className = 'shop-item-name'; nameEl.textContent = item.name;
        left.appendChild(nameEl);

        var right = document.createElement('div');
        right.className = 'shop-item-right';
        var q = Math.round(item.qty * 1000) / 1000;
        if (listEditMode && !shoppingDone[item.key]) {
            var qInput = document.createElement('input');
            qInput.type = 'number'; qInput.min = '0'; qInput.step = 'any';
            qInput.className = 'shop-item-qty-input';
            qInput.value = q || '';
            qInput.addEventListener('change', (function(it) { return function() {
                var newQty = parseFloat(qInput.value) || 0;
                // update in generatedFromWeek
                var gIdx = generatedFromWeek.findIndex(function(g) { return g.key === it.key; });
                if (gIdx >= 0) { generatedFromWeek[gIdx].qty = newQty; saveShopping(); }
                // update in shoppingExtra
                var matched = false;
                shoppingExtra.forEach(function(e) {
                    if (e.name.trim().toLowerCase() === it.key) { e.qty = newQty; matched = true; }
                });
                if (matched) saveShopping();
            }; })(item));
            right.appendChild(qInput);
        } else if (q > 0) {
            var qEl = document.createElement('span');
            qEl.className = 'shop-item-qty'; qEl.textContent = q;
            right.appendChild(qEl);
        }
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-icon shop-toggle';
        toggleBtn.textContent = shoppingDone[item.key] ? '\u21a9' : '\u2713';
        toggleBtn.title = shoppingDone[item.key] ? 'Mostrar' : 'Marcar como comprado';
        toggleBtn.addEventListener('click', (function(key) { return function() {
            if (shoppingDone[key]) delete shoppingDone[key]; else shoppingDone[key] = true;
            saveShopping(); renderShoppingList();
        }; })(item.key));
        right.appendChild(toggleBtn);
        if (item.extraIds && item.extraIds.length) {
            var removeBtn = document.createElement('button');
            removeBtn.className = 'btn-icon';
            removeBtn.textContent = '\u2715';
            removeBtn.title = 'Remover ingrediente avulso';
            removeBtn.addEventListener('click', (function(ids) { return function() {
                shoppingExtra = shoppingExtra.filter(function(e) { return ids.indexOf(e.id) === -1; });
                saveShopping(); renderShoppingList();
            }; })(item.extraIds.slice()));
            right.appendChild(removeBtn);
        }

        li.appendChild(left); li.appendChild(right);
        return li;
    }

    active.forEach(function(item) { list.appendChild(makeItem(item)); });
    if (done.length) {
        var sep = document.createElement('li');
        sep.className = 'shop-separator'; sep.textContent = 'Ja comprado';
        list.appendChild(sep);
        done.forEach(function(item) { list.appendChild(makeItem(item)); });
    }
}

function toggleShopAdd(show) {
    document.getElementById('shopping-add-row').classList.toggle('hidden', !show);
    document.getElementById('show-shop-add-btn').classList.toggle('hidden', show);
    if (show) setTimeout(function(){ document.getElementById('shop-add-name').focus(); }, 50);
}

document.getElementById('shop-add-btn').addEventListener('click', function() {
    var nameEl = document.getElementById('shop-add-name');
    var qtyEl  = document.getElementById('shop-add-qty');
    var name   = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }
    shoppingExtra.push({ id: uid(), name: name, qty: parseFloat(qtyEl.value) || 1 });
    saveShopping(); nameEl.value = ''; qtyEl.value = '';
    toggleShopAdd(false);
    renderShoppingList();
});

document.getElementById('shop-add-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('shop-add-btn').click();
});

// ---- Edit list toggle -------------------------------------------------------

var listEditMode = false;

document.getElementById('edit-list-btn').addEventListener('click', function() {
    listEditMode = !listEditMode;
    this.classList.toggle('btn-active', listEditMode);
    this.textContent = listEditMode ? '\u2713 Editar' : '\u270E Editar';
    renderShoppingList();
});

// ---- Recipes tab ------------------------------------------------------------

function renderRecipesTab() { renderRecipesGrid(); renderIngredientsDict(); }

function renderRecipesGrid() {
    var grid     = document.getElementById('recipes-grid');
    var emptyMsg = document.getElementById('recipes-empty');
    grid.innerHTML = '';
    var ids = Object.keys(recipes).sort(function(a,b) { return recipes[a].name.localeCompare(recipes[b].name); });
    if (!ids.length) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    ids.forEach(function(rid) {
        var r = recipes[rid];
        var row = document.createElement('div');
        row.className = 'recipe-row';
        row.dataset.recipeId = rid;

        var left = document.createElement('div');
        left.className = 'recipe-row-left';
        var nameLine = document.createElement('div');
        nameLine.className = 'recipe-row-nameline';
        var iconEl = document.createElement('span');
        iconEl.className = 'recipe-icon'; iconEl.textContent = r.icon || '\ud83c\udf7d\ufe0f';
        var expandBtn = document.createElement('button');
        expandBtn.className = 'btn-icon recipe-expand-btn'; expandBtn.textContent = '\u25be'; expandBtn.title = 'Ver detalhes';
        var nameEl = document.createElement('span');
        nameEl.className = 'recipe-row-name';
        nameEl.textContent = r.name;
        nameLine.appendChild(iconEl); nameLine.appendChild(expandBtn); nameLine.appendChild(nameEl);
        left.appendChild(nameLine);
        var ingNames = (r.ingredients || []).map(function(i){ return i.name; }).join(', ');
        if (ingNames) {
            var ingEl = document.createElement('span');
            ingEl.className = 'recipe-row-ings';
            ingEl.textContent = ingNames;
            left.appendChild(ingEl);
        }
        row.appendChild(left);

        var right = document.createElement('div');
        right.className = 'recipe-row-btns';
        var editBtn = document.createElement('button');
        editBtn.className = 'btn-icon'; editBtn.title = 'Editar'; editBtn.textContent = '\u270e';
        editBtn.addEventListener('click', (function(id) { return function(e) { e.stopPropagation(); rebuildDatalist(); openAddModal(id); }; })(rid));
        var delBtn = document.createElement('button');
        delBtn.className = 'btn-icon'; delBtn.title = 'Apagar'; delBtn.textContent = '\u2715';
        delBtn.addEventListener('click', (function(id) { return function(e) { e.stopPropagation(); deleteRecipe(id); }; })(rid));
        right.appendChild(editBtn); right.appendChild(delBtn);
        row.appendChild(right);

        var detail = document.createElement('div');
        detail.className = 'recipe-row-detail hidden';
        if (r.ingredients && r.ingredients.length) {
            var ul = document.createElement('ul');
            ul.className = 'recipe-detail-ings';
            r.ingredients.forEach(function(ing) {
                var li = document.createElement('li');
                li.textContent = ing.name + (ing.qty ? ' — ' + ing.qty : '');
                ul.appendChild(li);
            });
            detail.appendChild(ul);
        }
        function toggleRecipeDetail(e) {
            if (e) e.stopPropagation();
            var open = !detail.classList.contains('hidden');
            detail.classList.toggle('hidden', open);
            expandBtn.textContent = open ? '\u25be' : '\u25b4';
        }
        expandBtn.addEventListener('click', toggleRecipeDetail);
        nameEl.addEventListener('click', toggleRecipeDetail);
        nameEl.style.cursor = 'pointer';
        row.appendChild(detail);
        grid.appendChild(row);
    });
}

function deleteRecipe(rid) {
    if (!recipes[rid]) return;
    if (!confirm('Apagar "' + recipes[rid].name + '"?')) return;
    Object.keys(week).forEach(function(d) {
        if (week[d] === rid) week[d] = null;
    });
    saveWeek(week);
    delete recipes[rid]; deleteRecipeDb(rid);
    refreshAllSelects(); renderRecipesGrid();
}

document.getElementById('clear-list-btn').addEventListener('click', function() {
    if (!confirm('Limpar a lista de compras?')) return;
    shoppingExtra = []; shoppingDone = {}; generatedFromWeek = []; saveShopping();
    renderShoppingList();
});

document.getElementById('clear-week-btn').addEventListener('click', function() {
    if (!confirm('Limpar a semana? As receitas e Extra Semanal nao sao apagados.')) return;
    // Snapshot current state before clearing
    var snapshot = {
        date: new Date().toISOString(),
        week: DAYS.map(function(day, i) {
            var rid = week[String(i)];
            if (!rid || !recipes[rid]) return { day: day, recipe: null };
            return { day: day, recipe: { name: recipes[rid].name, icon: recipes[rid].icon || '' } };
        }),
        lista: generatedFromWeek.map(function(item) { return { name: item.name, qty: item.qty }; })
    };
    weekHistory = [snapshot].concat(weekHistory).slice(0, 3);
    historyIdx = 0;
    saveHistory(weekHistory);
    renderHistorico();
    week = {}; saveWeek(week);
    sopa = []; saveSopa(sopa); renderSopa();
    refreshAllSelects();
});

// ---- Gerar Lista modal -----------------------------------------------------

var gerarOverlay   = document.getElementById('gerar-overlay');
var pendingListItems = []; // { name, qty, sources, removed }

function buildIngredientTotals() {
    var totals = {};
    function addFromRecipe(recipeId) {
        if (!recipeId || !recipes[recipeId]) return;
        var recipeName = recipes[recipeId].name;
        (recipes[recipeId].ingredients || []).forEach(function(ing) {
            var key = ing.name.trim().toLowerCase();
            if (!totals[key]) totals[key] = { name: ing.name.trim(), qty: 0, sources: [] };
            totals[key].qty += parseFloat(ing.qty) || 0;
            if (recipeName && totals[key].sources.indexOf(recipeName) === -1) totals[key].sources.push(recipeName);
        });
    }
    function addFromIngEntry(entry, label) {
        if (!entry.ingId || !ingredients[entry.ingId]) return;
        var name = ingredients[entry.ingId].name;
        var key  = name.trim().toLowerCase();
        if (!totals[key]) totals[key] = { name: name, qty: 0, sources: [] };
        totals[key].qty += parseFloat(entry.qty) || 0;
        if (label && totals[key].sources.indexOf(label) === -1) totals[key].sources.push(label);
    }
    Object.keys(week).forEach(function(d) { addFromRecipe(week[d]); });
    extras.forEach(function(e) { addFromIngEntry(e, 'Extra'); });
    sopa.forEach(function(e) { addFromIngEntry(e, 'Sopa'); });
    return Object.keys(totals).sort().map(function(k) { return Object.assign({ key: k }, totals[k]); });
}

function openGerarModal() {
    pendingListItems = buildIngredientTotals().map(function(item) {
        return { name: item.name, qty: item.qty, sources: item.sources, removed: false };
    });
    if (!pendingListItems.length) { alert('Nao ha receitas na semana para gerar a lista.'); return; }
    renderGerarModal();
    gerarOverlay.classList.remove('hidden');
}

function renderGerarModal() {
    var body = document.getElementById('gerar-body');
    body.innerHTML = '';

    pendingListItems.forEach(function(item, idx) {
        var row = document.createElement('div');
        row.className = 'gerar-ing-row' + (item.removed ? ' gerar-ing-removed' : '');
        row.dataset.idx = idx;

        var left = document.createElement('div');
        left.className = 'gerar-ing-left';

        var nameEl = document.createElement('span');
        nameEl.className = 'gerar-ing-name';
        nameEl.textContent = item.name;
        left.appendChild(nameEl);

        if (item.sources && item.sources.length) {
            var srcEl = document.createElement('span');
            srcEl.className = 'gerar-ing-sources';
            srcEl.textContent = item.sources.join(', ');
            left.appendChild(srcEl);
        }
        row.appendChild(left);

        var right = document.createElement('div');
        right.className = 'gerar-ing-right';

        if (!item.removed) {
            var qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.className = 'gerar-ing-qty';
            qtyInput.value = Math.round(item.qty * 1000) / 1000 || '';
            qtyInput.min = '0'; qtyInput.step = 'any';
            qtyInput.addEventListener('change', (function(i) { return function() {
                pendingListItems[i].qty = parseFloat(qtyInput.value) || 0;
            }; })(idx));
            right.appendChild(qtyInput);
        }

        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-icon gerar-toggle';
        toggleBtn.title = item.removed ? 'Adicionar de volta' : 'Ja tenho — remover';
        toggleBtn.textContent = item.removed ? '\u21a9' : '\u2715';
        toggleBtn.addEventListener('click', (function(i) { return function() {
            pendingListItems[i].removed = !pendingListItems[i].removed;
            renderGerarModal();
        }; })(idx));
        right.appendChild(toggleBtn);
        row.appendChild(right);

        body.appendChild(row);
    });
}

document.getElementById('gerar-lista-btn').addEventListener('click', openGerarModal);
document.getElementById('gerar-close').addEventListener('click', function() { gerarOverlay.classList.add('hidden'); });
document.getElementById('gerar-cancel').addEventListener('click', function() { gerarOverlay.classList.add('hidden'); });
gerarOverlay.addEventListener('click', function(e) { if (e.target === gerarOverlay) gerarOverlay.classList.add('hidden'); });

document.getElementById('gerar-aprovar').addEventListener('click', function() {
    generatedFromWeek = pendingListItems
        .filter(function(item) { return !item.removed; })
        .map(function(item) { return { name: item.name, qty: item.qty, sources: item.sources, key: item.name.trim().toLowerCase() }; });
    saveShopping();
    renderShoppingList();
    gerarOverlay.classList.add('hidden');
    // Switch to Lista tab
    document.querySelector('.tab-btn[data-tab="lista"]').click();
});

// ---- History (Histórico) --------------------------------------------------

function renderHistorico() {
    var el = document.getElementById('subtab-historico');
    if (!el) return;
    el.innerHTML = '';

    if (!weekHistory.length) {
        var emptyP = document.createElement('p');
        emptyP.className = 'empty-msg';
        emptyP.textContent = 'Sem hist\u00f3rico ainda. Limpa a semana para criar um registo.';
        el.appendChild(emptyP);
        return;
    }

    if (historyIdx >= weekHistory.length) historyIdx = 0;
    var entry = weekHistory[historyIdx];

    // Navigation bar
    var nav = document.createElement('div');
    nav.className = 'hist-nav';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'btn-icon hist-nav-btn';
    prevBtn.textContent = '\u2039'; // ‹
    prevBtn.title = 'Mais antigo';
    prevBtn.disabled = historyIdx >= weekHistory.length - 1;
    prevBtn.addEventListener('click', function() { historyIdx++; renderHistorico(); });

    var lbl = document.createElement('span');
    lbl.className = 'hist-nav-label';
    var d = new Date(entry.date);
    var dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    lbl.textContent = (historyIdx + 1) + ' / ' + weekHistory.length + ' \u2014 ' + dateStr;

    var nextBtn = document.createElement('button');
    nextBtn.className = 'btn-icon hist-nav-btn';
    nextBtn.textContent = '\u203a'; // ›
    nextBtn.title = 'Mais recente';
    nextBtn.disabled = historyIdx <= 0;
    nextBtn.addEventListener('click', function() { historyIdx--; renderHistorico(); });

    nav.appendChild(prevBtn);
    nav.appendChild(lbl);
    nav.appendChild(nextBtn);
    el.appendChild(nav);

    // Week grid
    var weekHdr = document.createElement('h4');
    weekHdr.className = 'hist-section-title';
    weekHdr.textContent = 'Semana';
    el.appendChild(weekHdr);

    var weekGrid = document.createElement('div');
    weekGrid.className = 'hist-week-grid';
    (entry.week || []).forEach(function(slot) {
        var card = document.createElement('div');
        card.className = 'hist-day-card' + (slot.recipe ? '' : ' hist-day-empty');
        var dayLbl = document.createElement('span');
        dayLbl.className = 'hist-day-label';
        dayLbl.textContent = slot.day;
        card.appendChild(dayLbl);
        if (slot.recipe) {
            if (slot.recipe.icon) {
                var ic = document.createElement('span');
                ic.className = 'hist-recipe-icon';
                ic.textContent = slot.recipe.icon;
                card.appendChild(ic);
            }
            var nm = document.createElement('span');
            nm.className = 'hist-recipe-name';
            nm.textContent = slot.recipe.name;
            card.appendChild(nm);
        } else {
            var none = document.createElement('span');
            none.className = 'hist-day-none';
            none.textContent = '\u2014';
            card.appendChild(none);
        }
        weekGrid.appendChild(card);
    });
    el.appendChild(weekGrid);

    // Ingredients list
    var listaHdr = document.createElement('h4');
    listaHdr.className = 'hist-section-title';
    listaHdr.textContent = 'Lista de Ingredientes';
    el.appendChild(listaHdr);

    if (entry.lista && entry.lista.length) {
        var ul = document.createElement('ul');
        ul.className = 'hist-lista';
        entry.lista.forEach(function(item) {
            var li = document.createElement('li');
            li.className = 'hist-lista-item';
            var ns = document.createElement('span'); ns.textContent = item.name;
            var qs = document.createElement('span'); qs.className = 'hist-lista-qty';
            qs.textContent = item.qty || '';
            li.appendChild(ns); li.appendChild(qs);
            ul.appendChild(li);
        });
        el.appendChild(ul);
    } else {
        var noList = document.createElement('p');
        noList.className = 'empty-msg';
        noList.textContent = 'Sem lista de ingredientes registada.';
        el.appendChild(noList);
    }
}

// ---- Ingredients dictionary -------------------------------------------------

function getRecipesUsingIngredient(ingName) {
    return Object.keys(recipes).filter(function(rid) {
        return (recipes[rid].ingredients || []).some(function(i) {
            return i.name.toLowerCase() === ingName.toLowerCase();
        });
    }).map(function(rid) { return recipes[rid].name; });
}

function renderIngredientsDict() {
    var list     = document.getElementById('ing-dict-list');
    var emptyMsg = document.getElementById('ing-dict-empty');
    list.innerHTML = '';
    var ids = Object.keys(ingredients).sort(function(a,b) { return ingredients[a].name.localeCompare(ingredients[b].name); });
    if (!ids.length) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    ids.forEach(function(id) {
        var row = buildIngDictRow(id);
        list.appendChild(row);
    });
}

function buildIngDictRow(id) {
    var row = document.createElement('div');
    row.className = 'ing-dict-row';
    row.dataset.ingId = id;

    var usedIn = getRecipesUsingIngredient(ingredients[id].name);

    var left = document.createElement('div');
    left.className = 'ing-dict-row-left';
    var nameEl = document.createElement('span');
    nameEl.className = 'ing-dict-name';
    nameEl.textContent = ingredients[id].name;
    left.appendChild(nameEl);
    if (usedIn.length) {
        var usageEl = document.createElement('span');
        usageEl.className = 'ing-dict-usage';
        usageEl.textContent = usedIn.join(', ');
        left.appendChild(usageEl);
    }

    row.appendChild(left);

    // Checkboxes for canSopa / canExtra — placed in fixed columns matching the header
    [['canSopa', 'Sopa'], ['canExtra', 'Extra']].forEach(function(pair) {
        var flag = pair[0];
        var cell = document.createElement('div');
        cell.className = 'ing-dict-flag-cell';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!ingredients[id][flag];
        cb.addEventListener('change', (function(iid, f, c) { return function() {
            ingredients[iid][f] = c.checked;
            saveIngredients(ingredients);
            renderExtras(); renderSopa();
        }; })(id, flag, cb));
        cell.appendChild(cb);
        row.appendChild(cell);
    });

    var btns = document.createElement('div');
    btns.className = 'ing-dict-row-btns';

    var editBtn = document.createElement('button');
    editBtn.className = 'btn-icon'; editBtn.textContent = '\u270e'; editBtn.title = 'Editar';
    editBtn.addEventListener('click', (function(iid) { return function() {
        var rowEl = document.querySelector('[data-ing-id="' + iid + '"]');
        if (!rowEl) return;
        var list_ = rowEl.parentElement;
        var editRow = buildIngEditRow(iid);
        list_.replaceChild(editRow, rowEl);
    }; })(id));
    btns.appendChild(editBtn);

    row.appendChild(btns);
    return row;
}

function buildIngEditRow(id) {
    var row = document.createElement('div');
    row.className = 'ing-dict-row ing-dict-row-editing';
    row.dataset.ingId = id;

    var usedIn = getRecipesUsingIngredient(ingredients[id].name);

    // Name input spanning flag columns
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ing-dict-input';
    input.value = ingredients[id].name;
    row.appendChild(input);

    // Usage info (shown inside edit row, spanning cols)
    var usageWrap = document.createElement('div');
    usageWrap.className = 'ing-edit-usage-wrap';
    if (usedIn.length) {
        var usageLbl = document.createElement('span');
        usageLbl.className = 'ing-edit-usage';
        usageLbl.textContent = '\ud83c\udf7d\ufe0f ' + usedIn.join(', ');
        usageWrap.appendChild(usageLbl);
    }
    row.appendChild(usageWrap);

    // Buttons
    var btns = document.createElement('div');
    btns.className = 'ing-edit-btns';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary btn-small'; saveBtn.textContent = '\u2713'; saveBtn.title = 'Guardar';
    saveBtn.addEventListener('click', function() {
        var newName = input.value.trim();
        if (!newName) { input.focus(); return; }
        var conflict = Object.keys(ingredients).find(function(oid) {
            return oid !== id && ingredients[oid].name.toLowerCase() === newName.toLowerCase();
        });
        if (conflict) { alert('Ja existe um ingrediente com esse nome.'); input.focus(); return; }
        var oldName = ingredients[id].name;
        ingredients[id].name = newName;
        Object.keys(recipes).forEach(function(rid) {
            var changed = false;
            (recipes[rid].ingredients || []).forEach(function(ing) {
                if (ing.name.toLowerCase() === oldName.toLowerCase()) { ing.name = newName; changed = true; }
            });
            if (changed) saveRecipe(rid, recipes[rid]);
        });
        saveIngredients(ingredients);
        renderIngredientsDict();
    });
    btns.appendChild(saveBtn);

    if (!usedIn.length) {
        var delBtn = document.createElement('button');
        delBtn.className = 'btn-icon'; delBtn.textContent = '\u1f5d1'; delBtn.title = 'Remover ingrediente';
        // use soft-danger style inline
        delBtn.style.cssText = 'color:var(--red);border:1px solid var(--red);opacity:.7;border-radius:4px;padding:.15rem .4rem;font-size:.85rem';
        delBtn.textContent = '\u2715';
        delBtn.addEventListener('click', function() {
            if (!confirm('Remover "' + ingredients[id].name + '" do dicionario?')) return;
            delete ingredients[id]; saveIngredients(ingredients); renderIngredientsDict();
        });
        btns.appendChild(delBtn);
    }

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-icon'; cancelBtn.textContent = '\u2715'; cancelBtn.title = 'Cancelar';
    cancelBtn.addEventListener('click', function() { renderIngredientsDict(); });
    btns.appendChild(cancelBtn);

    row.appendChild(btns);
    setTimeout(function() { input.focus(); input.select(); }, 0);
    return row;
}

function toggleIngAdd(show) {
    document.getElementById('ing-dict-add-row').classList.toggle('hidden', !show);
    document.getElementById('show-ing-add-btn').classList.toggle('hidden', show);
    if (show) setTimeout(function(){ document.getElementById('ing-dict-input').focus(); }, 50);
    if (!show) document.getElementById('ing-dict-input').value = '';
}

document.getElementById('ing-dict-add-btn').addEventListener('click', function() { addIngredientToDict(); });
document.getElementById('ing-dict-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') addIngredientToDict(); });

function addIngredientToDict(nameOverride) {
    var input = document.getElementById('ing-dict-input');
    var name  = (nameOverride !== undefined ? nameOverride : input.value).trim();
    if (!name) { if (!nameOverride) input.focus(); return null; }
    var existing = Object.keys(ingredients).find(function(id) {
        return ingredients[id].name.toLowerCase() === name.toLowerCase();
    });
    if (existing) { if (!nameOverride) input.value = ''; return existing; }
    var id = uid();
    ingredients[id] = { name: name };
    saveIngredients(ingredients); renderIngredientsDict();
    if (!nameOverride) toggleIngAdd(false);
    return id;
}

// ---- Add/Edit Recipe Modal --------------------------------------------------

var modalOverlay = document.getElementById('modal-overlay');
var editingId    = null;
// DEFAULT_ICONS is defined in utils.js
var pendingIcon  = DEFAULT_ICONS[0];

function renderIconPicker(selected) {
    var picker = document.getElementById('icon-picker');
    picker.innerHTML = '';
    DEFAULT_ICONS.forEach(function(ic) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-option' + (ic === selected ? ' selected' : '');
        btn.textContent = ic;
        btn.addEventListener('click', function() {
            pendingIcon = ic;
            picker.querySelectorAll('.icon-option').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            document.getElementById('icon-custom-input').value = '';
        });
        picker.appendChild(btn);
    });
}

function openAddModal(rid) {
    editingId   = rid || null;
    pendingIcon = rid ? (recipes[rid].icon || DEFAULT_ICONS[0]) : DEFAULT_ICONS[0];
    document.getElementById('modal-title').textContent = rid ? 'Editar Receita' : 'Nova Receita';
    var delBtn = document.getElementById('modal-delete');
    delBtn.classList.toggle('hidden', !rid);
    delBtn.dataset.rid = rid || '';
    document.getElementById('recipe-name-input').value = rid ? recipes[rid].name : '';
    document.getElementById('ingredients-list').innerHTML = '';
    renderIconPicker(pendingIcon);
    document.getElementById('icon-custom-input').value = DEFAULT_ICONS.indexOf(pendingIcon) === -1 ? pendingIcon : '';
    var ings = rid ? (recipes[rid].ingredients || []) : [];
    if (ings.length) ings.forEach(function(ing) { addIngredientRow(ing.name, ing.qty); });
    else addIngredientRow();
    modalOverlay.classList.remove('hidden');
    document.getElementById('recipe-name-input').focus();
}

function closeModal() { modalOverlay.classList.add('hidden'); editingId = null; pendingIcon = DEFAULT_ICONS[0]; }

function getSortedIngredientNames() {
    return Object.keys(ingredients)
        .map(function(id) { return ingredients[id].name; })
        .sort(function(a,b) { return a.localeCompare(b); });
}

function addIngredientRow(name, qty) {
    name = name || ''; qty = qty || '';
    var row = document.createElement('div');
    row.className = 'ingredient-row';

    var nameWrap = document.createElement('div');
    nameWrap.className = 'ing-name-wrap';

    var nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.placeholder = 'Ingrediente'; nameIn.value = name;
    nameIn.className = 'ing-name'; nameIn.setAttribute('list', 'ing-datalist');

    var addDictBtn = document.createElement('button');
    addDictBtn.type = 'button'; addDictBtn.className = 'btn-icon ing-add-dict';
    addDictBtn.title = 'Adicionar ao dicionario'; addDictBtn.textContent = '+';
    addDictBtn.addEventListener('click', function() {
        var v = nameIn.value.trim(); if (!v) { nameIn.focus(); return; }
        addIngredientToDict(v); rebuildDatalist();
    });

    nameWrap.appendChild(nameIn); nameWrap.appendChild(addDictBtn);

    var qtyIn = document.createElement('input');
    qtyIn.type = 'number'; qtyIn.placeholder = 'Qtd'; qtyIn.min = '0'; qtyIn.step = 'any';
    qtyIn.value = qty; qtyIn.className = 'ing-qty';

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-icon'; delBtn.textContent = 'X'; delBtn.type = 'button';
    delBtn.addEventListener('click', function() { row.remove(); });

    row.appendChild(nameWrap); row.appendChild(qtyIn); row.appendChild(delBtn);
    document.getElementById('ingredients-list').appendChild(row);
}

function rebuildDatalist() {
    var dl = document.getElementById('ing-datalist');
    dl.innerHTML = '';
    getSortedIngredientNames().forEach(function(n) {
        var opt = document.createElement('option'); opt.value = n; dl.appendChild(opt);
    });
}

document.getElementById('icon-custom-input').addEventListener('input', function() {
    var v = this.value.trim();
    if (v) {
        pendingIcon = v;
        document.getElementById('icon-picker').querySelectorAll('.icon-option').forEach(function(b) { b.classList.remove('selected'); });
    }
});

document.getElementById('add-ingredient-row').addEventListener('click', function() { rebuildDatalist(); addIngredientRow(); });
document.getElementById('open-add-recipe').addEventListener('click', function() { rebuildDatalist(); openAddModal(null); });
document.getElementById('dedup-btn').addEventListener('click', deduplicateAndFixIcons);
document.getElementById('modal-delete').addEventListener('click', function() {
    var rid = this.dataset.rid;
    if (!rid) return;
    closeModal();
    deleteRecipe(rid);
});
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeModal(); });

document.getElementById('modal-save').addEventListener('click', function() {
    var nameInput = document.getElementById('recipe-name-input');
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.style.borderColor='red'; return; }
    nameInput.style.borderColor='';
    var ings = []; var valid = true;
    document.getElementById('ingredients-list').querySelectorAll('.ingredient-row').forEach(function(row) {
        var n = row.querySelector('.ing-name').value.trim();
        var q = row.querySelector('.ing-qty').value.trim();
        if (!n) return;
        var inDict = Object.keys(ingredients).some(function(id) {
            return ingredients[id].name.toLowerCase() === n.toLowerCase();
        });
        if (!inDict) {
            valid = false;
            row.querySelector('.ing-name').style.borderColor = 'red';
            row.querySelector('.ing-name').title = '"'+n+'" nao existe no dicionario. Usa o botao + para adicionar.';
        } else {
            row.querySelector('.ing-name').style.borderColor = '';
            ings.push({ name: n, qty: q || '1' });
        }
    });
    if (!valid) { alert('Alguns ingredientes nao existem no dicionario. Adiciona-os com o botao +.'); return; }
    var id = editingId || uid();
    recipes[id] = { name: name, ingredients: ings, icon: pendingIcon || DEFAULT_ICONS[0] };
    saveRecipe(id, recipes[id]);
    closeModal(); refreshAllSelects(); renderRecipesGrid();
});

// ---- View Modal -------------------------------------------------------------

var viewOverlay = document.getElementById('view-overlay');
var viewingId   = null;

function openViewModal(rid) {
    viewingId = rid;
    var r = recipes[rid];
    document.getElementById('view-title').textContent = r.name;
    var badge = document.getElementById('view-type-badge');
    badge.textContent = '';
    badge.className = '';
    var body = document.getElementById('view-body');
    body.innerHTML = '';
    var iconBig = document.createElement('span');
    iconBig.className = 'view-recipe-icon'; iconBig.textContent = r.icon || '\ud83c\udf7d\ufe0f';
    body.appendChild(iconBig);
    if (!r.ingredients || !r.ingredients.length) {
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
viewOverlay.addEventListener('click', function(e) { if (e.target === viewOverlay) closeViewModal(); });
document.getElementById('view-edit').addEventListener('click', function() {
    var rid = viewingId; closeViewModal(); rebuildDatalist(); openAddModal(rid);
});
document.getElementById('view-delete').addEventListener('click', function() {
    var rid = viewingId; closeViewModal(); deleteRecipe(rid);
});

// ---- Subtabs within Receitas tab -------------------------------------------

(function() {
    var subtabs = ['receitas-grid', 'ingredientes-dict', 'historico', 'import-json'];
    function switchSubtab(name) {
        document.querySelectorAll('.subtab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.subtab === name);
        });
        subtabs.forEach(function(id) {
            var el = document.getElementById('subtab-' + id);
            if (el) el.classList.toggle('hidden', id !== name);
        });
        if (name === 'historico') { historyIdx = 0; renderHistorico(); }
    }
    document.querySelectorAll('.subtab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchSubtab(btn.dataset.subtab); });
    });
    switchSubtab('receitas-grid');
})();

// ---- Export -----------------------------------------------------------------

// ---- Export -----------------------------------------------------------------

function exportData() {
    var data = {
        ingredients: Object.keys(ingredients)
            .sort(function(a,b){ return ingredients[a].name.localeCompare(ingredients[b].name); })
            .map(function(id){ return ingredients[id].name; }),
        recipes: Object.keys(recipes)
            .sort(function(a,b){ return recipes[a].name.localeCompare(recipes[b].name); })
            .map(function(id){
                return {
                    name: recipes[id].name,
                    type: recipes[id].type || 'main',
                    ingredients: (recipes[id].ingredients || []).map(function(i){
                        return { name: i.name, qty: i.qty };
                    })
                };
            })
    };
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = 'receitas-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('export-btn').addEventListener('click', exportData);

// ---- Import JSON ------------------------------------------------------------

document.getElementById('import-file-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        e.target.value = '';
        var data;
        try { data = JSON.parse(ev.target.result); } catch(err) { alert('Ficheiro JSON invalido: ' + err.message); return; }
        openImportModal(data);
    };
    reader.readAsText(file);
});

var importOverlay  = document.getElementById('import-overlay');
var importData     = null; // { ingredients: [{name, isNew, mappedTo}], recipes: [{...}] }

function openImportModal(raw) {
    // Parse raw JSON into importData
    var rawIngs     = Array.isArray(raw.ingredients) ? raw.ingredients.filter(function(n){ return typeof n === 'string' && n.trim(); }) : [];
    var rawRecipes  = Array.isArray(raw.recipes)     ? raw.recipes : [];

    // Build import state
    importData = {
        ingredients: rawIngs.map(function(n) {
            var name = n.trim();
            var existId = Object.keys(ingredients).find(function(id){ return ingredients[id].name.toLowerCase() === name.toLowerCase(); });
            return { name: name, isNew: !existId, mappedTo: existId || null, deleted: false };
        }),
        recipes: rawRecipes.map(function(r) {
            return {
                name:  (r.name  || '').trim(),
                type:  (r.type === 'side' ? 'side' : 'main'),
                ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(function(i){
                    return { name: (i.name||'').trim(), qty: String(i.qty||'0'), deleted: false };
                }) : [],
                deleted: false
            };
        }).filter(function(r){ return r.name; })
    };

    renderImportModal();
    importOverlay.classList.remove('hidden');
}

function renderImportModal() {
    var body = document.getElementById('import-body');
    body.innerHTML = '';

    // --- Section: Ingredientes ---
    var ings = importData.ingredients.filter(function(i){ return !i.deleted; });
    if (ings.length) {
        var h = document.createElement('h4');
        h.className = 'import-section-title';
        h.textContent = 'Ingredientes (' + ings.length + ')';
        body.appendChild(h);

        ings.forEach(function(item, idx) {
            var row = document.createElement('div');
            row.className = 'import-ing-row' + (item.isNew ? ' import-new' : '');

            var left = document.createElement('div');
            left.className = 'import-ing-left';

            if (item.isNew) {
                var warn = document.createElement('span');
                warn.className = 'import-warn'; warn.textContent = '\u2605 NOVO ';
                left.appendChild(warn);
            }

            var nameEl = document.createElement('span');
            nameEl.className = 'import-ing-name'; nameEl.textContent = item.name;
            left.appendChild(nameEl);

            // if new: show dropdown to map to existing
            if (item.isNew) {
                var mapSel = document.createElement('select');
                mapSel.className = 'import-map-select';
                var optKeep = document.createElement('option');
                optKeep.value = ''; optKeep.textContent = 'Adicionar como novo';
                mapSel.appendChild(optKeep);
                Object.keys(ingredients)
                    .sort(function(a,b){ return ingredients[a].name.localeCompare(ingredients[b].name); })
                    .forEach(function(id) {
                        var opt = document.createElement('option');
                        opt.value = id; opt.textContent = ingredients[id].name;
                        mapSel.appendChild(opt);
                    });
                mapSel.value = item.mappedTo || '';
                mapSel.addEventListener('change', (function(i){ return function() {
                    importData.ingredients[i].mappedTo = mapSel.value || null;
                    importData.ingredients[i].isNew    = !mapSel.value;
                    renderImportModal();
                }; })(importData.ingredients.indexOf(item)));
                left.appendChild(mapSel);
            }

            row.appendChild(left);

            var delBtn = document.createElement('button');
            delBtn.className = 'btn-icon'; delBtn.textContent = '\u2715'; delBtn.title = 'Remover desta importacao';
            delBtn.addEventListener('click', (function(i){ return function() {
                importData.ingredients[i].deleted = true;
                renderImportModal();
            }; })(importData.ingredients.indexOf(item)));
            row.appendChild(delBtn);
            body.appendChild(row);
        });
    }

    // --- Section: Receitas ---
    var recs = importData.recipes.filter(function(r){ return !r.deleted; });
    if (recs.length) {
        var h2 = document.createElement('h4');
        h2.className = 'import-section-title';
        h2.textContent = 'Receitas (' + recs.length + ')';
        body.appendChild(h2);

        recs.forEach(function(rec) {
            var recIdx = importData.recipes.indexOf(rec);
            var card = document.createElement('div');
            card.className = 'import-recipe-card';

            var cardHeader = document.createElement('div');
            cardHeader.className = 'import-recipe-header';

            var nameInput = document.createElement('input');
            nameInput.type = 'text'; nameInput.className = 'import-recipe-name';
            nameInput.value = rec.name;
            nameInput.addEventListener('input', function(){ importData.recipes[recIdx].name = nameInput.value; });

            var typeSel = document.createElement('select');
            typeSel.className = 'import-recipe-type';
            ['main','side'].forEach(function(t) {
                var opt = document.createElement('option');
                opt.value = t; opt.textContent = t === 'main' ? 'Principal' : 'Secundaria';
                typeSel.appendChild(opt);
            });
            typeSel.value = rec.type;
            typeSel.addEventListener('change', function(){ importData.recipes[recIdx].type = typeSel.value; });

            var delRecBtn = document.createElement('button');
            delRecBtn.className = 'btn-icon'; delRecBtn.textContent = '\u2715'; delRecBtn.title = 'Remover receita';
            delRecBtn.addEventListener('click', function() { importData.recipes[recIdx].deleted = true; renderImportModal(); });

            cardHeader.appendChild(nameInput); cardHeader.appendChild(typeSel); cardHeader.appendChild(delRecBtn);
            card.appendChild(cardHeader);

            // ingredients of recipe
            var ingList = document.createElement('ul');
            ingList.className = 'import-recipe-ings';
            (rec.ingredients || []).filter(function(i){ return !i.deleted; }).forEach(function(ing) {
                var ingIdx = rec.ingredients.indexOf(ing);
                // find if ingredient is known
                var known = Object.keys(ingredients).some(function(id){ return ingredients[id].name.toLowerCase() === ing.name.toLowerCase(); })
                    || importData.ingredients.some(function(ii){ return !ii.deleted && (ii.mappedTo ? ingredients[ii.mappedTo] && ingredients[ii.mappedTo].name.toLowerCase() === ing.name.toLowerCase() : ii.name.toLowerCase() === ing.name.toLowerCase()); });
                var li = document.createElement('li');
                li.className = known ? '' : 'import-ing-unknown';
                li.innerHTML = '<span>' + esc(ing.name) + (known ? '' : ' <span class="import-warn">?</span>') + '</span><span class="import-ing-qty">x' + esc(ing.qty) + '</span>';
                var delIngBtn = document.createElement('button');
                delIngBtn.className = 'btn-icon'; delIngBtn.textContent = '\u2715';
                delIngBtn.addEventListener('click', function() { importData.recipes[recIdx].ingredients[ingIdx].deleted = true; renderImportModal(); });
                li.appendChild(delIngBtn);
                ingList.appendChild(li);
            });
            card.appendChild(ingList);
            body.appendChild(card);
        });
    }

    if (!ings.length && !recs.length) {
        var empty = document.createElement('p');
        empty.className = 'empty-msg'; empty.textContent = 'Nada para importar.';
        body.appendChild(empty);
    }
}

function closeImportModal() { importOverlay.classList.add('hidden'); importData = null; }
document.getElementById('import-close').addEventListener('click', closeImportModal);
document.getElementById('import-cancel').addEventListener('click', closeImportModal);
importOverlay.addEventListener('click', function(e){ if(e.target===importOverlay) closeImportModal(); });

document.getElementById('import-confirm').addEventListener('click', function() {
    if (!importData) return;
    var count = { ing: 0, rec: 0 };

    // 1. Ingredients
    importData.ingredients.filter(function(i){ return !i.deleted; }).forEach(function(item) {
        if (item.mappedTo) return; // maps to existing, no new entry
        var exists = Object.keys(ingredients).find(function(id){ return ingredients[id].name.toLowerCase() === item.name.toLowerCase(); });
        if (!exists) { ingredients[uid()] = { name: item.name }; count.ing++; }
    });
    if (count.ing) saveIngredients(ingredients);

    // Build lookup: name.lower -> id (after adding new ones)
    function getIngId(name) {
        // check mappings first
        var mapped = importData.ingredients.find(function(i){ return i.name.toLowerCase() === name.toLowerCase() && i.mappedTo; });
        if (mapped) return mapped.mappedTo;
        return Object.keys(ingredients).find(function(id){ return ingredients[id].name.toLowerCase() === name.toLowerCase(); }) || null;
    }

    // 2. Recipes
    importData.recipes.filter(function(r){ return !r.deleted && r.name; }).forEach(function(rec) {
        var ings = (rec.ingredients||[]).filter(function(i){ return !i.deleted && i.name; }).map(function(i) {
            return { name: i.name, qty: i.qty };
        });
        var id = uid();
        recipes[id] = { name: rec.name, type: rec.type, ingredients: ings, icon: DEFAULT_ICONS[0] };
        saveRecipe(id, recipes[id]); count.rec++;
    });

    closeImportModal();
    renderIngredientsDict();
    refreshAllSelects(); renderRecipesGrid();
    alert('Importado: ' + count.rec + ' receita(s), ' + count.ing + ' ingrediente(s) novo(s).');
});

// ---- Mobile tab navigation --------------------------------------------------

(function() {
    var TAB_SECTIONS = {
        lista:    ['section-lista'],
        semana:   ['section-semana', 'section-extra', 'section-sopa'],
        receitas: ['section-receitas']
    };
    var ALL = ['section-lista','section-semana','section-extra','section-sopa','section-receitas'];

    function switchTab(name) {
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === name);
        });
        ALL.forEach(function(id) { document.getElementById(id).classList.remove('tab-active'); });
        (TAB_SECTIONS[name] || []).forEach(function(id) { document.getElementById(id).classList.add('tab-active'); });
        var bar = document.getElementById('week-action-bar');
        if (bar) bar.style.display = (name === 'lista' || name === 'semana') ? '' : 'none';
    }

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });

    switchTab('lista');
})();

// ---- Auto-icon & Deduplication ----------------------------------------------

// autoAssignIcon() is defined in utils.js

function _runDedup(silent) {
    // --- Step 1: Deduplicate ---
    var byName = {};
    Object.keys(recipes).forEach(function(id) {
        var key = (recipes[id].name || '').toLowerCase().trim();
        if (!byName[key]) byName[key] = [];
        byName[key].push(id);
    });

    var toDelete = [];
    Object.keys(byName).forEach(function(key) {
        var ids = byName[key];
        if (ids.length <= 1) return;
        // Prefer the one whose icon is NOT the bare default
        ids.sort(function(a, b) {
            var aDefault = (recipes[a].icon === DEFAULT_ICONS[0] || !recipes[a].icon);
            var bDefault = (recipes[b].icon === DEFAULT_ICONS[0] || !recipes[b].icon);
            if (aDefault && !bDefault) return 1;
            if (!aDefault && bDefault) return -1;
            return 0;
        });
        for (var i = 1; i < ids.length; i++) {
            var keepId = ids[0];
            var delId  = ids[i];
            Object.keys(week).forEach(function(d) {
                if (week[d] === delId) week[d] = keepId;
            });
            delete recipes[delId];
            deleteRecipeDb(delId);
            toDelete.push(delId);
        }
    });

    if (toDelete.length) saveWeek(week);

    // --- Step 2: Auto-assign icons ---
    var iconCount = 0;
    Object.keys(recipes).forEach(function(id) {
        var newIcon = autoAssignIcon(recipes[id].name, recipes[id].ingredients);
        if (newIcon !== recipes[id].icon) {
            recipes[id].icon = newIcon;
            saveRecipe(id, recipes[id]);
            iconCount++;
        }
    });

    refreshAllSelects();
    renderRecipesGrid();

    if (!silent) {
        var msg = '';
        if (toDelete.length) msg += toDelete.length + ' duplicada(s) removida(s). ';
        else msg += 'Sem duplicatas encontradas. ';
        msg += iconCount + ' ícone(s) atualizados.';
        alert(msg);
    }
}

function deduplicateAndFixIcons() { _runDedup(false); }
function deduplicateAndFixIconsSilent() { _runDedup(true); }

// ---- Init (triggered by Firestore via _checkReady) --------------------------
