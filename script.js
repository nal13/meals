'use strict';

var DAYS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

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
// recipes:     { id: { name, ingredients:[{ingId,qty}], icon } }
// week:        { '0': recipeId|null, ... }  (0-6 = dias semana)
// ingredients: { id: { name, categoria } }   — dictionary
// shoppingExtra: [ { id, name, qty } ]  manual additions
// shoppingDone:  { key: true }          hidden items
// generatedFromWeek: [ { name, qty, sources } ]  — gerado por botao "Gerar Lista"

var recipes       = {};
var week          = {};
var ingredients   = {};
var shoppingExtra = [];
var shoppingDone  = {};
var generatedFromWeek = [];
var weekExtras        = []; // { id, ingId, name } — extras added in Semana tab, included on Gerar Lista
var weekTempRecipes   = {}; // { tempId: { name, icon, ingredients:[{ingId?,name?,qty}] } }
var weekCarried       = {}; // { dayIdx: recipeId } — carried over from last week (ingredients probably at home)
var weekHistory = [];  // last 20 snapshots, most-recent first
var historyIdx  = 0;
var pendingPickerDay = null;
var pendingNewRecipeDay = null;
var pendingNewRecipeName = '';
var _pickerFilter    = 'all';
var _pickerQuery     = '';
var _pickerDebounce  = null;
var _pickerShowArchive = false;
var _armedRecipe     = null; // quicklist: recipe chosen, waiting for a day

var TIER_LABELS = {
    habitual: '\u2b50 Habituais',
    asvezes:  '\ud83d\udd04 \u00c0s vezes',
    arquivo:  '\ud83d\uddc4\ufe0f Arquivo'
};

function getRecipeStats() {
    return computeRecipeStats(recipes, weekHistory, Date.now());
}

var _loaded  = { recipes:false, week:false, ingredients:false, shopping:false, history:false };
var appReady = false;

function _checkReady() {
    if (Object.keys(_loaded).every(function(k){ return _loaded[k]; }) && !appReady) {
        appReady = true;
        var ov = document.getElementById('loading-overlay');
        if (ov) ov.style.display = 'none';
        migrateIngredientsToIngId();
        autoCategorizeIngredients();
        buildWeekGrid();
        renderQuicklist();
        renderShoppingList();
        updateHouseholdBanner();
        renderSemanaExtrasList();
        renderRecipesTab();
        renderHistorico();
        switchTab(pickStartTab(getPendingShoppingCount()));
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
    if (appReady) { refreshAllSelects(); renderRecipesGrid(); renderQuicklist(); }
});

db.collection('data').doc('week').onSnapshot(function(doc) {
    week        = (doc.exists && doc.data().days)   ? doc.data().days   : {};
    weekExtras  = (doc.exists && doc.data().extras) ? doc.data().extras : [];
    weekTempRecipes = (doc.exists && doc.data().tempRecipes) ? doc.data().tempRecipes : {};
    weekCarried = (doc.exists && doc.data().carried) ? doc.data().carried : {};
    if (!_loaded.week) { _loaded.week = true; _checkReady(); return; }
    if (appReady) { refreshAllSelects(); renderSemanaExtrasList(); renderQuicklist(); }
});

db.collection('data').doc('ingredients').onSnapshot(function(doc) {
    ingredients = (doc.exists && doc.data().dict) ? doc.data().dict : {};
    if (!_loaded.ingredients) { _loaded.ingredients = true; _checkReady(); return; }
    if (appReady) { renderIngredientsDict(); updateHouseholdBanner(); }
});

db.collection('data').doc('shopping').onSnapshot(function(doc) {
    var d = doc.exists ? doc.data() : {};
    shoppingExtra     = d.extra     || [];
    shoppingDone      = d.done      || {};
    generatedFromWeek = d.generated || [];
    if (!_loaded.shopping) { _loaded.shopping = true; _checkReady(); return; }
    if (appReady) { renderShoppingList(); updateHouseholdBanner(); }
});

db.collection('data').doc('history').onSnapshot(function(doc) {
    weekHistory = (doc.exists && doc.data().items) ? doc.data().items : [];
    if (!_loaded.history) { _loaded.history = true; _checkReady(); return; }
    if (appReady) { renderHistorico(); renderRecipesGrid(); renderQuicklist(); }
});

function saveRecipe(id, data)  { db.collection('recipes').doc(id).set(data).catch(console.error); }
function deleteRecipeDb(id)    { db.collection('recipes').doc(id).delete().catch(console.error); }
function isTempRecipeId(rid) {
    return typeof rid === 'string' && rid.indexOf('tmp:') === 0;
}

function pruneWeekTempRecipes(days) {
    var used = {};
    Object.keys(days || {}).forEach(function(d) {
        var rid = days[d];
        if (isTempRecipeId(rid)) used[rid] = true;
    });
    Object.keys(weekTempRecipes).forEach(function(rid) {
        if (!used[rid]) delete weekTempRecipes[rid];
    });
}

function saveWeek(w) {
    pruneWeekTempRecipes(w || {});
    Object.keys(weekCarried).forEach(function(d) { if ((w || {})[d] !== weekCarried[d]) delete weekCarried[d]; });
    db.collection('data').doc('week').set({ days: w, extras: weekExtras, tempRecipes: weekTempRecipes, carried: weekCarried }).catch(console.error);
}
function saveIngredients(dict) { db.collection('data').doc('ingredients').set({ dict: dict }).catch(console.error); }
function saveShopping()        { db.collection('data').doc('shopping').set({ extra: shoppingExtra, done: shoppingDone, generated: generatedFromWeek }).catch(console.error); }
function saveHistory(h)        { db.collection('data').doc('history').set({ items: h }).catch(console.error); }

function getWeekRecipeById(rid) {
    if (!rid) return null;
    if (recipes[rid]) {
        return {
            id: rid,
            isTemp: false,
            name: recipes[rid].name,
            icon: recipes[rid].icon,
            ingredients: recipes[rid].ingredients || []
        };
    }
    if (isTempRecipeId(rid) && weekTempRecipes[rid]) {
        return {
            id: rid,
            isTemp: true,
            name: weekTempRecipes[rid].name,
            icon: weekTempRecipes[rid].icon,
            ingredients: weekTempRecipes[rid].ingredients || []
        };
    }
    return null;
}

function createTempRecipeId() {
    var id;
    do {
        id = 'tmp:' + uid();
    } while (weekTempRecipes[id]);
    return id;
}

// uid() and esc() are defined in utils.js

// ---- Toast (non-blocking feedback + undo) -----------------------------------

var _toastTimer = null;

// opts: { type: 'error'|'success', actionLabel, onAction, duration }
function showToast(msg, opts) {
    var o = opts || {};
    var el = document.getElementById('toast');
    var msgEl = document.getElementById('toast-msg');
    var actionBtn = document.getElementById('toast-action');
    if (!el) return;
    msgEl.textContent = msg;
    el.className = 'toast' + (o.type ? ' toast-' + o.type : '');
    if (o.onAction) {
        actionBtn.textContent = o.actionLabel || 'Desfazer';
        actionBtn.classList.remove('hidden');
        actionBtn.onclick = function() {
            hideToast();
            o.onAction();
        };
    } else {
        actionBtn.classList.add('hidden');
        actionBtn.onclick = null;
    }
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(hideToast, o.duration || (o.onAction ? 6000 : 3500));
}

function hideToast() {
    var el = document.getElementById('toast');
    if (el) el.classList.add('hidden');
    clearTimeout(_toastTimer);
}

function showUndoToast(msg, undoFn) {
    showToast(msg, { actionLabel: 'Desfazer', onAction: undoFn });
}

// ---- Sync status ------------------------------------------------------------

(function() {
    function update() {
        var el = document.getElementById('sync-status');
        if (!el) return;
        var online = navigator.onLine;
        el.textContent = online ? '\u25cf Sincronizado' : '\u25cf Offline';
        el.classList.toggle('is-offline', !online);
        el.title = online ? 'Alterações sincronizadas entre dispositivos' : 'Sem ligação — as alterações sincronizam quando voltar a ligação';
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
})();

// ---- Week grid --------------------------------------------------------------

function buildWeekGrid() {
    var grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    var todayIdx = weekdayIndex();
    DAYS.forEach(function(day, idx) {
        var card = document.createElement('div');
        card.className = 'day-card' + (idx === todayIdx ? ' day-today' : '');
        card.id = 'day-card-' + idx;
        var nameEl = document.createElement('div');
        nameEl.className = 'day-name';
        nameEl.textContent = day;
        if (idx === todayIdx) {
            var todayTag = document.createElement('span');
            todayTag.className = 'day-today-tag';
            todayTag.textContent = 'Hoje';
            nameEl.appendChild(todayTag);
        }
        card.appendChild(nameEl);
        card.appendChild(buildDaySlot(idx));
        // Quicklist: when a recipe is armed, tapping anywhere on a day assigns it.
        card.addEventListener('click', (function(i) { return function(e) {
            if (!_armedRecipe) return;
            e.stopPropagation(); e.preventDefault();
            assignArmedRecipe(i);
        }; })(idx), true);
        grid.appendChild(card);
        refreshDayCard(idx);
    });
    updateWeekSummary();
}

function updateWeekSummary() {
    var meals  = countPlannedMeals(week);
    var extras = weekExtras.length;
    var summary = document.getElementById('week-summary');
    if (summary) {
        summary.textContent = meals
            ? plural(meals, 'refeição planeada', 'refeições planeadas')
            : 'Nenhuma refeição planeada';
    }
    var cta = document.getElementById('gerar-lista-btn');
    if (cta) {
        var parts = [];
        if (meals)  parts.push(plural(meals, 'refeição', 'refeições'));
        if (extras) parts.push(plural(extras, 'extra', 'extras'));
        cta.textContent = '\ud83d\uded2 Gerar lista' + (parts.length ? ' \u00b7 ' + parts.join(' + ') : '');
        cta.disabled = !meals && !extras;
    }
}

// ---- Quicklist (habituais) -----------------------------------------------------

function getQuicklistIds(stats) {
    var ids = Object.keys(recipes).filter(function(id) { return stats[id] && stats[id].tier === 'habitual'; });
    ids.sort(function(a, b) { return stats[b].countRecent - stats[a].countRecent || recipes[a].name.localeCompare(recipes[b].name); });
    if (ids.length < 4) {
        // Not enough history yet: top up with the most cooked non-archived recipes.
        var extra = Object.keys(recipes).filter(function(id) {
            return ids.indexOf(id) === -1 && stats[id] && stats[id].count > 0 && stats[id].tier !== 'arquivo';
        });
        extra.sort(function(a, b) { return stats[b].count - stats[a].count; });
        ids = ids.concat(extra.slice(0, 8 - ids.length));
    }
    return ids.slice(0, 12);
}

function renderQuicklist() {
    var wrap = document.getElementById('quicklist');
    if (!wrap) return;
    wrap.innerHTML = '';
    var stats = getRecipeStats();
    var ids = getQuicklistIds(stats);
    var inWeek = {};
    Object.keys(week).forEach(function(d) { if (week[d]) inWeek[week[d]] = true; });

    var head = document.createElement('div');
    head.className = 'quicklist-head';
    var title = document.createElement('span');
    title.className = 'quicklist-title';
    if (_armedRecipe && recipes[_armedRecipe]) {
        title.textContent = '\ud83d\udc47 Toca no dia para ' + recipes[_armedRecipe].name;
        title.classList.add('quicklist-armed-msg');
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'quicklist-link';
        cancel.textContent = 'Cancelar';
        cancel.addEventListener('click', function() { disarmRecipe(); });
        head.appendChild(title);
        head.appendChild(cancel);
    } else {
        title.textContent = ids.length ? '\u26a1 Toque r\u00e1pido \u00b7 escolhe um prato e depois o dia' : '\u26a1 Toque r\u00e1pido';
        head.appendChild(title);
    }
    wrap.appendChild(head);

    var chips = document.createElement('div');
    chips.className = 'quicklist-chips';
    ids.forEach(function(id) {
        var r = recipes[id];
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-chip quick-chip' + (_armedRecipe === id ? ' active' : '') + (inWeek[id] ? ' quick-chip-inweek' : '');
        chip.textContent = (r.icon || '\ud83c\udf7d\ufe0f') + ' ' + r.name + (inWeek[id] ? ' \u2713' : '');
        chip.title = stats[id] ? 'Feita ' + stats[id].count + '\u00d7 \u00b7 \u00faltima vez ' + timeAgoLabel(stats[id].lastCooked) : '';
        chip.addEventListener('click', function() {
            if (_armedRecipe === id) { disarmRecipe(); return; }
            _armedRecipe = id;
            document.body.classList.add('quick-armed');
            renderQuicklist();
        });
        chips.appendChild(chip);
    });

    var last = weekHistory[0];
    var lastHasRecipes = !!last && (last.week || []).some(function(s) { return matchHistoryRecipe(s.recipe, recipes); });
    if (lastHasRecipes) {
        var rep = document.createElement('button');
        rep.type = 'button';
        rep.className = 'filter-chip quick-chip quick-chip-action';
        rep.textContent = '\u21a9\ufe0f Repetir semana passada';
        rep.addEventListener('click', repeatLastWeek);
        chips.appendChild(rep);
    }
    if (!ids.length && !lastHasRecipes) {
        var hint = document.createElement('p');
        hint.className = 'quicklist-hint';
        hint.textContent = 'Os pratos que fazem mais aparecem aqui depois de registarem algumas semanas.';
        wrap.appendChild(hint);
        return;
    }
    wrap.appendChild(chips);
}

function disarmRecipe() {
    _armedRecipe = null;
    document.body.classList.remove('quick-armed');
    renderQuicklist();
}

function assignArmedRecipe(dayIdx) {
    var rid = _armedRecipe;
    if (!rid || !recipes[rid]) { disarmRecipe(); return; }
    var prev = week[dayIdx] || null;
    var prevTemp = isTempRecipeId(prev) && weekTempRecipes[prev] ? weekTempRecipes[prev] : null;
    week[dayIdx] = rid;
    saveWeek(week);
    refreshDayCard(dayIdx);
    disarmRecipe();
    showUndoToast(recipes[rid].name + ' \u2192 ' + DAYS[dayIdx], function() {
        if (prevTemp) weekTempRecipes[prev] = prevTemp;
        week[dayIdx] = prev;
        saveWeek(week); refreshDayCard(dayIdx); renderQuicklist();
    });
}

function repeatLastWeek() {
    var last = weekHistory[0];
    if (!last) return;
    var snap = Object.assign({}, week);
    var filled = 0;
    (last.week || []).forEach(function(slot, i) {
        var rid = matchHistoryRecipe(slot.recipe, recipes);
        if (rid && !week[String(i)]) { week[String(i)] = rid; filled++; }
    });
    if (!filled) { showToast('Os dias da semana passada j\u00e1 est\u00e3o preenchidos.'); return; }
    saveWeek(week);
    refreshAllSelects();
    renderQuicklist();
    showUndoToast(plural(filled, 'dia preenchido', 'dias preenchidos') + ' com a semana passada', function() {
        week = snap; saveWeek(week); refreshAllSelects(); renderQuicklist();
    });
}

function buildDaySlot(dayIdx) {
    var wrap = document.createElement('div');
    wrap.className = 'meal-slot';

    var chooseBtn = document.createElement('button');
    chooseBtn.className = 'btn-choose-recipe';
    chooseBtn.dataset.day = dayIdx;
    chooseBtn.textContent = '+ Escolher refeição';
    chooseBtn.addEventListener('click', (function(i) { return function() {
        openPicker(i);
    }; })(dayIdx));
    wrap.appendChild(chooseBtn);

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
        if (rid && getWeekRecipeById(rid)) openViewModal(rid);
    }; })(dayIdx));

    var clearBtn = document.createElement('button');
    clearBtn.className = 'btn-icon';
    clearBtn.textContent = '\u2715';
    clearBtn.title = 'Remover';
    clearBtn.setAttribute('aria-label', 'Remover refeição');
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', (function(i) { return function() {
        var prev = week[i];
        var prevTemp = isTempRecipeId(prev) && weekTempRecipes[prev] ? weekTempRecipes[prev] : null;
        var prevRecipe = getWeekRecipeById(prev);
        week[i] = null;
        saveWeek(week); refreshDayCard(i); updateWeekSummary(); renderQuicklist();
        showUndoToast((prevRecipe ? prevRecipe.name : 'Refeição') + ' removida de ' + DAYS[i], function() {
            if (prevTemp) weekTempRecipes[prev] = prevTemp;
            week[i] = prev;
            saveWeek(week); refreshDayCard(i); updateWeekSummary(); renderQuicklist();
        });
    }; })(dayIdx));

    info.appendChild(link);
    info.appendChild(clearBtn);
    wrap.appendChild(info);
    return wrap;
}

function refreshAllSelects() {
    DAYS.forEach(function(_, idx) { refreshDayCard(idx); });
    updateWeekSummary();
    renderQuicklist();
}

function refreshDayCard(dayIdx) {
    var rid       = week[dayIdx];
    var recipe    = getWeekRecipeById(rid);
    var chooseBtn = document.querySelector('.btn-choose-recipe[data-day="'+dayIdx+'"]');
    var link      = document.querySelector('.day-recipe-name[data-day="'+dayIdx+'"]');
    var clearBtn  = link ? link.nextElementSibling : null;
    var thumb     = document.querySelector('.slot-recipe-icon[data-day="'+dayIdx+'"]');
    var card      = document.getElementById('day-card-' + dayIdx);
    if (card) card.classList.toggle('day-filled', !!(rid && recipe));
    if (card) card.classList.toggle('day-carried', !!rid && weekCarried[dayIdx] === rid);
    if (rid && recipe) {
        if (chooseBtn) chooseBtn.style.display = 'none';
        if (link) link.textContent = recipe.name;
        if (clearBtn) clearBtn.style.display = '';
        if (thumb) { thumb.textContent = recipe.icon || '\ud83c\udf7d\ufe0f'; thumb.classList.remove('hidden'); }
    } else {
        if (chooseBtn) chooseBtn.style.display = '';
        if (link) link.textContent = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (thumb) thumb.classList.add('hidden');
    }
    updateWeekSummary();
}

// ---- Recipe Picker ----------------------------------------------------------

function openPicker(dayIdx) {
    pendingPickerDay = dayIdx;
    _pickerFilter = 'all';
    _pickerQuery  = '';
    _pickerShowArchive = false;
    document.getElementById('picker-title').textContent = 'Escolher \u2014 ' + DAYS[dayIdx];
    document.getElementById('picker-search').value = '';
    document.querySelectorAll('#picker-filters .filter-chip').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    renderPickerGrid('all', '');
    document.getElementById('picker-overlay').classList.remove('hidden');
}

function closePicker() {
    document.getElementById('picker-overlay').classList.add('hidden');
    pendingPickerDay = null;
}

function openNewRecipeFromPicker() {
    var dayToFill = pendingPickerDay;
    pendingNewRecipeDay = dayToFill;
    pendingNewRecipeName = (_pickerQuery || '').trim();
    closePicker();
    openAddModal(null);
}

function appendCreateRecipeCard(grid) {
    var card = document.createElement('div');
    card.className = 'recipe-card';
    card.title = 'Criar nova receita';
    card.addEventListener('click', openNewRecipeFromPicker);

    var icon = document.createElement('span');
    icon.className = 'recipe-card-icon';
    icon.textContent = '+';

    var name = document.createElement('span');
    name.className = 'recipe-card-name';
    name.textContent = 'Nova Receita';

    card.appendChild(icon);
    card.appendChild(name);
    grid.appendChild(card);
}

function renderPickerGrid(filter, query) {
    var grid = document.getElementById('picker-grid');
    var q = (query || '').trim().toLowerCase();
    var ids = Object.keys(recipes).filter(function(id) {
        var r = recipes[id];
        if (!r) return false;
        if (filter !== 'all') {
            var type;
            if (r.foodType && r.foodType !== 'auto') {
                type = r.foodType;
            } else {
                var ingNames = (r.ingredients || []).map(function(ing) {
                    return ingredients[ing.ingId] ? ingredients[ing.ingId].name : (ing.name || '');
                });
                type = getRecipeFoodType(r.name, ingNames);
            }
            if (type !== filter) return false;
        }
        if (q && r.name.toLowerCase().indexOf(q) === -1) return false;
        return true;
    });
    ids.sort(function(a, b) { return recipes[a].name.localeCompare(recipes[b].name); });
    grid.innerHTML = '';
    appendCreateRecipeCard(grid);
    if (ids.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'picker-empty';
        empty.textContent = 'Sem receitas nesta categoria';
        grid.appendChild(empty);
        return;
    }
    function appendCard(id) {
        var r = recipes[id];
        var card = document.createElement('div');
        card.className = 'recipe-card';
        card.addEventListener('click', (function(rid) { return function() {
            if (pendingPickerDay === null) return;
            week[pendingPickerDay] = rid;
            saveWeek(week);
            refreshDayCard(pendingPickerDay);
            closePicker();
            renderQuicklist();
        }; })(id));
        var icon = document.createElement('span');
        icon.className = 'recipe-card-icon';
        icon.textContent = r.icon || '\ud83c\udf7d\ufe0f';
        var name = document.createElement('span');
        name.className = 'recipe-card-name';
        name.textContent = r.name;
        card.appendChild(icon);
        card.appendChild(name);
        grid.appendChild(card);
    }
    function appendSection(label) {
        var h = document.createElement('div');
        h.className = 'picker-section';
        h.textContent = label;
        grid.appendChild(h);
    }
    // While searching, show everything (archive included) in one list.
    if (q) { ids.forEach(appendCard); return; }

    var stats = getRecipeStats();
    var byTier = { habitual: [], asvezes: [], arquivo: [] };
    ids.forEach(function(id) { byTier[(stats[id] && stats[id].tier) || 'asvezes'].push(id); });
    byTier.habitual.sort(function(a, b) { return stats[b].countRecent - stats[a].countRecent || recipes[a].name.localeCompare(recipes[b].name); });
    if (byTier.habitual.length) { appendSection(TIER_LABELS.habitual); byTier.habitual.forEach(appendCard); }
    if (byTier.asvezes.length)  { appendSection(TIER_LABELS.asvezes);  byTier.asvezes.forEach(appendCard); }
    if (byTier.arquivo.length) {
        if (_pickerShowArchive) {
            appendSection(TIER_LABELS.arquivo);
            byTier.arquivo.forEach(appendCard);
        } else {
            var more = document.createElement('button');
            more.type = 'button';
            more.className = 'picker-archive-btn';
            more.textContent = '\ud83d\uddc4\ufe0f Ver arquivo (' + byTier.arquivo.length + ')';
            more.addEventListener('click', function() {
                _pickerShowArchive = true;
                renderPickerGrid(_pickerFilter, _pickerQuery);
            });
            grid.appendChild(more);
        }
    }
}

document.getElementById('picker-close').addEventListener('click', closePicker);
document.getElementById('picker-overlay').addEventListener('click', function(e) {
    if (e.target === this) closePicker();
});
document.getElementById('picker-search').addEventListener('input', function() {
    _pickerQuery = this.value;
    clearTimeout(_pickerDebounce);
    var q = _pickerQuery;
    _pickerDebounce = setTimeout(function() { renderPickerGrid(_pickerFilter, q); }, 200);
});
document.getElementById('picker-filters').addEventListener('click', function(e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    _pickerFilter = chip.dataset.filter;
    document.querySelectorAll('#picker-filters .filter-chip').forEach(function(btn) {
        btn.classList.toggle('active', btn === chip);
    });
    renderPickerGrid(_pickerFilter, _pickerQuery);
});

// ---- Ingredient helpers ----------------------------------------------------

function getIngName(ingId) {
    return ingredients[ingId] ? ingredients[ingId].name : '';
}

function getIngCategoria(ingId) {
    return (ingredients[ingId] && ingredients[ingId].categoria) ? ingredients[ingId].categoria : 'Outros';
}

function getIngByName(name) {
    var key = (name || '').trim().toLowerCase();
    if (!key) return null;
    return Object.keys(ingredients).find(function(iid) {
        return ingredients[iid].name.toLowerCase() === key ||
               (ingredients[iid].nameEn || '').toLowerCase() === key;
    }) || null;
}

function getIngCategoriaByName(name) {
    var id = getIngByName(name);
    if (id && ingredients[id].categoria) return ingredients[id].categoria;
    return autoAssignCategoria((name || '').trim()) || 'Outros';
}

function getCatIcon(ingId, ingName) {
    var cat = ingId ? getIngCategoria(ingId) : getIngCategoriaByName(ingName || '');
    return CATEGORIA_ICONS[cat] || CATEGORIA_ICONS['Outros'];
}

function resolveIngNames(ings) {
    return (ings || []).map(function(i) {
        return { name: getIngName(i.ingId) || (i.name || ''), qty: i.qty };
    });
}

// ---- Shopping list ----------------------------------------------------------

function renderShoppingList() {
    var list     = document.getElementById('shopping-list');
    var emptyMsg = document.getElementById('shopping-empty');
    var totals   = {};

    // Use ingredients generated by "Gerar Lista" button (not auto-computed from week)
    generatedFromWeek.forEach(function(item) {
        var key = item.name.trim().toLowerCase();
        if (!totals[key]) totals[key] = { name: item.name.trim(), qty: 0, sources: item.sources || [], ingId: item.ingId || null };
        totals[key].qty += parseFloat(item.qty) || 0;
    });
    shoppingExtra.forEach(function(item) {
        var key = item.name.trim().toLowerCase();
        if (!totals[key]) totals[key] = { name: item.name.trim(), qty: 0, sources: [], extraIds: [], ingId: item.ingId || null };
        totals[key].qty += parseFloat(item.qty) || 0;
        totals[key].extraIds = (totals[key].extraIds || []).concat(item.id);
    });

    var allItems = Object.keys(totals).sort().map(function(k) { return Object.assign({ key: k }, totals[k]); });
    list.innerHTML = '';
    list._items = allItems;

    var active = allItems.filter(function(i) { return !shoppingDone[i.key]; });
    var done   = allItems.filter(function(i) { return  shoppingDone[i.key]; });

    updateShoppingProgress(active.length, allItems.length);
    if (typeof householdOverlay !== 'undefined') updateHouseholdBanner();

    if (!allItems.length) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    function updateItemQty(item, newQty) {
        var gIdx = generatedFromWeek.findIndex(function(g) { return g.key === item.key; });
        if (gIdx >= 0) { generatedFromWeek[gIdx].qty = newQty; }
        shoppingExtra.forEach(function(e) {
            if (e.name.trim().toLowerCase() === item.key) e.qty = newQty;
        });
        saveShopping();
    }

    function removeItem(item) {
        var snapGen   = generatedFromWeek.slice();
        var snapExtra = shoppingExtra.slice();
        var wasDone   = !!shoppingDone[item.key];
        generatedFromWeek = generatedFromWeek.filter(function(g) { return g.key !== item.key; });
        if (item.extraIds && item.extraIds.length) {
            shoppingExtra = shoppingExtra.filter(function(e) { return item.extraIds.indexOf(e.id) === -1; });
        }
        if (shoppingDone[item.key]) delete shoppingDone[item.key];
        saveShopping(); renderShoppingList();
        showUndoToast(item.name + ' removido da lista', function() {
            generatedFromWeek = snapGen; shoppingExtra = snapExtra;
            if (wasDone) shoppingDone[item.key] = true;
            saveShopping(); renderShoppingList();
        });
    }

    function toggleDone(key) {
        var it = allItems.filter(function(i) { return i.key === key; })[0];
        if (shoppingDone[key]) { delete shoppingDone[key]; if (it) onShoppingItemUnbought(it); }
        else { shoppingDone[key] = true; if (it) onShoppingItemBought(it); }
        saveShopping(); renderShoppingList();
    }

    function makeItem(item) {
        var li = document.createElement('li');
        li.className = 'shop-item' + (shoppingDone[item.key] ? ' shop-done' : '');
        if (!listEditMode) {
            li.classList.add('shop-item-tappable');
            li.addEventListener('click', function(e) {
                if (e.target.closest('button')) return;
                toggleDone(item.key);
            });
        }

        var left = document.createElement('div');
        left.className = 'shop-item-left';
        var nameLine = document.createElement('div');
        nameLine.className = 'ing-name-line';
        var iconEl = document.createElement('span');
        iconEl.className = 'ing-cat-badge';
        iconEl.textContent = getCatIcon(item.ingId, item.name);
        iconEl.title = item.ingId ? getIngCategoria(item.ingId) : getIngCategoriaByName(item.name);
        var nameEl = document.createElement('span');
        nameEl.className = 'shop-item-name'; nameEl.textContent = item.name;
        nameLine.appendChild(iconEl);
        nameLine.appendChild(nameEl);
        left.appendChild(nameLine);
        if (item.sources && item.sources.length) {
            var srcEl = document.createElement('span');
            srcEl.className = 'shop-item-sources';
            srcEl.textContent = item.sources.join(', ');
            left.appendChild(srcEl);
        }

        var right = document.createElement('div');
        right.className = 'shop-item-right';
        var q = Math.round(item.qty * 1000) / 1000;

        if (listEditMode) {
            if (!shoppingDone[item.key]) {
                // Stepper − qty + only for active items while editing.
                var currentQty = q || 1;
                var stepper = document.createElement('div');
                stepper.className = 'shop-stepper';
                var minusBtn = document.createElement('button');
                minusBtn.className = 'stepper-btn'; minusBtn.textContent = '\u2212';
                var qtySpan = document.createElement('span');
                qtySpan.className = 'stepper-val'; qtySpan.textContent = currentQty;
                var plusBtn = document.createElement('button');
                plusBtn.className = 'stepper-btn'; plusBtn.textContent = '+';
                minusBtn.addEventListener('click', function() {
                    if (currentQty > 0) { currentQty = Math.round((currentQty - 1) * 1000) / 1000; qtySpan.textContent = currentQty; updateItemQty(item, currentQty); }
                });
                plusBtn.addEventListener('click', function() {
                    currentQty = Math.round((currentQty + 1) * 1000) / 1000; qtySpan.textContent = currentQty; updateItemQty(item, currentQty);
                });
                stepper.appendChild(minusBtn); stepper.appendChild(qtySpan); stepper.appendChild(plusBtn);
                right.appendChild(stepper);
            } else if (q > 0) {
                var doneQtyEl = document.createElement('span');
                doneQtyEl.className = 'shop-item-qty'; doneQtyEl.textContent = q;
                right.appendChild(doneQtyEl);
            }

            var editRemoveBtn = document.createElement('button');
            editRemoveBtn.className = 'btn-icon shop-remove';
            editRemoveBtn.textContent = '\u2715';
            editRemoveBtn.title = 'Remover';
            editRemoveBtn.addEventListener('click', function() { removeItem(item); });
            right.appendChild(editRemoveBtn);
        } else {
            if (q > 0) {
                var qEl = document.createElement('span');
                qEl.className = 'shop-item-qty'; qEl.textContent = q;
                right.appendChild(qEl);
            }

            if (!shoppingDone[item.key]) {
                // Single action in normal mode for active items: mark as bought.
                var doneBtn = document.createElement('button');
                doneBtn.className = 'btn-icon shop-toggle';
                doneBtn.textContent = '\u2713';
                doneBtn.title = 'Marcar como comprado';
                doneBtn.addEventListener('click', function() { toggleDone(item.key); });
                right.appendChild(doneBtn);
            } else {
                // Bought items can only be moved back to active list.
                var undoBtn = document.createElement('button');
                undoBtn.className = 'btn-icon shop-toggle';
                undoBtn.textContent = '\u21a9';
                undoBtn.title = 'Voltar para a lista';
                undoBtn.addEventListener('click', function() { toggleDone(item.key); });
                right.appendChild(undoBtn);
            }
        }

        li.appendChild(left); li.appendChild(right);
        return li;
    }

    var activeByCategory = {};
    CATEGORIAS.forEach(function(cat) { activeByCategory[cat] = []; });
    active.forEach(function(item) {
        var cat = item.ingId ? getIngCategoria(item.ingId) : getIngCategoriaByName(item.name);
        if (!activeByCategory[cat]) cat = 'Outros';
        activeByCategory[cat].push(item);
    });
    CATEGORIAS.forEach(function(cat) {
        var catItems = activeByCategory[cat];
        if (!catItems.length) return;
        var header = document.createElement('li');
        header.className = 'shop-cat-header';
        header.textContent = (CATEGORIA_ICONS[cat] ? CATEGORIA_ICONS[cat] + ' ' : '') + cat + ' \u00b7 ' + catItems.length;
        list.appendChild(header);
        catItems.forEach(function(item) { list.appendChild(makeItem(item)); });
    });
    if (done.length) {
        var sep = document.createElement('li');
        sep.className = 'shop-separator'; sep.textContent = '\u2714 J\u00e1 comprado \u00b7 ' + done.length;
        list.appendChild(sep);
        done.forEach(function(item) { list.appendChild(makeItem(item)); });
    }
}

function updateShoppingProgress(remaining, total) {
    var wrap  = document.getElementById('shopping-progress');
    var text  = document.getElementById('shopping-progress-text');
    var fill  = document.getElementById('shopping-progress-fill');
    var badge = document.getElementById('lista-badge');
    var bought = total - remaining;
    if (wrap) wrap.classList.toggle('hidden', !total);
    if (text) {
        text.textContent = !remaining && total
            ? '\ud83c\udf89 Tudo comprado! (' + total + ')'
            : bought + ' de ' + total + ' comprados \u00b7 ' + plural(remaining, 'falta', 'faltam');
    }
    if (fill) fill.style.width = (total ? Math.round(bought / total * 100) : 0) + '%';
    if (badge) {
        badge.textContent = remaining > 99 ? '99+' : String(remaining);
        badge.classList.toggle('hidden', !remaining);
    }
    ['edit-list-btn', 'clear-list-btn'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !total);
    });
}

function getPendingShoppingCount() {
    var keys = {};
    generatedFromWeek.forEach(function(i) { keys[i.name.trim().toLowerCase()] = true; });
    shoppingExtra.forEach(function(i) { keys[i.name.trim().toLowerCase()] = true; });
    return Object.keys(keys).filter(function(k) { return !shoppingDone[k]; }).length;
}

// ---- Household items (artigos de casa) ---------------------------------------

function isHouseholdIng(id) {
    var ing = ingredients[id];
    if (!ing) return false;
    if (ing.recurring && ing.recurring.off) return false;
    return ing.categoria === 'Casa e Higiene' || !!ing.recurring;
}

function getHouseholdIds() {
    var now = Date.now();
    return Object.keys(ingredients).filter(isHouseholdIng).sort(function(a, b) {
        var da = recurringDaysLeft(ingredients[a].recurring, now);
        var dbl = recurringDaysLeft(ingredients[b].recurring, now);
        if (da !== dbl) return da - dbl;
        return ingredients[a].name.localeCompare(ingredients[b].name);
    });
}

function getPendingShoppingKeys() {
    var keys = {};
    generatedFromWeek.forEach(function(i) { keys[i.name.trim().toLowerCase()] = true; });
    shoppingExtra.forEach(function(i) { keys[i.name.trim().toLowerCase()] = true; });
    return Object.keys(keys).filter(function(k) { return !shoppingDone[k]; });
}

function isOnShoppingList(id) {
    return getPendingShoppingKeys().indexOf(ingredients[id].name.trim().toLowerCase()) !== -1;
}

function getDueHouseholdIds() {
    var now = Date.now();
    return getHouseholdIds().filter(function(id) {
        return isRecurringDue(ingredients[id].recurring, now) && !isOnShoppingList(id);
    });
}

var _recurringBeforeBuy = {}; // key -> previous recurring, so un-ticking an item restores it

function onShoppingItemBought(item) {
    var id = item.ingId || getIngByName(item.name);
    if (!id || !isHouseholdIng(id)) return;
    _recurringBeforeBuy[item.key] = ingredients[id].recurring || null;
    ingredients[id].recurring = updateRecurringOnPurchase(ingredients[id].recurring);
    saveIngredients(ingredients);
}

function onShoppingItemUnbought(item) {
    var id = item.ingId || getIngByName(item.name);
    if (!id || !(item.key in _recurringBeforeBuy)) return;
    var prev = _recurringBeforeBuy[item.key];
    if (prev) ingredients[id].recurring = prev;
    else delete ingredients[id].recurring;
    delete _recurringBeforeBuy[item.key];
    saveIngredients(ingredients);
}

function addIngToShoppingList(id, source) {
    var ing = ingredients[id];
    if (!ing || isOnShoppingList(id)) return false;
    var key = ing.name.trim().toLowerCase();
    if (shoppingDone[key]) delete shoppingDone[key];
    shoppingExtra.push({ id: uid(), name: ing.name, qty: 1, ingId: id });
    saveShopping();
    renderShoppingList();
    return true;
}

function updateHouseholdBanner() {
    var banner = document.getElementById('household-banner');
    if (!banner) return;
    var due = getDueHouseholdIds().length;
    banner.classList.toggle('hidden', !due);
    var txt = document.getElementById('household-banner-text');
    if (txt) txt.textContent = '\u23f0 ' + plural(due, 'artigo de casa a verificar', 'artigos de casa a verificar');
    var hb = document.getElementById('household-btn-count');
    if (hb) { hb.textContent = due; hb.classList.toggle('hidden', !due); }
}

var householdOverlay = document.getElementById('household-overlay');

function openHouseholdModal(focusRunningOut) {
    renderHouseholdModal();
    householdOverlay.classList.remove('hidden');
    if (focusRunningOut) setTimeout(function() { document.getElementById('household-add-input').focus(); }, 50);
}

function closeHouseholdModal() { householdOverlay.classList.add('hidden'); }

function renderHouseholdModal() {
    var body = document.getElementById('household-list');
    if (!body) return;
    body.innerHTML = '';
    var now = Date.now();
    var ids = getHouseholdIds();
    if (!ids.length) {
        var empty = document.createElement('p');
        empty.className = 'empty-msg';
        empty.textContent = 'Ainda n\u00e3o h\u00e1 artigos de casa. Acrescenta em baixo coisas como papel higi\u00e9nico, guardanapos ou detergente \u2014 a app vai aprendendo de quanto em quanto tempo acabam.';
        body.appendChild(empty);
        return;
    }
    ids.forEach(function(id) {
        var ing = ingredients[id];
        var rec = ing.recurring || {};
        var every = rec.every || DEFAULT_RECURRING_EVERY;
        var left = recurringDaysLeft(rec, now);
        var onList = isOnShoppingList(id);

        var row = document.createElement('div');
        row.className = 'hh-row' + (left <= 0 && !onList ? ' hh-due' : '');

        var info = document.createElement('div');
        info.className = 'hh-info';
        var nm = document.createElement('div');
        nm.className = 'hh-name';
        nm.textContent = CATEGORIA_ICONS[ing.categoria] ? CATEGORIA_ICONS[ing.categoria] + ' ' + ing.name : ing.name;
        info.appendChild(nm);
        var bar = document.createElement('div');
        bar.className = 'hh-bar';
        var fill = document.createElement('div');
        fill.className = 'hh-bar-fill';
        var pct = Math.max(0, Math.min(100, Math.round(left / every * 100)));
        fill.style.width = pct + '%';
        if (pct <= 20) fill.classList.add('low');
        bar.appendChild(fill);
        info.appendChild(bar);
        var meta = document.createElement('div');
        meta.className = 'hh-meta';
        var parts = [];
        if (onList) parts.push('\ud83d\uded2 j\u00e1 est\u00e1 na lista');
        else if (!rec.lastBought && !rec.lastChecked) parts.push('ainda por verificar');
        else if (left <= 0) parts.push('verificar agora');
        else parts.push('verificar daqui a ' + plural(left, 'dia', 'dias'));
        parts.push('dura ~' + every + ' dias');
        if (rec.lastBought) parts.push('comprado ' + timeAgoLabel(rec.lastBought, now));
        meta.textContent = parts.join(' \u00b7 ');
        info.appendChild(meta);
        row.appendChild(info);

        var btns = document.createElement('div');
        btns.className = 'hh-btns';
        var haveBtn = document.createElement('button');
        haveBtn.type = 'button';
        haveBtn.className = 'hh-choice hh-choice-have';
        haveBtn.textContent = '\u2713 Temos';
        haveBtn.title = 'Ainda h\u00e1 em casa \u2014 volta a perguntar mais tarde';
        haveBtn.addEventListener('click', function() {
            var prev = ing.recurring ? Object.assign({}, ing.recurring) : null;
            ing.recurring = Object.assign({ every: DEFAULT_RECURRING_EVERY }, ing.recurring || {}, { lastChecked: Date.now() });
            saveIngredients(ingredients);
            renderHouseholdModal(); updateHouseholdBanner();
            showUndoToast(ing.name + ': temos', function() {
                if (prev) ing.recurring = prev; else delete ing.recurring;
                saveIngredients(ingredients); renderHouseholdModal(); updateHouseholdBanner();
            });
        });
        var buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'hh-choice hh-choice-buy';
        buyBtn.textContent = onList ? '\u2713 Na lista' : '\ud83d\uded2 Precisamos';
        buyBtn.disabled = onList;
        buyBtn.addEventListener('click', function() {
            if (addIngToShoppingList(id, 'Casa')) {
                renderHouseholdModal(); updateHouseholdBanner();
                showToast(ing.name + ' adicionado \u00e0 lista', { type: 'success' });
            }
        });
        btns.appendChild(haveBtn);
        btns.appendChild(buyBtn);
        row.appendChild(btns);
        body.appendChild(row);
    });
}

function addHouseholdOrRunningOut() {
    var input = document.getElementById('household-add-input');
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    var remember = document.getElementById('household-add-remember').checked;
    var id = getIngByName(name);
    if (!id) {
        id = slugId(name, Object.keys(ingredients));
        ingredients[id] = { name: name, categoria: autoAssignCategoria(name) };
    }
    if (remember && !isHouseholdIng(id)) {
        ingredients[id].recurring = { every: DEFAULT_RECURRING_EVERY };
    } else if (remember && ingredients[id].recurring && ingredients[id].recurring.off) {
        delete ingredients[id].recurring.off;
    }
    saveIngredients(ingredients);
    var added = addIngToShoppingList(id, 'Casa');
    input.value = '';
    renderHouseholdModal(); updateHouseholdBanner();
    showToast(added ? ingredients[id].name + ' adicionado \u00e0 lista' : ingredients[id].name + ' j\u00e1 estava na lista', { type: 'success' });
}

(function initHousehold() {
    if (!householdOverlay) return;
    document.getElementById('household-btn').addEventListener('click', function() { openHouseholdModal(false); });
    document.getElementById('household-banner').addEventListener('click', function() { openHouseholdModal(false); });
    document.getElementById('running-out-btn').addEventListener('click', function() { openHouseholdModal(true); });
    document.getElementById('household-close').addEventListener('click', closeHouseholdModal);
    document.getElementById('household-done').addEventListener('click', closeHouseholdModal);
    householdOverlay.addEventListener('click', function(e) { if (e.target === householdOverlay) closeHouseholdModal(); });
    document.getElementById('household-add-btn').addEventListener('click', addHouseholdOrRunningOut);
    document.getElementById('household-add-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addHouseholdOrRunningOut();
    });
    document.getElementById('household-add-input').addEventListener('input', function() {
        var v = this.value.trim();
        var id = v ? getIngByName(v) : null;
        var cb = document.getElementById('household-add-remember');
        cb.checked = id ? isHouseholdIng(id) : autoAssignCategoria(v) === 'Casa e Higiene';
    });
})();

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
    var newItem = { id: uid(), name: name, qty: parseFloat(qtyEl.value) || 1 };
    var knownId = getIngByName(name);
    if (knownId) newItem.ingId = knownId;
    shoppingExtra.push(newItem);
    saveShopping(); nameEl.value = ''; qtyEl.value = '';
    toggleShopAdd(false);
    renderShoppingList();
    updateHouseholdBanner();
    showToast(name + ' adicionado \u00e0 lista', { type: 'success' });
});

document.getElementById('shop-add-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('shop-add-btn').click();
});

// ---- Edit list toggle -------------------------------------------------------

var listEditMode = false;

document.getElementById('edit-list-btn').addEventListener('click', function() {
    listEditMode = !listEditMode;
    this.classList.toggle('btn-active', listEditMode);
    this.textContent = listEditMode ? '\u2713 Concluir' : '\u270E Editar';
    renderShoppingList();
});

// ---- Semana — extras search -------------------------------------------------

function renderSemanaExtrasList() {
    var wrap = document.getElementById('semana-extras-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    updateWeekSummary();
    weekExtras.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'shop-item';

        var left = document.createElement('div');
        left.className = 'shop-item-left';
        var nameLine = document.createElement('div');
        nameLine.className = 'ing-name-line';
        var iconEl = document.createElement('span');
        iconEl.className = 'ing-cat-badge';
        iconEl.textContent = getCatIcon(item.ingId, item.name);
        var nameEl = document.createElement('span');
        nameEl.className = 'shop-item-name';
        nameEl.textContent = item.name;
        nameLine.appendChild(iconEl);
        nameLine.appendChild(nameEl);
        left.appendChild(nameLine);

        var right = document.createElement('div');
        right.className = 'shop-item-right';

        var currentQty = Math.max(1, parseFloat(item.qty) || 1);
        var stepper = document.createElement('div');
        stepper.className = 'shop-stepper';
        var minusBtn = document.createElement('button');
        minusBtn.className = 'stepper-btn';
        minusBtn.textContent = '\u2212';
        minusBtn.type = 'button';
        var qtySpan = document.createElement('span');
        qtySpan.className = 'stepper-val';
        qtySpan.textContent = currentQty;
        var plusBtn = document.createElement('button');
        plusBtn.className = 'stepper-btn';
        plusBtn.textContent = '+';
        plusBtn.type = 'button';

        function persistQty(newQty) {
            weekExtras = weekExtras.map(function(e) {
                if (e.id !== item.id) return e;
                return Object.assign({}, e, { qty: newQty });
            });
            saveWeek(week);
            renderSemanaExtrasList();
        }

        minusBtn.addEventListener('click', function() {
            if (currentQty <= 1) return;
            currentQty = Math.round((currentQty - 1) * 1000) / 1000;
            persistQty(currentQty);
        });
        plusBtn.addEventListener('click', function() {
            currentQty = Math.round((currentQty + 1) * 1000) / 1000;
            persistQty(currentQty);
        });

        stepper.appendChild(minusBtn);
        stepper.appendChild(qtySpan);
        stepper.appendChild(plusBtn);
        right.appendChild(stepper);

        var removeBtn = document.createElement('button');
        removeBtn.className = 'btn-icon shop-remove';
        removeBtn.textContent = '\u2715';
        removeBtn.title = 'Remover';
        removeBtn.addEventListener('click', (function(itemId) {
            return function() {
                weekExtras = weekExtras.filter(function(e) { return e.id !== itemId; });
                saveWeek(week);
                renderSemanaExtrasList();
            };
        })(item.id));
        right.appendChild(removeBtn);

        div.appendChild(left);
        div.appendChild(right);
        wrap.appendChild(div);
    });
}

(function() {
    var input       = document.getElementById('semana-extras-input');
    var list        = document.getElementById('semana-extras-suggestions');
    var confirmDiv  = document.getElementById('semana-extras-confirm');
    if (confirmDiv) confirmDiv.classList.add('hidden');

    var activeIdx   = -1;
    var matches     = [];

    function normalizeKey(name) {
        return (name || '').trim().toLowerCase();
    }

    function clearInputState() {
        input.value = '';
        matches = [];
        activeIdx = -1;
        list.classList.add('hidden');
    }

    function buildMatches(q) {
        var lower = q.toLowerCase().trim();
        if (!lower) return [];
        return Object.keys(ingredients)
            .filter(function(id) {
                return ingredients[id].name.toLowerCase().indexOf(lower) !== -1;
            })
            .sort(function(a, b) {
                return ingredients[a].name.localeCompare(ingredients[b].name);
            })
            .slice(0, 8);
    }

    function renderSuggestions() {
        list.innerHTML = '';
        var typed = input.value.trim();
        if (!typed && !matches.length) { list.classList.add('hidden'); return; }
        matches.forEach(function(id, idx) {
            var ing  = ingredients[id];
            var icon = getCatIcon(id, ing.name);
            var li   = document.createElement('li');
            if (idx === activeIdx) li.classList.add('active');
            li.innerHTML =
                '<span class="sug-icon">' + esc(icon) + '</span>' +
                '<span>' + esc(ing.name) + '</span>' +
                '<span class="sug-cat">' + esc(ing.categoria || '') + '</span>';
            li.addEventListener('pointerdown', function(e) {
                e.preventDefault();
                addExtraFromSelection(id, ing.name);
            });
            list.appendChild(li);
        });
        var lowerTyped = typed.toLowerCase();
        var exactExists = matches.some(function(id) {
            return ingredients[id].name.toLowerCase() === lowerTyped;
        }) || !!getIngByName(typed);
        if (typed && !exactExists) {
            var addLi = document.createElement('li');
            addLi.className = 'active';
            addLi.innerHTML =
                '<span class="sug-icon">+</span>' +
                '<span>' + esc(typed) + '</span>' +
                '<span class="sug-cat">Novo</span>';
            addLi.addEventListener('pointerdown', function(e) {
                e.preventDefault();
                addExtraFromSelection(null, typed);
            });
            list.appendChild(addLi);
        }
        list.classList.remove('hidden');
    }

    function addExtraFromSelection(ingId, fallbackName) {
        var ingName = fallbackName || (ingredients[ingId] ? ingredients[ingId].name : '');
        var name = (ingName || '').trim();
        if (!name) return;
        var key = normalizeKey(name);
        var already = weekExtras.some(function(e) { return normalizeKey(e.name) === key; });
        if (already) {
            clearInputState();
            input.focus();
            return;
        }
        weekExtras.push({ id: uid(), ingId: ingId || null, name: name, qty: 1 });
        saveWeek(week);
        renderSemanaExtrasList();
        clearInputState();
        input.focus();
    }

    input.addEventListener('input', function() {
        activeIdx = -1;
        matches = buildMatches(input.value);
        renderSuggestions();
    });

    input.addEventListener('keydown', function(e) {
        if (!matches.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = Math.min(activeIdx + 1, matches.length - 1);
            renderSuggestions();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, 0);
            renderSuggestions();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            var typed = input.value.trim();
            if (!typed) return;
            if (activeIdx >= 0) {
                var mid = matches[activeIdx];
                addExtraFromSelection(mid, ingredients[mid] ? ingredients[mid].name : typed);
                return;
            }
            var exactId = getIngByName(typed);
            if (exactId) addExtraFromSelection(exactId, typed);
            else addExtraFromSelection(null, typed);
        } else if (e.key === 'Escape') {
            matches = []; activeIdx = -1; list.classList.add('hidden');
        }
    });

    input.addEventListener('blur', function() {
        setTimeout(function() { list.classList.add('hidden'); }, 300);
    });

    input.addEventListener('focus', function() {
        if (matches.length) list.classList.remove('hidden');
    });
})();

// ---- Recipes tab ------------------------------------------------------------

function renderRecipesTab() { renderRecipesGrid(); renderIngredientsDict(); }

var _recipesQuery = '';
var _recipesTier  = null; // null = pick the first non-empty tier automatically

function setRecipeTier(rid, tier) {
    var r = recipes[rid];
    if (!r) return;
    var prev = r.tier || null;
    var next = Object.assign({}, r);
    if (tier) next.tier = tier; else delete next.tier;
    recipes[rid] = next;
    saveRecipe(rid, next);
    renderRecipesGrid(); renderQuicklist();
    var msg = tier === 'pin' ? r.name + ' fixada nas Habituais'
            : tier === 'archive' ? r.name + ' arquivada'
            : r.name + ' volta ao modo autom\u00e1tico';
    showUndoToast(msg, function() { setRecipeTier(rid, prev); hideToast(); });
}

function renderRecipesTierSeg(counts, active) {
    var seg = document.getElementById('recipes-tier-seg');
    if (!seg) return;
    seg.innerHTML = '';
    ['habitual', 'asvezes', 'arquivo'].forEach(function(t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tier-seg-btn' + (t === active ? ' active' : '');
        b.textContent = TIER_LABELS[t] + ' ' + counts[t];
        b.addEventListener('click', function() { _recipesTier = t; renderRecipesGrid(); });
        seg.appendChild(b);
    });
}

function renderRecipesGrid() {
    var grid     = document.getElementById('recipes-grid');
    var emptyMsg = document.getElementById('recipes-empty');
    var noRes    = document.getElementById('recipes-noresults');
    grid.innerHTML = '';
    var ids = Object.keys(recipes).sort(function(a,b) { return recipes[a].name.localeCompare(recipes[b].name); });
    if (!ids.length) { emptyMsg.classList.remove('hidden'); if (noRes) noRes.classList.add('hidden'); return; }
    emptyMsg.classList.add('hidden');
    var stats = getRecipeStats();
    var counts = { habitual: 0, asvezes: 0, arquivo: 0 };
    ids.forEach(function(rid) { counts[stats[rid].tier]++; });
    var tier = _recipesTier || (counts.habitual ? 'habitual' : counts.asvezes ? 'asvezes' : 'arquivo');
    var q = _recipesQuery.trim().toLowerCase();
    var seg = document.getElementById('recipes-tier-seg');
    if (seg) seg.classList.toggle('hidden', !!q);
    renderRecipesTierSeg(counts, tier);
    if (q) {
        ids = ids.filter(function(rid) {
            var r = recipes[rid];
            if (r.name.toLowerCase().indexOf(q) !== -1) return true;
            return (r.ingredients || []).some(function(i) {
                return (getIngName(i.ingId) || i.name || '').toLowerCase().indexOf(q) !== -1;
            });
        });
    } else {
        ids = ids.filter(function(rid) { return stats[rid].tier === tier; });
        if (tier === 'habitual') {
            ids.sort(function(a, b) { return stats[b].countRecent - stats[a].countRecent || recipes[a].name.localeCompare(recipes[b].name); });
        }
    }
    if (noRes) {
        noRes.textContent = q ? 'Nenhuma receita encontrada.'
            : tier === 'habitual' ? 'Ainda sem habituais. As receitas feitas 3 ou mais vezes nas \u00faltimas 12 semanas aparecem aqui \u2014 ou fixa uma manualmente.'
            : tier === 'arquivo' ? 'O arquivo est\u00e1 vazio.'
            : 'Nenhuma receita aqui.';
        noRes.classList.toggle('hidden', ids.length > 0);
    }
    ids.forEach(function(rid) {
        var r = recipes[rid];
        var st = stats[rid];
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
        if (!(r.ingredients || []).length) {
            var draft = document.createElement('span');
            draft.className = 'pill pill-warn';
            draft.textContent = 'rascunho';
            draft.title = 'Ainda sem ingredientes';
            nameLine.appendChild(draft);
        }
        if (st.manual) {
            var pinPill = document.createElement('span');
            pinPill.className = 'pill pill-muted';
            pinPill.textContent = st.manual === 'pin' ? '\ud83d\udccc' : '\ud83d\uddc4\ufe0f';
            pinPill.title = st.manual === 'pin' ? 'Fixada nas Habituais' : 'Arquivada manualmente';
            nameLine.appendChild(pinPill);
        }
        left.appendChild(nameLine);
        var meta = document.createElement('span');
        meta.className = 'recipe-row-meta';
        meta.textContent = (q ? TIER_LABELS[st.tier] + ' \u00b7 ' : '') +
            (st.count ? 'Feita ' + st.count + '\u00d7 \u00b7 \u00faltima vez ' + timeAgoLabel(st.lastCooked) : 'Ainda n\u00e3o registada no hist\u00f3rico');
        left.appendChild(meta);
        var ingNames = (r.ingredients || []).map(function(i){ return getIngName(i.ingId) || i.name || ''; }).join(', ');
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
                var ingName = getIngName(ing.ingId) || ing.name || '';
                var liLine = document.createElement('span');
                liLine.className = 'ing-name-line';
                var liIcon = document.createElement('span');
                liIcon.className = 'ing-cat-badge';
                liIcon.textContent = getCatIcon(ing.ingId, ingName);
                liIcon.title = getIngCategoria(ing.ingId || '');
                var liName = document.createElement('span');
                liName.textContent = ingName + (ing.qty ? ' — ' + ing.qty : '');
                liLine.appendChild(liIcon);
                liLine.appendChild(liName);
                li.appendChild(liLine);
                ul.appendChild(li);
            });
            detail.appendChild(ul);
        }
        var tierActions = document.createElement('div');
        tierActions.className = 'recipe-tier-actions';
        function tierBtn(label, tierValue) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-outline btn-sm';
            b.textContent = label;
            b.addEventListener('click', function(e) { e.stopPropagation(); setRecipeTier(rid, tierValue); });
            tierActions.appendChild(b);
        }
        if (st.manual !== 'pin') tierBtn('\ud83d\udccc Fixar nas Habituais', 'pin');
        if (st.manual !== 'archive') tierBtn('\ud83d\uddc4\ufe0f Arquivar', 'archive');
        if (st.manual) tierBtn('\u21ba Autom\u00e1tico (' + TIER_LABELS[st.autoTier] + ')', null);
        detail.appendChild(tierActions);
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

document.getElementById('recipes-search').addEventListener('input', function() {
    _recipesQuery = this.value;
    renderRecipesGrid();
});

function deleteRecipe(rid) {
    if (!recipes[rid]) return;
    var data = recipes[rid];
    var daysUsing = Object.keys(week).filter(function(d) { return week[d] === rid; });
    daysUsing.forEach(function(d) { week[d] = null; });
    if (daysUsing.length) saveWeek(week);
    delete recipes[rid]; deleteRecipeDb(rid);
    refreshAllSelects(); renderRecipesGrid();
    showUndoToast('Receita "' + data.name + '" apagada', function() {
        recipes[rid] = data; saveRecipe(rid, data);
        daysUsing.forEach(function(d) { if (!week[d]) week[d] = rid; });
        if (daysUsing.length) saveWeek(week);
        refreshAllSelects(); renderRecipesGrid();
    });
}

document.getElementById('clear-list-btn').addEventListener('click', function() {
    var snap = { extra: shoppingExtra, done: shoppingDone, gen: generatedFromWeek };
    shoppingExtra = []; shoppingDone = {}; generatedFromWeek = []; saveShopping();
    if (listEditMode) document.getElementById('edit-list-btn').click();
    renderShoppingList();
    showUndoToast('Lista de compras limpa', function() {
        shoppingExtra = snap.extra; shoppingDone = snap.done; generatedFromWeek = snap.gen;
        saveShopping(); renderShoppingList();
    });
});

document.getElementById('shopping-empty-go-week').addEventListener('click', function() {
    switchTab('semana');
});

// ---- Fecho da semana (end-of-week review) --------------------------------------

var STATUS_LABELS = {
    done: { icon: '\u2705', label: 'Feito' },
    skip: { icon: '\u274c', label: 'N\u00e3o feito' },
    out:  { icon: '\ud83d\udef5', label: 'Comemos fora' }
};
var weekCloseOverlay = document.getElementById('week-close-overlay');
var _closeStatuses = {};
var _closeCarryTouched = false;

function openWeekClose() {
    if (!countPlannedMeals(week) && !weekExtras.length) {
        showToast('A semana j\u00e1 est\u00e1 vazia.');
        return;
    }
    if (!countPlannedMeals(week)) { performCloseWeek({}, false); return; }
    _closeStatuses = {};
    _closeCarryTouched = false;
    DAYS.forEach(function(day, i) { if (getWeekRecipeById(week[String(i)])) _closeStatuses[i] = 'done'; });
    document.getElementById('week-close-carry').checked = false;
    renderWeekClose();
    weekCloseOverlay.classList.remove('hidden');
}

function closeWeekCloseModal() { weekCloseOverlay.classList.add('hidden'); }

function renderWeekClose() {
    var list = document.getElementById('week-close-list');
    list.innerHTML = '';
    var counts = { done: 0, skip: 0, out: 0 };
    DAYS.forEach(function(day, i) {
        var recipe = getWeekRecipeById(week[String(i)]);
        if (!recipe) return;
        var st = _closeStatuses[i];
        counts[st]++;
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'wc-row wc-' + st;
        var dayEl = document.createElement('span');
        dayEl.className = 'wc-day';
        dayEl.textContent = day.slice(0, 3);
        var nm = document.createElement('span');
        nm.className = 'wc-name';
        nm.textContent = (recipe.icon ? recipe.icon + ' ' : '') + recipe.name;
        var stEl = document.createElement('span');
        stEl.className = 'wc-status';
        stEl.textContent = STATUS_LABELS[st].icon + ' ' + STATUS_LABELS[st].label;
        row.appendChild(dayEl); row.appendChild(nm); row.appendChild(stEl);
        row.addEventListener('click', function() {
            _closeStatuses[i] = nextWeekStatus(_closeStatuses[i]);
            renderWeekClose();
        });
        list.appendChild(row);
    });
    var carry = document.getElementById('week-close-carry');
    if (!_closeCarryTouched) carry.checked = counts.skip > 0;
    document.getElementById('week-close-carry-wrap').classList.toggle('hidden', !counts.skip);
    document.getElementById('week-close-summary').textContent =
        STATUS_LABELS.done.icon + ' ' + counts.done + '  \u00b7  ' +
        STATUS_LABELS.skip.icon + ' ' + counts.skip + '  \u00b7  ' +
        STATUS_LABELS.out.icon + ' ' + counts.out;
}

function performCloseWeek(statuses, carry) {
    var snapWeek = Object.assign({}, week);
    var snapExtras = weekExtras.slice();
    var snapTemp = Object.assign({}, weekTempRecipes);
    var snapCarried = Object.assign({}, weekCarried);
    var snapHistory = weekHistory.slice();
    var snapshot = {
        date: new Date().toISOString(),
        week: DAYS.map(function(day, i) {
            var rid = week[String(i)];
            var recipe = getWeekRecipeById(rid);
            if (!recipe) return { day: day, recipe: null };
            var r = { name: recipe.name, icon: recipe.icon || '' };
            if (!isTempRecipeId(rid)) r.id = rid;
            return { day: day, recipe: r, status: statuses[i] || 'done' };
        }),
        lista: generatedFromWeek.map(function(item) { return { name: item.name, qty: item.qty }; })
    };
    weekHistory = [snapshot].concat(weekHistory).slice(0, 20);
    historyIdx = 0;
    saveHistory(weekHistory);
    renderHistorico();
    var next = {};
    var nextCarried = {};
    var carriedCount = 0;
    if (carry) {
        Object.keys(statuses).forEach(function(i) {
            if (statuses[i] !== 'skip') return;
            var rid = week[String(i)];
            if (!rid) return;
            next[String(i)] = rid;
            nextCarried[String(i)] = rid;
            carriedCount++;
        });
    }
    week = next; weekCarried = nextCarried; weekExtras = []; saveWeek(week);
    refreshAllSelects();
    renderSemanaExtrasList();
    renderRecipesGrid();
    var msg = carriedCount
        ? 'Semana fechada \u00b7 ' + plural(carriedCount, 'receita transitou', 'receitas transitaram')
        : 'Semana limpa e guardada no hist\u00f3rico';
    showUndoToast(msg, function() {
        week = snapWeek; weekExtras = snapExtras; weekTempRecipes = snapTemp; weekCarried = snapCarried;
        weekHistory = snapHistory; historyIdx = 0;
        saveHistory(weekHistory); renderHistorico();
        db.collection('data').doc('week').set({ days: week, extras: weekExtras, tempRecipes: weekTempRecipes, carried: weekCarried }).catch(console.error);
        refreshAllSelects(); renderSemanaExtrasList(); renderRecipesGrid();
    });
}

document.getElementById('clear-week-btn').addEventListener('click', openWeekClose);
document.getElementById('week-close-x').addEventListener('click', closeWeekCloseModal);
document.getElementById('week-close-cancel').addEventListener('click', closeWeekCloseModal);
weekCloseOverlay.addEventListener('click', function(e) { if (e.target === weekCloseOverlay) closeWeekCloseModal(); });
document.getElementById('week-close-carry').addEventListener('change', function() { _closeCarryTouched = true; });
document.getElementById('week-close-confirm').addEventListener('click', function() {
    var carry = document.getElementById('week-close-carry').checked;
    closeWeekCloseModal();
    performCloseWeek(_closeStatuses, carry);
});

// ---- Gerar Lista modal -----------------------------------------------------

var gerarOverlay   = document.getElementById('gerar-overlay');
var pendingListItems = []; // { name, qty, sources, removed }

function buildIngredientTotals() {
    var totals = {};
    function addFromRecipe(recipeId, carried) {
        var recipe = getWeekRecipeById(recipeId);
        if (!recipe) return;
        var recipeName = recipe.name;
        (recipe.ingredients || []).forEach(function(ing) {
            var name = ing.ingId ? getIngName(ing.ingId) : (ing.name || '');
            if (!name) return;
            var key = name.trim().toLowerCase();
            if (!totals[key]) totals[key] = { name: name.trim(), qty: 0, sources: [], ingId: ing.ingId || null, onlyCarried: true };
            totals[key].qty += parseFloat(ing.qty) || 0;
            if (!carried) totals[key].onlyCarried = false;
            if (recipeName && totals[key].sources.indexOf(recipeName) === -1) totals[key].sources.push(recipeName);
        });
    }
    function addFromIngEntry(entry, label) {
        var name = '';
        var ingId = null;
        if (entry.ingId && ingredients[entry.ingId]) {
            name = ingredients[entry.ingId].name;
            ingId = entry.ingId;
        } else {
            name = (entry.name || '').trim();
        }
        if (!name) return;
        var key  = name.trim().toLowerCase();
        if (!totals[key]) totals[key] = { name: name, qty: 0, sources: [], ingId: ingId, onlyCarried: false };
        totals[key].qty += parseFloat(entry.qty) || 0;
        totals[key].onlyCarried = false;
        if (label && totals[key].sources.indexOf(label) === -1) totals[key].sources.push(label);
    }
    Object.keys(week).forEach(function(d) {
        if (week[d]) addFromRecipe(week[d], weekCarried[d] === week[d]);
    });
    weekExtras.forEach(function(e) { addFromIngEntry(e, 'Extra'); });
    return Object.keys(totals).sort().map(function(k) { return Object.assign({ key: k }, totals[k]); });
}

var pendingHousehold = []; // due household items shown at the top of the review: { ingId, name, decision }

function openGerarModal() {
    pendingListItems = buildIngredientTotals().map(function(item) {
        var ingId = item.ingId || getIngByName(item.name);
        var hint = null;
        if (item.onlyCarried) hint = 'carried';
        else if (ingId && ingredients[ingId] && usuallyHave(ingredients[ingId].haveStats)) hint = 'usual';
        return { name: item.name, qty: item.qty, sources: item.sources, removed: !!hint, hint: hint, ingId: ingId || null };
    });
    var listed = {};
    pendingListItems.forEach(function(i) { listed[i.name.trim().toLowerCase()] = true; });
    getPendingShoppingKeys().forEach(function(k) { listed[k] = true; });
    pendingHousehold = getDueHouseholdIds().filter(function(id) {
        return !listed[ingredients[id].name.trim().toLowerCase()];
    }).map(function(id) { return { ingId: id, name: ingredients[id].name, decision: null }; });
    if (!pendingListItems.length && !pendingHousehold.length) { showToast('Ainda não há refeições nem extras na semana.', { type: 'error' }); return; }
    renderGerarModal();
    gerarOverlay.classList.remove('hidden');
}

function renderGerarModal() {
    var body = document.getElementById('gerar-body');
    body.innerHTML = '';

    var toBuy = pendingListItems.filter(function(i) { return !i.removed; }).length +
                pendingHousehold.filter(function(h) { return h.decision === 'buy'; }).length;
    var have  = pendingListItems.length - pendingListItems.filter(function(i) { return !i.removed; }).length;
    var counter = document.getElementById('gerar-counter');
    if (counter) counter.textContent = plural(toBuy, 'item para comprar', 'itens para comprar') + ' \u00b7 ' + have + ' j\u00e1 em casa';
    var approve = document.getElementById('gerar-aprovar');
    if (approve) approve.textContent = '\u2713 Confirmar lista (' + toBuy + ')';

    var intro = document.createElement('p');
    intro.className = 'gerar-intro';
    intro.textContent = 'Percorre a casa e toca no que j\u00e1 tens \u2014 fica riscado. Toca outra vez para voltar a p\u00f4r.';
    body.appendChild(intro);

    if (pendingHousehold.length) {
        var hh = document.createElement('div');
        hh.className = 'gerar-household';
        var hhTitle = document.createElement('div');
        hhTitle.className = 'gerar-cat-header gerar-household-header';
        hhTitle.textContent = '\u23f0 Artigos de casa a verificar \u00b7 ' + pendingHousehold.length;
        hh.appendChild(hhTitle);
        pendingHousehold.forEach(function(h) {
            var row = document.createElement('div');
            row.className = 'gerar-ing-row gerar-hh-row';
            var left = document.createElement('div');
            left.className = 'gerar-ing-left';
            var nm = document.createElement('span');
            nm.className = 'gerar-ing-name';
            nm.textContent = CATEGORIA_ICONS[getIngCategoria(h.ingId)] + ' ' + h.name;
            left.appendChild(nm);
            var rec = ingredients[h.ingId].recurring || {};
            var sub = document.createElement('span');
            sub.className = 'gerar-ing-sources';
            sub.textContent = rec.lastBought ? 'Comprado ' + timeAgoLabel(rec.lastBought) + ' \u00b7 costuma durar ~' + (rec.every || DEFAULT_RECURRING_EVERY) + ' dias' : 'Ainda sem compras registadas';
            left.appendChild(sub);
            row.appendChild(left);
            var right = document.createElement('div');
            right.className = 'gerar-hh-btns';
            [['have', '\u2713 Temos'], ['buy', '\ud83d\uded2 Comprar']].forEach(function(opt) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'hh-choice hh-choice-' + opt[0] + (h.decision === opt[0] ? ' active' : '');
                b.textContent = opt[1];
                b.addEventListener('click', function() {
                    h.decision = h.decision === opt[0] ? null : opt[0];
                    renderGerarModal();
                });
                right.appendChild(b);
            });
            row.appendChild(right);
            hh.appendChild(row);
        });
        body.appendChild(hh);
    }

    function renderGerarItem(item, idx) {
        var row = document.createElement('div');
        row.className = 'gerar-ing-row gerar-ing-tappable' + (item.removed ? ' gerar-ing-removed' : '');
        row.dataset.idx = idx;
        row.addEventListener('click', function(e) {
            if (e.target.closest('input')) return;
            pendingListItems[idx].removed = !pendingListItems[idx].removed;
            renderGerarModal();
        });

        var left = document.createElement('div');
        left.className = 'gerar-ing-left';

        var nameLine = document.createElement('div');
        nameLine.className = 'ing-name-line';
        var iconEl = document.createElement('span');
        iconEl.className = 'ing-cat-badge';
        iconEl.textContent = getCatIcon(item.ingId, item.name);
        iconEl.title = item.ingId ? getIngCategoria(item.ingId) : getIngCategoriaByName(item.name);
        var nameEl = document.createElement('span');
        nameEl.className = 'gerar-ing-name';
        nameEl.textContent = item.name;
        nameLine.appendChild(iconEl);
        nameLine.appendChild(nameEl);
        if (item.hint) {
            var hintEl = document.createElement('span');
            hintEl.className = 'pill ' + (item.hint === 'usual' ? 'pill-purple' : 'pill-accent');
            hintEl.textContent = item.hint === 'usual' ? 'costumam ter' : 'da semana passada';
            hintEl.title = item.hint === 'usual'
                ? 'Nas \u00faltimas listas estava quase sempre em casa'
                : 'S\u00f3 \u00e9 usado numa receita que transitou da semana passada \u2014 j\u00e1 deve estar comprado';
            nameLine.appendChild(hintEl);
        }
        left.appendChild(nameLine);

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
            qtyInput.addEventListener('change', function() {
                pendingListItems[idx].qty = parseFloat(qtyInput.value) || 0;
            });
            right.appendChild(qtyInput);
        }
        var check = document.createElement('span');
        check.className = 'gerar-have-check' + (item.removed ? ' on' : '');
        check.textContent = item.removed ? '\u2713 temos' : 'temos?';
        right.appendChild(check);
        row.appendChild(right);
        body.appendChild(row);
    }

    // Group by where things are kept at home, so the review follows a walk through the house.
    var byLoc = {};
    HOUSE_LOCATIONS.forEach(function(l) { byLoc[l.id] = []; });
    pendingListItems.forEach(function(item, idx) {
        var cat = item.ingId ? getIngCategoria(item.ingId) : getIngCategoriaByName(item.name);
        byLoc[getHouseLocation(cat)].push({ item: item, idx: idx });
    });
    HOUSE_LOCATIONS.forEach(function(loc) {
        var entries = byLoc[loc.id];
        if (!entries.length) return;
        entries.sort(function(a, b) { return a.item.name.localeCompare(b.item.name); });
        var checked = entries.filter(function(e) { return e.item.removed; }).length;
        var header = document.createElement('div');
        header.className = 'gerar-cat-header';
        header.textContent = loc.icon + ' ' + loc.label + ' \u00b7 ' + checked + '/' + entries.length + ' em casa';
        body.appendChild(header);
        entries.forEach(function(e) { renderGerarItem(e.item, e.idx); });
    });
}

document.getElementById('gerar-lista-btn').addEventListener('click', openGerarModal);
document.getElementById('gerar-close').addEventListener('click', function() { gerarOverlay.classList.add('hidden'); });
document.getElementById('gerar-cancel').addEventListener('click', function() { gerarOverlay.classList.add('hidden'); });
gerarOverlay.addEventListener('click', function(e) { if (e.target === gerarOverlay) gerarOverlay.classList.add('hidden'); });

document.getElementById('gerar-aprovar').addEventListener('click', function() {
    var now = Date.now();
    var dictChanged = false;
    // Learn what is usually at home (carried-over items say nothing about habits).
    pendingListItems.forEach(function(item) {
        if (!item.ingId || !ingredients[item.ingId] || item.hint === 'carried') return;
        ingredients[item.ingId].haveStats = updateHaveStats(ingredients[item.ingId].haveStats, item.removed);
        dictChanged = true;
    });
    var householdBuy = [];
    pendingHousehold.forEach(function(h) {
        var ing = ingredients[h.ingId];
        if (!ing) return;
        if (h.decision === 'have') {
            ing.recurring = Object.assign({ every: DEFAULT_RECURRING_EVERY }, ing.recurring || {}, { lastChecked: now });
            dictChanged = true;
        } else if (h.decision === 'buy') {
            householdBuy.push({ name: ing.name, qty: 1, sources: ['Casa'], key: ing.name.trim().toLowerCase(), ingId: h.ingId });
        }
    });
    if (dictChanged) saveIngredients(ingredients);

    generatedFromWeek = pendingListItems
        .filter(function(item) { return !item.removed; })
        .map(function(item) { return { name: item.name, qty: item.qty, sources: item.sources, key: item.name.trim().toLowerCase(), ingId: item.ingId || null }; })
        .concat(householdBuy);
    saveShopping();
    renderShoppingList();
    updateHouseholdBanner();
    gerarOverlay.classList.add('hidden');
    switchTab('lista');
    showToast('Lista gerada com ' + plural(generatedFromWeek.length, 'ingrediente', 'ingredientes'), { type: 'success' });
});

// ---- History (Histórico) --------------------------------------------------

function renderHistorico() {
    var el = document.getElementById('semana-historico-panel');
    if (!el) return;
    el.innerHTML = '';

    if (!weekHistory.length) {
        var emptyP = document.createElement('p');
        emptyP.className = 'empty-msg';
        emptyP.textContent = 'Sem hist\u00f3rico ainda. Fecha a semana para criar um registo.';
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
    prevBtn.title = 'Mais recente';
    prevBtn.disabled = historyIdx <= 0;
    prevBtn.addEventListener('click', function() { historyIdx--; renderHistorico(); });

    var lbl = document.createElement('span');
    lbl.className = 'hist-nav-label';
    var d = new Date(entry.date);
    var dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    lbl.textContent = (historyIdx + 1) + ' / ' + weekHistory.length + ' \u2014 ' + dateStr;

    var nextBtn = document.createElement('button');
    nextBtn.className = 'btn-icon hist-nav-btn';
    nextBtn.textContent = '\u203a'; // ›
    nextBtn.title = 'Mais antigo';
    nextBtn.disabled = historyIdx >= weekHistory.length - 1;
    nextBtn.addEventListener('click', function() { historyIdx++; renderHistorico(); });

    nav.appendChild(prevBtn);
    nav.appendChild(lbl);
    nav.appendChild(nextBtn);
    el.appendChild(nav);

    // Week grid
    var weekHdr = document.createElement('h4');
    weekHdr.className = 'hist-section-title';
    var sc = countWeekStatuses(entry);
    weekHdr.textContent = 'Semana \u00b7 ' + STATUS_LABELS.done.icon + ' ' + sc.done +
        (sc.skip ? '  ' + STATUS_LABELS.skip.icon + ' ' + sc.skip : '') +
        (sc.out ? '  ' + STATUS_LABELS.out.icon + ' ' + sc.out : '');
    el.appendChild(weekHdr);

    var weekGrid = document.createElement('div');
    weekGrid.className = 'hist-week-grid';
    (entry.week || []).forEach(function(slot) {
        var card = document.createElement('div');
        card.className = 'hist-day-card' + (slot.recipe ? '' : ' hist-day-empty') +
            (slot.recipe && slot.status && slot.status !== 'done' ? ' hist-day-' + slot.status : '');
        var dayLbl = document.createElement('span');
        dayLbl.className = 'hist-day-label';
        dayLbl.textContent = slot.day;
        card.appendChild(dayLbl);
        if (slot.recipe) {
            var rid = matchHistoryRecipe(slot.recipe, recipes);
            if (rid) {
                card.style.cursor = 'pointer';
                card.title = 'Ver ingredientes';
                card.addEventListener('click', (function(id) {
                    return function() { openViewModal(id); };
                })(rid));
            }
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
            if (slot.status && slot.status !== 'done' && STATUS_LABELS[slot.status]) {
                var stb = document.createElement('span');
                stb.className = 'hist-status';
                stb.textContent = STATUS_LABELS[slot.status].icon + ' ' + STATUS_LABELS[slot.status].label;
                card.appendChild(stb);
            }
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
            var ns = document.createElement('span');
            ns.className = 'ing-name-line';
            var nsIcon = document.createElement('span');
            nsIcon.className = 'ing-cat-badge';
            nsIcon.textContent = getCatIcon(null, item.name);
            nsIcon.title = getIngCategoriaByName(item.name);
            var nsName = document.createElement('span');
            nsName.textContent = item.name;
            ns.appendChild(nsIcon);
            ns.appendChild(nsName);
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

function getRecipesUsingIngredient(ingId) {
    return Object.keys(recipes).filter(function(rid) {
        return (recipes[rid].ingredients || []).some(function(i) {
            return i.ingId === ingId;
        });
    }).map(function(rid) { return recipes[rid].name; });
}

function renderIngredientsDict() {
    var list     = document.getElementById('ing-dict-list');
    var emptyMsg = document.getElementById('ing-dict-empty');
    list.innerHTML = '';
    var ids = Object.keys(ingredients);
    renderPorArrumar(ids);
    if (!ids.length) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    var byCategory = {};
    CATEGORIAS.forEach(function(cat) { byCategory[cat] = []; });
    ids.forEach(function(id) {
        var cat = ingredients[id].categoria || 'Outros';
        if (!byCategory[cat]) cat = 'Outros';
        byCategory[cat].push(id);
    });
    CATEGORIAS.forEach(function(cat) {
        var catIds = byCategory[cat];
        if (!catIds.length) return;
        catIds.sort(function(a, b) { return ingredients[a].name.localeCompare(ingredients[b].name); });
        var header = document.createElement('div');
        header.className = 'ing-cat-header';
        header.textContent = cat;
        list.appendChild(header);
        catIds.forEach(function(id) { list.appendChild(buildIngDictRow(id)); });
    });
}

function renderPorArrumar(ids) {
    var box = document.getElementById('por-arrumar');
    if (!box) return;
    var outros = ids.filter(function(id) { return (ingredients[id].categoria || 'Outros') === 'Outros'; })
        .sort(function(a, b) { return ingredients[a].name.localeCompare(ingredients[b].name); });
    box.innerHTML = '';
    box.classList.toggle('hidden', !outros.length);
    if (!outros.length) return;
    var title = document.createElement('div');
    title.className = 'por-arrumar-title';
    title.textContent = '\ud83e\uddf9 Por arrumar \u00b7 ' + outros.length;
    box.appendChild(title);
    var hint = document.createElement('p');
    hint.className = 'por-arrumar-hint';
    hint.textContent = 'Estes ingredientes est\u00e3o em \u201cOutros\u201d. Um toque na categoria certa e fica arrumado \u2014 sem pressa, faz um ou dois de cada vez.';
    box.appendChild(hint);
    outros.slice(0, 5).forEach(function(id) {
        var row = document.createElement('div');
        row.className = 'por-arrumar-row';
        var nm = document.createElement('div');
        nm.className = 'por-arrumar-name';
        nm.textContent = ingredients[id].name;
        row.appendChild(nm);
        var chips = document.createElement('div');
        chips.className = 'por-arrumar-chips';
        CATEGORIAS.forEach(function(cat) {
            if (cat === 'Outros') return;
            var c = document.createElement('button');
            c.type = 'button';
            c.className = 'cat-chip';
            c.textContent = CATEGORIA_ICONS[cat] || cat;
            c.title = cat;
            c.setAttribute('aria-label', cat);
            c.addEventListener('click', function() {
                ingredients[id].categoria = cat;
                saveIngredients(ingredients);
                renderIngredientsDict();
                showUndoToast(ingredients[id].name + ' \u2192 ' + cat, function() {
                    ingredients[id].categoria = 'Outros';
                    saveIngredients(ingredients);
                    renderIngredientsDict();
                });
            });
            chips.appendChild(c);
        });
        row.appendChild(chips);
        box.appendChild(row);
    });
    if (outros.length > 5) {
        var more = document.createElement('p');
        more.className = 'por-arrumar-hint';
        more.textContent = '+ ' + (outros.length - 5) + ' mais depois destes';
        box.appendChild(more);
    }
}

function buildIngDictRow(id) {
    var row = document.createElement('div');
    row.className = 'ing-dict-row';
    row.dataset.ingId = id;

    var usedIn = getRecipesUsingIngredient(id);

    var left = document.createElement('div');
    left.className = 'ing-dict-row-left';
    var nameLine = document.createElement('div');
    nameLine.className = 'ing-name-line';
    var catBadge = document.createElement('span');
    catBadge.className = 'ing-cat-badge';
    catBadge.textContent = getCatIcon(id, ingredients[id].name);
    catBadge.title = ingredients[id].categoria || 'Outros';
    var nameEl = document.createElement('span');
    nameEl.className = 'ing-dict-name';
    nameEl.textContent = ingredients[id].name;
    nameLine.appendChild(catBadge);
    nameLine.appendChild(nameEl);
    left.appendChild(nameLine);
    if (usedIn.length) {
        var usageEl = document.createElement('span');
        usageEl.className = 'ing-dict-usage';
        usageEl.textContent = usedIn.join(', ');
        left.appendChild(usageEl);
    }

    row.appendChild(left);

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

    var usedIn = getRecipesUsingIngredient(id);

    // Name input
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ing-dict-input';
    input.value = ingredients[id].name;
    row.appendChild(input);

    // Categoria select
    var catSelect = document.createElement('select');
    catSelect.className = 'ing-edit-cat-select';
    CATEGORIAS.forEach(function(cat) {
        var opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        if ((ingredients[id].categoria || 'Outros') === cat) opt.selected = true;
        catSelect.appendChild(opt);
    });
    row.appendChild(catSelect);

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
        if (conflict) { showToast('Já existe um ingrediente com esse nome.', { type: 'error' }); input.focus(); return; }
        ingredients[id].name = newName;
        ingredients[id].categoria = catSelect.value;
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
            var removed = ingredients[id];
            delete ingredients[id]; saveIngredients(ingredients); renderIngredientsDict();
            showUndoToast('"' + removed.name + '" removido do dicionário', function() {
                ingredients[id] = removed; saveIngredients(ingredients); renderIngredientsDict();
            });
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
    if (!show) {
        document.getElementById('ing-dict-input').value = '';
        var catSel = document.getElementById('ing-dict-cat-select');
        if (catSel) catSel.value = '';
    }
}

document.getElementById('ing-dict-add-btn').addEventListener('click', function() { addIngredientToDict(); });
document.getElementById('ing-dict-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') addIngredientToDict(); });
document.getElementById('ing-dict-input').addEventListener('input', function() {
    var catSel = document.getElementById('ing-dict-cat-select');
    if (!catSel) return;
    catSel.value = autoAssignCategoria(this.value.trim());
});

function addIngredientToDict(nameOverride) {
    var input = document.getElementById('ing-dict-input');
    var name  = (nameOverride !== undefined ? nameOverride : input.value).trim();
    if (!name) { if (!nameOverride) input.focus(); return null; }
    var existing = getIngByName(name);
    if (existing) { if (!nameOverride) input.value = ''; return existing; }
    var id = slugId(name, Object.keys(ingredients));
    var catSel = document.getElementById('ing-dict-cat-select');
    var cat = (catSel && catSel.value) ? catSel.value : autoAssignCategoria(name);
    ingredients[id] = { name: name, categoria: cat };
    saveIngredients(ingredients); renderIngredientsDict();
    if (!nameOverride) toggleIngAdd(false);
    return id;
}

// ---- Add/Edit Recipe Modal --------------------------------------------------

var modalOverlay = document.getElementById('modal-overlay');
var editingId    = null;
// DEFAULT_ICONS is defined in utils.js
var pendingIcon  = null;

function updateSelectedIconButton() {
    var btn = document.getElementById('selected-icon-btn');
    if (!btn) return;
    if (pendingIcon) {
        btn.textContent = pendingIcon;
        btn.classList.remove('is-empty');
        btn.title = 'Trocar ícone';
    } else {
        var nameVal = (document.getElementById('recipe-name-input') || {}).value || '';
        btn.textContent = autoAssignIcon(nameVal, getRecipeRowsFromModal());
        btn.classList.add('is-empty');
        btn.title = 'Ícone automático — toca para escolher outro';
    }
}

function setIconPickerVisible(visible) {
    var wrap = document.getElementById('icon-picker-wrap');
    var btn = document.getElementById('selected-icon-btn');
    if (!wrap) return;
    wrap.classList.toggle('hidden', !visible);
    if (btn) btn.classList.toggle('is-open', !!visible);
}

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
            updateSelectedIconButton();
            setIconPickerVisible(false);
        });
        picker.appendChild(btn);
    });
}

function openAddModal(rid) {
    editingId   = rid || null;
    pendingIcon = rid ? (recipes[rid].icon || DEFAULT_ICONS[0]) : null;
    document.getElementById('modal-title').textContent = rid ? 'Editar Receita' : 'Nova Receita';
    var delBtn = document.getElementById('modal-delete');
    var useWeekBtn = document.getElementById('modal-use-week');
    delBtn.classList.toggle('hidden', !rid);
    delBtn.dataset.rid = rid || '';
    if (useWeekBtn) useWeekBtn.classList.toggle('hidden', !!rid || pendingNewRecipeDay === null || pendingNewRecipeDay === undefined);
    document.getElementById('recipe-name-input').value = rid ? recipes[rid].name : (pendingNewRecipeName || '');
    document.getElementById('ingredients-list').innerHTML = '';
    var ings = rid ? (recipes[rid].ingredients || []) : [];
    if (ings.length) ings.forEach(function(ing) { addIngredientRow(getIngName(ing.ingId) || ing.name || '', ing.qty); });
    else addIngredientRow();
    renderIconPicker(pendingIcon);
    updateSelectedIconButton();
    setIconPickerVisible(false);
    modalOverlay.classList.remove('hidden');
    document.getElementById('recipe-name-input').focus();
}

document.getElementById('recipe-name-input').addEventListener('input', function() {
    if (!pendingIcon) updateSelectedIconButton();
});

function closeModal() {
    modalOverlay.classList.add('hidden');
    editingId = null;
    pendingIcon = null;
    pendingNewRecipeDay = null;
    pendingNewRecipeName = '';
}

function setTemporaryRecipeForPendingDay() {
    if (pendingNewRecipeDay === null || pendingNewRecipeDay === undefined || editingId) return;
    var nameInput = document.getElementById('recipe-name-input');
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.style.borderColor = 'red'; return; }
    nameInput.style.borderColor = '';

    var rows = getRecipeRowsFromModal();
    if (!rows.length) {
        showToast('Adiciona pelo menos um ingrediente.', { type: 'error' });
        return;
    }
    if (!pendingIcon) pendingIcon = autoAssignIcon(name, rows);

    var tempId = createTempRecipeId();
    weekTempRecipes[tempId] = {
        name: name,
        icon: pendingIcon || DEFAULT_ICONS[0],
        ingredients: rows.map(function(row) {
            var ingId = getIngByName(row.name);
            if (ingId) return { ingId: ingId, qty: row.qty };
            return { name: row.name, qty: row.qty };
        })
    };

    week[pendingNewRecipeDay] = tempId;
    saveWeek(week);
    closeModal();
    refreshAllSelects();
}

function getSortedIngredientNames() {
    return Object.keys(ingredients)
        .map(function(id) { return ingredients[id].name; })
        .sort(function(a,b) { return a.localeCompare(b); });
}

function getIngredientSuggestions(query, limit) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];
    var names = getSortedIngredientNames();
    var starts = [];
    var contains = [];
    names.forEach(function(name) {
        var n = (name || '').toLowerCase();
        if (n.indexOf(q) === 0) starts.push(name);
        else if (n.indexOf(q) !== -1) contains.push(name);
    });
    return starts.concat(contains).slice(0, limit || 8);
}

function updateIngredientRowStatus(row) {
    var nameIn = row.querySelector('.ing-name');
    var status = row.querySelector('.ing-name-status');
    if (!nameIn || !status) return;

    var name = nameIn.value.trim();
    if (!name) {
        status.textContent = '';
        status.classList.add('hidden');
        status.classList.remove('is-existing');
        status.classList.remove('is-new');
        return;
    }
    var existingId = getIngByName(name);
    status.classList.remove('hidden');
    if (existingId) {
        status.textContent = 'Existente';
        status.classList.add('is-existing');
        status.classList.remove('is-new');
    } else {
        status.textContent = 'Novo ingrediente';
        status.classList.add('is-new');
        status.classList.remove('is-existing');
    }
}

function addIngredientRow(name, qty) {
    name = name || ''; qty = qty || '';
    var row = document.createElement('div');
    row.className = 'ingredient-row';

    var nameWrap = document.createElement('div');
    nameWrap.className = 'ing-name-wrap';

    var nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.placeholder = 'Ingrediente'; nameIn.value = name;
    nameIn.className = 'ing-name';

    var nameTop = document.createElement('div');
    nameTop.className = 'ing-name-top';

    var nameStatus = document.createElement('span');
    nameStatus.className = 'ing-name-status hidden';

    var suggestBox = document.createElement('div');
    suggestBox.className = 'ing-suggest hidden';
    var suggestList = document.createElement('ul');
    suggestList.className = 'ing-suggest-list';
    suggestBox.appendChild(suggestList);

    var activeSuggestion = -1;
    var rowMode = 'edit';

    function setRowMode(mode) {
        rowMode = mode;
        row.dataset.mode = mode;
        if (mode === 'selected') {
            nameIn.readOnly = true;
            nameIn.classList.add('is-selected');
            delBtn.dataset.mode = 'remove';
            delBtn.textContent = 'X';
            delBtn.title = 'Remover ingrediente';
            delBtn.classList.remove('is-confirm');
            statusWrapVisibility(false);
            hideSuggestions();
            return;
        }
        nameIn.readOnly = false;
        nameIn.classList.remove('is-selected');
        delBtn.dataset.mode = 'confirm';
        delBtn.textContent = '\u2713';
        delBtn.title = 'Confirmar ingrediente';
        delBtn.classList.add('is-confirm');
        statusWrapVisibility(true);
        updateIngredientRowStatus(row);
    }

    function statusWrapVisibility(show) {
        if (!nameStatus) return;
        if (!show) {
            nameStatus.classList.add('hidden');
            return;
        }
        if (nameIn.value.trim()) nameStatus.classList.remove('hidden');
    }

    function hideSuggestions() {
        suggestBox.classList.add('hidden');
        suggestBox.classList.remove('open-up');
        suggestBox.style.maxHeight = '';
        suggestList.innerHTML = '';
        activeSuggestion = -1;
    }

    function positionSuggestions() {
        var modalBody = nameIn.closest('.modal-body');
        if (!modalBody) {
            suggestBox.classList.remove('open-up');
            suggestBox.style.maxHeight = '';
            return;
        }
        var inputRect = nameIn.getBoundingClientRect();
        var bodyRect = modalBody.getBoundingClientRect();
        var spaceBelow = Math.max(0, bodyRect.bottom - inputRect.bottom - 6);
        var spaceAbove = Math.max(0, inputRect.top - bodyRect.top - 6);
        var desired = Math.min(180, suggestList.scrollHeight + 6);
        var minVisible = 92;

        var openUp = spaceBelow < Math.min(minVisible, desired) && spaceAbove > spaceBelow;
        var available = openUp ? spaceAbove : spaceBelow;
        var maxH = Math.max(80, Math.min(180, available));

        suggestBox.classList.toggle('open-up', openUp);
        suggestBox.style.maxHeight = maxH + 'px';
    }

    function chooseSuggestion(value) {
        nameIn.value = value;
        hideSuggestions();
        updateIngredientRowStatus(row);
        setRowMode('selected');
    }

    function updateSuggestionActive() {
        var items = suggestList.querySelectorAll('li');
        items.forEach(function(item, idx) {
            item.classList.toggle('active', idx === activeSuggestion);
        });
    }

    function renderSuggestions() {
        var v = nameIn.value.trim();
        var list = getIngredientSuggestions(v, 8);
        suggestList.innerHTML = '';
        activeSuggestion = -1;
        if (!list.length) {
            suggestBox.classList.add('hidden');
            return;
        }
        list.forEach(function(s) {
            var li = document.createElement('li');
            li.className = 'ing-suggest-item';
            li.dataset.value = s;
            var label = document.createElement('span');
            label.className = 'ing-suggest-label';
            label.textContent = s;
            var meta = document.createElement('span');
            meta.className = 'ing-suggest-meta';
            meta.textContent = 'Existente';
            li.appendChild(label);
            li.appendChild(meta);
            li.addEventListener('mousedown', function(e) {
                e.preventDefault();
                chooseSuggestion(s);
            });
            suggestList.appendChild(li);
        });
        suggestBox.classList.remove('hidden');
        positionSuggestions();
    }

    nameTop.appendChild(nameIn);
    nameTop.appendChild(nameStatus);
    nameWrap.appendChild(nameTop);
    nameWrap.appendChild(suggestBox);

    var qtyVal = parseFloat(qty);
    if (isNaN(qtyVal) || qtyVal <= 0) qtyVal = 1;
    qtyVal = Math.round(qtyVal * 1000) / 1000;

    var qtyStepper = document.createElement('div');
    qtyStepper.className = 'ing-qty-stepper';
    var minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'stepper-btn';
    minusBtn.textContent = '\u2212';
    minusBtn.title = 'Diminuir quantidade';
    var qtySpan = document.createElement('span');
    qtySpan.className = 'stepper-val ing-qty-val';
    qtySpan.textContent = qtyVal;
    var plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'stepper-btn';
    plusBtn.textContent = '+';
    plusBtn.title = 'Aumentar quantidade';

    minusBtn.addEventListener('click', function() {
        if (qtyVal > 1) {
            qtyVal = Math.round((qtyVal - 1) * 1000) / 1000;
            qtySpan.textContent = qtyVal;
        }
    });
    plusBtn.addEventListener('click', function() {
        qtyVal = Math.round((qtyVal + 1) * 1000) / 1000;
        qtySpan.textContent = qtyVal;
    });

    qtyStepper.appendChild(minusBtn);
    qtyStepper.appendChild(qtySpan);
    qtyStepper.appendChild(plusBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-icon ing-row-action';
    delBtn.textContent = '\u2713';
    delBtn.type = 'button';
    delBtn.dataset.mode = 'confirm';
    delBtn.title = 'Confirmar ingrediente';
    delBtn.classList.add('is-confirm');
    delBtn.addEventListener('click', function() {
        if (rowMode === 'edit') {
            if (!nameIn.value.trim()) {
                nameIn.focus();
                nameIn.style.borderColor = 'red';
                return;
            }
            nameIn.style.borderColor = '';
            setRowMode('selected');
            return;
        }
        row.remove();
    });

    nameIn.addEventListener('input', function() {
        if (rowMode !== 'edit') setRowMode('edit');
        nameIn.style.borderColor = '';
        updateIngredientRowStatus(row);
        renderSuggestions();
    });
    nameIn.addEventListener('focus', function() {
        if (rowMode === 'selected') return;
        renderSuggestions();
    });
    nameIn.addEventListener('blur', function() {
        setTimeout(function() { hideSuggestions(); }, 120);
    });
    nameIn.addEventListener('keydown', function(e) {
        var items = suggestList.querySelectorAll('li');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1);
            updateSuggestionActive();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestion = Math.max(activeSuggestion - 1, 0);
            updateSuggestionActive();
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            if (activeSuggestion >= 0 && activeSuggestion < items.length) {
                if (e.key === 'Enter') e.preventDefault();
                chooseSuggestion(items[activeSuggestion].dataset.value || items[activeSuggestion].textContent);
            }
            return;
        }
        if (e.key === 'Escape') {
            hideSuggestions();
        }
    });
    nameIn.addEventListener('change', function() { updateIngredientRowStatus(row); });
    updateIngredientRowStatus(row);
    if (name.trim()) setRowMode('selected');

    row.appendChild(nameWrap); row.appendChild(qtyStepper); row.appendChild(delBtn);
    document.getElementById('ingredients-list').appendChild(row);
}

function rebuildDatalist() {
    var dl = document.getElementById('ing-datalist');
    dl.innerHTML = '';
    getSortedIngredientNames().forEach(function(n) {
        var opt = document.createElement('option'); opt.value = n; dl.appendChild(opt);
    });
}

document.getElementById('add-ingredient-row').addEventListener('click', function() { rebuildDatalist(); addIngredientRow(); });
document.getElementById('open-add-recipe').addEventListener('click', function() {
    pendingNewRecipeDay = null;
    pendingNewRecipeName = '';
    rebuildDatalist();
    openAddModal(null);
});
document.getElementById('selected-icon-btn').addEventListener('click', function() {
    var wrap = document.getElementById('icon-picker-wrap');
    if (!wrap) return;
    setIconPickerVisible(wrap.classList.contains('hidden'));
});
document.getElementById('modal-use-week').addEventListener('click', setTemporaryRecipeForPendingDay);
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

function getRecipeRowsFromModal() {
    var rows = [];
    document.getElementById('ingredients-list').querySelectorAll('.ingredient-row').forEach(function(row) {
        var name = row.querySelector('.ing-name').value.trim();
        var qtyValEl = row.querySelector('.ing-qty-val');
        var qty = qtyValEl ? String(qtyValEl.textContent).trim() : '1';
        if (!name) return;
        rows.push({ name: name, qty: qty || '1' });
    });
    return rows;
}

function hasRecipeNameConflict(recipeName, currentId) {
    var key = (recipeName || '').trim().toLowerCase();
    if (!key) return false;
    return Object.keys(recipes).some(function(rid) {
        if (currentId && rid === currentId) return false;
        return ((recipes[rid] && recipes[rid].name) || '').trim().toLowerCase() === key;
    });
}

function mergeLocalIngredientsIntoDict(targetDict) {
    Object.keys(ingredients).forEach(function(id) {
        if (!targetDict[id]) targetDict[id] = ingredients[id];
    });
}

function saveRecipeWithIngredientsAtomic(recipeId, recipeName, rows, icon, options) {
    var opts = options || {};
    var allowCreateIngredients = opts.allowCreateIngredients !== false;
    var ingredientsRef = db.collection('data').doc('ingredients');
    var recipeRef = db.collection('recipes').doc(recipeId);
    return db.runTransaction(function(tx) {
        return tx.get(ingredientsRef).then(function(ingDoc) {
            var remoteDict = (ingDoc.exists && ingDoc.data() && ingDoc.data().dict) ? ingDoc.data().dict : {};
            var mergedDict = Object.assign({}, remoteDict);
            mergeLocalIngredientsIntoDict(mergedDict);

            var byName = {};
            Object.keys(mergedDict).forEach(function(id) {
                var n = ((mergedDict[id] && mergedDict[id].name) || '').trim().toLowerCase();
                if (n && !byName[n]) byName[n] = id;
            });

            var parsedIngs = [];
            var dictChanged = false;

            rows.forEach(function(row) {
                var key = row.name.trim().toLowerCase();
                if (!key) return;
                var ingId = byName[key];
                if (!ingId && allowCreateIngredients) {
                    ingId = slugId(row.name, Object.keys(mergedDict));
                    mergedDict[ingId] = { name: row.name, categoria: autoAssignCategoria(row.name) };
                    byName[key] = ingId;
                    dictChanged = true;
                }
                if (ingId) parsedIngs.push({ ingId: ingId, qty: row.qty });
                else parsedIngs.push({ name: row.name, qty: row.qty });
            });

            if (!parsedIngs.length && !opts.allowDraft) {
                var noIngErr = new Error('RECIPE_WITHOUT_INGREDIENTS');
                noIngErr.code = 'RECIPE_WITHOUT_INGREDIENTS';
                throw noIngErr;
            }

            var recipeData = { name: recipeName, ingredients: parsedIngs, icon: icon || DEFAULT_ICONS[0] };
            var existing = recipes[recipeId];
            if (existing && existing.tier) recipeData.tier = existing.tier;
            recipeData.createdAt = (existing && existing.createdAt) || new Date().toISOString();
            tx.set(recipeRef, recipeData);
            if (dictChanged && allowCreateIngredients) tx.set(ingredientsRef, { dict: mergedDict });

            return {
                recipeId: recipeId,
                recipeData: recipeData,
                mergedDict: mergedDict,
                dictChanged: dictChanged
            };
        });
    });
}

document.getElementById('modal-save').addEventListener('click', function() {
    var saveBtn = this;
    var nameInput = document.getElementById('recipe-name-input');
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.style.borderColor='red'; return; }
    if (hasRecipeNameConflict(name, editingId)) {
        showToast('Já existe uma receita com esse nome.', { type: 'error' });
        nameInput.focus();
        return;
    }
    nameInput.style.borderColor='';
    var rows = getRecipeRowsFromModal();
    var fromWeekFlowCheck = pendingNewRecipeDay !== null && pendingNewRecipeDay !== undefined;
    if (!rows.length && fromWeekFlowCheck) {
        showToast('Adiciona pelo menos um ingrediente.', { type: 'error' });
        return;
    }
    var isDraft = !rows.length;
    if (!pendingIcon) pendingIcon = autoAssignIcon(name, rows);

    saveBtn.disabled = true;
    var oldLabel = saveBtn.textContent;
    saveBtn.textContent = 'A guardar...';

    var id = editingId || slugId(name, Object.keys(recipes));
    var fromWeekFlow = pendingNewRecipeDay !== null && pendingNewRecipeDay !== undefined;
    function resetSaveButton() {
        saveBtn.disabled = false;
        saveBtn.textContent = oldLabel;
    }

    saveRecipeWithIngredientsAtomic(id, name, rows, pendingIcon, { allowCreateIngredients: !fromWeekFlow, allowDraft: isDraft })
        .then(function(result) {
            if (isDraft) showToast('Guardada como rascunho \u2014 acrescenta os ingredientes quando der jeito.', { type: 'success' });
            var dayToFill = pendingNewRecipeDay;
            if (result.dictChanged) ingredients = result.mergedDict;
            recipes[result.recipeId] = result.recipeData;
            if (dayToFill !== null && dayToFill !== undefined) {
                week[dayToFill] = result.recipeId;
                saveWeek(week);
                refreshDayCard(dayToFill);
            }
            closeModal();
            refreshAllSelects();
            renderRecipesGrid();
            renderIngredientsDict();
            resetSaveButton();
        })
        .catch(function(err) {
            console.error(err);
            if (err && err.code === 'RECIPE_WITHOUT_INGREDIENTS') {
                showToast('Adiciona pelo menos um ingrediente.', { type: 'error' });
                resetSaveButton();
                return;
            }
            showToast('Não foi possível guardar agora. Tenta novamente.', { type: 'error' });
            resetSaveButton();
        });
});

// ---- View Modal -------------------------------------------------------------

var viewOverlay = document.getElementById('view-overlay');
var viewingId   = null;

function openViewModal(rid) {
    viewingId = rid;
    var r = getWeekRecipeById(rid);
    if (!r) return;
    var editBtn = document.getElementById('view-edit');
    var deleteBtn = document.getElementById('view-delete');
    if (editBtn) editBtn.classList.toggle('hidden', !!r.isTemp);
    if (deleteBtn) deleteBtn.classList.toggle('hidden', !!r.isTemp);
    document.getElementById('view-title').textContent = r.name;
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
            var ingName = getIngName(ing.ingId) || ing.name || '';
            var liLeft = document.createElement('span');
            liLeft.className = 'ing-name-line';
            var liIcon = document.createElement('span');
            liIcon.className = 'ing-cat-badge';
            liIcon.textContent = getCatIcon(ing.ingId, ingName);
            liIcon.title = getIngCategoria(ing.ingId || '');
            var liName = document.createElement('span');
            liName.textContent = ingName;
            liLeft.appendChild(liIcon);
            liLeft.appendChild(liName);
            var liQty = document.createElement('span');
            liQty.className = 'view-ingredient-qty';
            liQty.textContent = ing.qty;
            li.appendChild(liLeft);
            li.appendChild(liQty);
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
    var subtabs = ['receitas-grid', 'ingredientes-dict', 'import-json'];
    function switchSubtab(name) {
        document.querySelectorAll('.subtab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.subtab === name);
        });
        subtabs.forEach(function(id) {
            var el = document.getElementById('subtab-' + id);
            if (el) el.classList.toggle('hidden', id !== name);
        });
    }
    document.querySelectorAll('.subtab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchSubtab(btn.dataset.subtab); });
    });
    switchSubtab('receitas-grid');
})();

// Histórico button in Semana tab
(function() {
    var btn = document.getElementById('historico-week-btn');
    var panel = document.getElementById('semana-historico-panel');
    var weekGrid = document.getElementById('week-grid');
    var extrasSection = document.getElementById('semana-extras-section');
    var ctaBar = document.getElementById('week-cta-bar');
    var quick = document.getElementById('quicklist');
    if (!btn || !panel) return;
    btn.addEventListener('click', function() {
        var isHidden = panel.classList.contains('hidden');
        if (ctaBar) ctaBar.classList.toggle('hidden', isHidden);
        if (isHidden) {
            historyIdx = 0;
            renderHistorico();
            panel.classList.remove('hidden');
            if (weekGrid) weekGrid.classList.add('hidden');
            if (extrasSection) extrasSection.classList.add('hidden');
            if (quick) quick.classList.add('hidden');
            btn.classList.add('active');
            btn.innerHTML = '&#x1F4C5; Esta Semana';
        } else {
            panel.classList.add('hidden');
            if (weekGrid) weekGrid.classList.remove('hidden');
            if (extrasSection) extrasSection.classList.remove('hidden');
            if (quick) quick.classList.remove('hidden');
            btn.classList.remove('active');
            btn.innerHTML = '&#x1F4C5; Hist&#xF3;rico';
        }
    });
})();

// ---- Export -----------------------------------------------------------------

// ---- Export -----------------------------------------------------------------

function csvCell(val) {
    var s = String(val === null || val === undefined ? '' : val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function exportData() {
    // Find max ingredient count across all recipes
    var maxIngs = 0;
    Object.keys(recipes).forEach(function(id){
        var n = (recipes[id].ingredients || []).length;
        if (n > maxIngs) maxIngs = n;
    });

    // Build header: type, id, name, categoria, icon, ing1_name, ing1_id, ing1_qty, ...
    var header = ['type', 'id', 'name', 'categoria', 'icon'];
    for (var j = 1; j <= maxIngs; j++) {
        header.push('ing' + j + '_name');
        header.push('ing' + j + '_id');
        header.push('ing' + j + '_qty');
    }

    var rows = [header];

    Object.keys(ingredients)
        .sort(function(a,b){ return ingredients[a].name.localeCompare(ingredients[b].name); })
        .forEach(function(id){
            var ing = ingredients[id];
            var row = ['ingredient', id, ing.name, ing.categoria || '', ''];
            for (var m = 0; m < maxIngs * 3; m++) row.push('');
            rows.push(row);
        });

    Object.keys(recipes)
        .sort(function(a,b){ return recipes[a].name.localeCompare(recipes[b].name); })
        .forEach(function(id){
            var rec = recipes[id];
            var ings = rec.ingredients || [];
            var row = ['recipe', id, rec.name, '', rec.icon || ''];
            for (var n = 0; n < maxIngs; n++) {
                if (n < ings.length) {
                    row.push(ings[n].ingId ? getIngName(ings[n].ingId) : (ings[n].name || ''));
                    row.push(ings[n].ingId || '');
                    row.push(ings[n].qty || '');
                } else {
                    row.push('', '', '');
                }
            }
            rows.push(row);
        });

    var csv = rows.map(function(row){ return row.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = 'receitas-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('export-btn').addEventListener('click', exportData);

// ---- Import CSV -------------------------------------------------------------

function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    while (i < text.length) {
        var c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false;
            } else { field += c; }
        } else {
            if (c === '"') { inQuotes = true; }
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\r' || c === '\n') {
                row.push(field); field = '';
                if (row.some(function(v){ return v !== ''; })) rows.push(row);
                row = [];
                if (c === '\r' && text[i + 1] === '\n') i++;
            } else { field += c; }
        }
        i++;
    }
    if (field !== '' || row.length) { row.push(field); if (row.some(function(v){ return v !== ''; })) rows.push(row); }
    return rows;
}

function parseImportCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) throw new Error('Ficheiro vazio ou sem dados');
    var header = rows[0].map(function(h){ return h.trim().toLowerCase(); });
    var col = function(name) { return header.indexOf(name); };
    var typeIdx = col('type'), nameIdx = col('name');
    if (typeIdx === -1 || nameIdx === -1) throw new Error('Cabeçalho invalido: faltam colunas "type" e "name"');
    var categoriaIdx = col('categoria'), iconIdx = col('icon'), idIdx = col('id');

    // Detect ing1_name, ing1_id, ing1_qty columns (interleaved new format and legacy separated format)
    var ingNameIdxs = [], ingIdIdxs = [], ingQtyIdxs = [];
    header.forEach(function(h, i) {
        if (/^ing\d+_name$/.test(h)) ingNameIdxs.push({ n: parseInt(h.replace(/\D/g,''), 10), i: i });
        if (/^ing\d+_id$/.test(h))   ingIdIdxs.push({ n: parseInt(h.replace(/\D/g,''), 10), i: i });
        if (/^ing\d+_qty$/.test(h))  ingQtyIdxs.push({ n: parseInt(h.replace(/\D/g,''), 10), i: i });
    });
    ingNameIdxs.sort(function(a,b){ return a.n - b.n; });
    ingIdIdxs.sort(function(a,b){ return a.n - b.n; });
    ingQtyIdxs.sort(function(a,b){ return a.n - b.n; });

    // Build lookup maps by ingredient number
    var ingIdColByN = {};
    ingIdIdxs.forEach(function(e){ ingIdColByN[e.n] = e.i; });
    var ingQtyColByN = {};
    ingQtyIdxs.forEach(function(e){ ingQtyColByN[e.n] = e.i; });

    var result = { ingredients: [], recipes: [] };
    for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var type = (row[typeIdx] || '').trim().toLowerCase();
        var name = (row[nameIdx] || '').trim();
        if (!name) continue;
        var csvId = idIdx !== -1 ? (row[idIdx] || '').trim() : '';
        if (type === 'ingredient') {
            result.ingredients.push({
                id: csvId || null,
                name: name,
                categoria: categoriaIdx !== -1 ? (row[categoriaIdx] || '').trim() || null : null
            });
        } else if (type === 'recipe') {
            var ings = [];
            for (var ni = 0; ni < ingNameIdxs.length; ni++) {
                var ingName = (row[ingNameIdxs[ni].i] || '').trim();
                if (!ingName) continue;
                var ingNumN = ingNameIdxs[ni].n;
                var ingCsvId = ingIdColByN[ingNumN] !== undefined ? (row[ingIdColByN[ingNumN]] || '').trim() : '';
                var ingQty = ingQtyColByN[ingNumN] !== undefined ? (row[ingQtyColByN[ingNumN]] || '').trim() : '0';
                ings.push({ name: ingName, ingId: ingCsvId || null, qty: ingQty || '0' });
            }
            result.recipes.push({
                id: csvId || null,
                name: name,
                icon: iconIdx !== -1 ? (row[iconIdx] || '').trim() : '',
                ingredients: ings
            });
        }
    }
    return result;
}

document.getElementById('import-file-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        e.target.value = '';
        var data;
        try { data = parseImportCSV(ev.target.result); } catch(err) { showToast('Ficheiro CSV inválido: ' + err.message, { type: 'error', duration: 6000 }); return; }
        openImportModal(data);
    };
    reader.readAsText(file, 'UTF-8');
});

var importOverlay  = document.getElementById('import-overlay');
var importData     = null; // { ingredients: [{name, isNew, mappedTo}], recipes: [{...}] }

function openImportModal(raw) {
    var rawIngs = Array.isArray(raw.ingredients) ? raw.ingredients.filter(function(n){
        return (typeof n === 'string' && n.trim()) || (n && typeof n === 'object' && n.name && String(n.name).trim());
    }) : [];
    var rawRecipes = Array.isArray(raw.recipes) ? raw.recipes : [];

    importData = {
        ingredients: rawIngs.map(function(n) {
            var name = typeof n === 'string' ? n.trim() : String(n.name || '').trim();
            var categoria = (n && typeof n === 'object') ? (n.categoria || null) : null;
            var csvId = (n && typeof n === 'object') ? (n.id || null) : null;
            // Match by ID first, then fall back to name
            var existId = (csvId && ingredients[csvId]) ? csvId :
                (Object.keys(ingredients).find(function(id){ return ingredients[id].name.toLowerCase() === name.toLowerCase(); }) || null);
            return { id: csvId, name: name, categoria: categoria, isNew: !existId, mappedTo: existId || null, deleted: false };
        }),
        recipes: rawRecipes.map(function(r) {
            return {
                id: (r.id || null),
                name: (r.name || '').trim(),
                icon: (r.icon || ''),
                ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(function(i){
                    return { name: (i.name||'').trim(), ingId: (i.ingId || null), qty: String(i.qty||'0'), deleted: false };
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

            var delRecBtn = document.createElement('button');
            delRecBtn.className = 'btn-icon'; delRecBtn.textContent = '\u2715'; delRecBtn.title = 'Remover receita';
            delRecBtn.addEventListener('click', function() { importData.recipes[recIdx].deleted = true; renderImportModal(); });

            cardHeader.appendChild(nameInput); cardHeader.appendChild(delRecBtn);
            card.appendChild(cardHeader);

            // ingredients of recipe
            var ingList = document.createElement('ul');
            ingList.className = 'import-recipe-ings';
            (rec.ingredients || []).filter(function(i){ return !i.deleted; }).forEach(function(ing) {
                var ingIdx = rec.ingredients.indexOf(ing);
                // find if ingredient is known
                var known = (ing.ingId && ingredients[ing.ingId]) ||
                    getIngByName(ing.name) !== null ||
                    importData.ingredients.some(function(ii){ return !ii.deleted && (ii.mappedTo ? ingredients[ii.mappedTo] && ingredients[ii.mappedTo].name.toLowerCase() === ing.name.toLowerCase() : ii.name.toLowerCase() === ing.name.toLowerCase()); });
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
    var ingDictChanged = false;
    importData.ingredients.filter(function(i){ return !i.deleted; }).forEach(function(item) {
        if (item.mappedTo) {
            // Existing ingredient — apply any name / categoria changes from the CSV
            var existing = ingredients[item.mappedTo];
            if (existing) {
                if (item.name && existing.name !== item.name) { existing.name = item.name; ingDictChanged = true; }
                if (item.categoria && existing.categoria !== item.categoria) { existing.categoria = item.categoria; ingDictChanged = true; }
            }
            return;
        }
        var exists = getIngByName(item.name);
        if (!exists) {
            // Preserve the CSV id if it doesn't conflict with an existing entry
            var newId = (item.id && !ingredients[item.id]) ? item.id : slugId(item.name, Object.keys(ingredients));
            var newIng = { name: item.name };
            if (item.categoria) newIng.categoria = item.categoria;
            ingredients[newId] = newIng;
            item.mappedTo = newId; // so getIngId() can resolve it immediately
            count.ing++;
            ingDictChanged = true;
        }
    });
    if (ingDictChanged) saveIngredients(ingredients);

    // Build lookup: resolve an ingredient id from (name, optional csvIngId)
    function getIngId(name, csvIngId) {
        // Direct ID match takes priority
        if (csvIngId && ingredients[csvIngId]) return csvIngId;
        // Check import mappings
        var mapped = importData.ingredients.find(function(i){ return i.name.toLowerCase() === name.toLowerCase() && i.mappedTo; });
        if (mapped) return mapped.mappedTo;
        return getIngByName(name);
    }

    // 2. Recipes
    var ingChanged2 = false;
    importData.recipes.filter(function(r){ return !r.deleted && r.name; }).forEach(function(rec) {
        var ings = (rec.ingredients||[]).filter(function(i){ return !i.deleted && i.name; }).map(function(i) {
            var ingId = getIngId(i.name, i.ingId);
            if (!ingId) {
                // Preserve the CSV ingId if it doesn't conflict
                ingId = (i.ingId && !ingredients[i.ingId]) ? i.ingId : slugId(i.name, Object.keys(ingredients));
                ingredients[ingId] = { name: i.name };
                ingChanged2 = true;
            }
            return { ingId: ingId, qty: i.qty };
        });
        // Update if the recipe ID already exists; otherwise create with that ID (or a new one)
        var id = rec.id ? rec.id : slugId(rec.name, Object.keys(recipes));
        var recIcon = rec.icon || autoAssignIcon(rec.name, ings.map(function(i){ return { name: getIngName(i.ingId) }; })) || DEFAULT_ICONS[0];
        var prevRec = recipes[id] || {};
        recipes[id] = { name: rec.name, ingredients: ings, icon: recIcon, createdAt: prevRec.createdAt || new Date().toISOString() };
        if (prevRec.tier) recipes[id].tier = prevRec.tier;
        saveRecipe(id, recipes[id]); count.rec++;
    });
    if (ingChanged2) saveIngredients(ingredients);

    closeImportModal();
    renderIngredientsDict();
    refreshAllSelects(); renderRecipesGrid();
    showToast('Importado: ' + count.rec + ' receita(s), ' + count.ing + ' ingrediente(s) novo(s).', { type: 'success', duration: 5000 });
});

// ---- Mobile tab navigation --------------------------------------------------

var TAB_SECTIONS = {
    lista:    'section-lista',
    semana:   'section-semana',
    receitas: 'section-receitas'
};

function switchTab(name) {
    if (!TAB_SECTIONS[name]) name = 'semana';
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === name);
    });
    Object.keys(TAB_SECTIONS).forEach(function(t) {
        document.getElementById(TAB_SECTIONS[t]).classList.toggle('tab-active', t === name);
    });
    var main = document.querySelector('main');
    if (main) main.scrollTop = 0;
}

document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
});

switchTab('semana');

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
        var newIcon = autoAssignIcon(recipes[id].name, resolveIngNames(recipes[id].ingredients));
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
        showToast(msg, { type: 'success', duration: 5000 });
    }
}

function deduplicateAndFixIcons() { _runDedup(false); }
function deduplicateAndFixIconsSilent() { _runDedup(true); }

// ---- Init (triggered by Firestore via _checkReady) --------------------------

function autoCategorizeIngredients() {
    var changed = false;
    Object.keys(ingredients).forEach(function(id) {
        if (!ingredients[id].categoria) {
            ingredients[id].categoria = autoAssignCategoria(ingredients[id].name);
            changed = true;
        } else if (ingredients[id].categoria === 'Outros' && autoAssignCategoria(ingredients[id].name) === 'Casa e Higiene') {
            ingredients[id].categoria = 'Casa e Higiene';
            changed = true;
        }
    });
    if (changed) saveIngredients(ingredients);
}

function migrateIngredientsToIngId() {
    var ingChanged = false;
    var recipesToSave = [];
    Object.keys(recipes).forEach(function(rid) {
        var r = recipes[rid];
        var changed = false;
        var newIngs = (r.ingredients || []).map(function(ing) {
            if (ing.ingId !== undefined) return ing; // already migrated
            var name = (ing.name || '').trim();
            if (!name) return ing;
            var id = getIngByName(name);
            if (!id) {
                id = slugId(name, Object.keys(ingredients));
                ingredients[id] = { name: name, categoria: autoAssignCategoria(name) };
                ingChanged = true;
            }
            changed = true;
            return { ingId: id, qty: ing.qty };
        });
        if (changed) {
            recipes[rid] = Object.assign({}, r, { ingredients: newIngs });
            recipesToSave.push(rid);
        }
    });
    if (ingChanged) saveIngredients(ingredients);
    recipesToSave.forEach(function(rid) { saveRecipe(rid, recipes[rid]); });
    if (recipesToSave.length) {
        console.log('[migrate] migrated ' + recipesToSave.length + ' recipe(s) to ingId format');
    }
}
