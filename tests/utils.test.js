'use strict';

const { autoAssignIcon, esc, uid, DEFAULT_ICONS, CATEGORIAS, autoAssignCategoria, getRecipeFoodType, getEnSynonym, weekdayIndex, countPlannedMeals, pickStartTab, plural, DAY_MS, HOUSE_LOCATIONS, getHouseLocation, matchHistoryRecipe, slotWasCooked, computeRecipeStats, timeAgoLabel, DEFAULT_RECURRING_EVERY, recurringDaysLeft, isRecurringDue, updateRecurringOnPurchase, updateHaveStats, usuallyHave, nextWeekStatus, countWeekStatuses } = require('../utils');

// ---------------------------------------------------------------------------
// UX helpers
// ---------------------------------------------------------------------------

describe('weekdayIndex', () => {
    test('Monday → 0', () => { expect(weekdayIndex(new Date(2026, 9, 19))).toBe(0); });
    test('Thursday → 3', () => { expect(weekdayIndex(new Date(2026, 9, 22))).toBe(3); });
    test('Sunday → 6', () => { expect(weekdayIndex(new Date(2026, 9, 25))).toBe(6); });
    test('defaults to today', () => { expect(weekdayIndex()).toBe((new Date().getDay() + 6) % 7); });
});

describe('countPlannedMeals', () => {
    test('counts only filled days', () => {
        expect(countPlannedMeals({ '0': 'a', '1': null, '3': 'b', '4': '' })).toBe(2);
    });
    test('handles empty / missing week', () => {
        expect(countPlannedMeals({})).toBe(0);
        expect(countPlannedMeals(null)).toBe(0);
    });
});

describe('pickStartTab', () => {
    test('opens the list when there is something to buy', () => { expect(pickStartTab(3)).toBe('lista'); });
    test('opens the week otherwise', () => { expect(pickStartTab(0)).toBe('semana'); });
});

describe('plural', () => {
    test('singular', () => { expect(plural(1, 'refeição', 'refeições')).toBe('1 refeição'); });
    test('plural', () => { expect(plural(0, 'refeição', 'refeições')).toBe('0 refeições'); });
    test('plural many', () => { expect(plural(4, 'item', 'itens')).toBe('4 itens'); });
});

// ---------------------------------------------------------------------------
// autoAssignIcon
// ---------------------------------------------------------------------------

describe('autoAssignIcon — name matching', () => {
    test('pasta name → 🍝', () => {
        expect(autoAssignIcon('Esparguete à Bolonhesa', [])).toBe('🍝');
    });
    test('pizza name → 🍕', () => {
        expect(autoAssignIcon('Pizza Margherita', [])).toBe('🍕');
    });
    test('sopa name → 🍲', () => {
        expect(autoAssignIcon('Sopa de Legumes', [])).toBe('🍲');
    });
    test('chicken name → 🍗', () => {
        expect(autoAssignIcon('Frango no Forno', [])).toBe('🍗');
    });
    test('salmon name → 🐟', () => {
        expect(autoAssignIcon('Salmão Grelhado', [])).toBe('🐟');
    });
    test('burger name → 🍔', () => {
        expect(autoAssignIcon('Hamburguer Caseiro', [])).toBe('🍔');
        expect(autoAssignIcon('Bacon Burger', [])).toBe('🍔'); // hamburguer rule before ham
    });
    test('salad name → 🥗', () => {
        expect(autoAssignIcon('Caesar Salad', [])).toBe('🥗');
    });
    test('curry name → 🍛', () => {
        expect(autoAssignIcon('Chicken Tikka Masala', [])).toBe('🍛');
    });
    test('sushi name → 🍣', () => {
        expect(autoAssignIcon('Sushi Misto', [])).toBe('🍣');
    });
    test('taco name → 🌮', () => {
        expect(autoAssignIcon('Tacos de Carne', [])).toBe('🌮');
    });
    test('cake name → 🎂', () => {
        expect(autoAssignIcon('Bolo de Chocolate', [])).toBe('🎂');
    });
    test('rice name → 🍚', () => {
        expect(autoAssignIcon('Arroz Basmati', [])).toBe('🍚');
        expect(autoAssignIcon('Risotto de Cogumelos', [])).toBe('🍚');
    });
});

describe('autoAssignIcon — ingredient fallback', () => {
    test('unknown name, chicken ingredient → 🍗', () => {
        expect(autoAssignIcon('Prato Especial', [{ name: 'Frango' }, { name: 'Alho' }])).toBe('🍗');
    });
    test('unknown name, bacon ingredient → 🥓', () => {
        expect(autoAssignIcon('Wrap Especial', [{ name: 'Bacon' }, { name: 'Alface' }])).toBe('🌯');
        // "wrap" in name matches wrap rule first
    });
    test('unknown name, no matching ingredients → default icon', () => {
        expect(autoAssignIcon('Prato Misterioso', [{ name: 'Água' }, { name: 'Sal' }])).toBe(DEFAULT_ICONS[0]);
    });
});

describe('autoAssignIcon — edge cases', () => {
    test('empty name and empty ingredients → default icon', () => {
        expect(autoAssignIcon('', [])).toBe(DEFAULT_ICONS[0]);
    });
    test('null name → does not throw', () => {
        expect(() => autoAssignIcon(null, [])).not.toThrow();
    });
    test('null ingredients → does not throw', () => {
        expect(() => autoAssignIcon('Pizza', null)).not.toThrow();
    });
    test('case-insensitive match', () => {
        expect(autoAssignIcon('PIZZA', [])).toBe('🍕');
        expect(autoAssignIcon('Spaghetti', [])).toBe('🍝');
    });
    test('returns string (emoji)', () => {
        expect(typeof autoAssignIcon('Pizza', [])).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// esc
// ---------------------------------------------------------------------------

describe('esc — HTML escaping', () => {
    test('escapes ampersand', () => {
        expect(esc('a & b')).toBe('a &amp; b');
    });
    test('escapes less-than', () => {
        expect(esc('<script>')).toBe('&lt;script&gt;');
    });
    test('escapes greater-than', () => {
        expect(esc('a > b')).toBe('a &gt; b');
    });
    test('escapes all three at once', () => {
        expect(esc('<a & b>')).toBe('&lt;a &amp; b&gt;');
    });
    test('plain string unchanged', () => {
        expect(esc('hello world')).toBe('hello world');
    });
    test('null → empty string', () => {
        expect(esc(null)).toBe('');
    });
    test('undefined → empty string', () => {
        expect(esc(undefined)).toBe('');
    });
    test('number coerced to string', () => {
        expect(esc(42)).toBe('42');
    });
    test('empty string → empty string', () => {
        expect(esc('')).toBe('');
    });
});

// ---------------------------------------------------------------------------
// uid
// ---------------------------------------------------------------------------

describe('uid', () => {
    test('returns a non-empty string', () => {
        expect(typeof uid()).toBe('string');
        expect(uid().length).toBeGreaterThan(0);
    });
    test('two calls return different values', () => {
        expect(uid()).not.toBe(uid());
    });
    test('contains only alphanumeric characters', () => {
        expect(/^[a-z0-9]+$/i.test(uid())).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// CATEGORIAS
// ---------------------------------------------------------------------------

describe('CATEGORIAS', () => {
    test('is an array of 10 strings', () => {
        expect(Array.isArray(CATEGORIAS)).toBe(true);
        expect(CATEGORIAS).toHaveLength(10);
        CATEGORIAS.forEach(function(c) { expect(typeof c).toBe('string'); });
    });
    test('last item is "Outros"', () => {
        expect(CATEGORIAS[CATEGORIAS.length - 1]).toBe('Outros');
    });
    test('no duplicate entries', () => {
        var unique = [...new Set(CATEGORIAS)];
        expect(unique).toHaveLength(CATEGORIAS.length);
    });
    test('contains Lacticínios (correct spelling)', () => {
        expect(CATEGORIAS).toContain('Lacticínios');
    });
});

// ---------------------------------------------------------------------------
// autoAssignCategoria
// ---------------------------------------------------------------------------

describe('autoAssignCategoria', () => {
    test('frango → Carne e Peixe', () => { expect(autoAssignCategoria('Frango')).toBe('Carne e Peixe'); });
    test('salmão → Carne e Peixe (accented input)', () => { expect(autoAssignCategoria('Salmão')).toBe('Carne e Peixe'); });
    test('bacalhau → Carne e Peixe', () => { expect(autoAssignCategoria('Bacalhau')).toBe('Carne e Peixe'); });
    test('leite → Lacticínios', () => { expect(autoAssignCategoria('Leite')).toBe('Lacticínios'); });
    test('queijo → Lacticínios', () => { expect(autoAssignCategoria('Queijo')).toBe('Lacticínios'); });
    test('fiambre → Charcutaria', () => { expect(autoAssignCategoria('Fiambre')).toBe('Charcutaria'); });
    test('chouriço → Charcutaria (accented)', () => { expect(autoAssignCategoria('Chouriço')).toBe('Charcutaria'); });
    test('banana → Fruta', () => { expect(autoAssignCategoria('Banana')).toBe('Fruta'); });
    test('esparguete → Massas e Conservas', () => { expect(autoAssignCategoria('Esparguete')).toBe('Massas e Conservas'); });
    test('arroz → Massas e Conservas', () => { expect(autoAssignCategoria('Arroz')).toBe('Massas e Conservas'); });
    test('pão → Pão e Sobremesas (accented)', () => { expect(autoAssignCategoria('Pão')).toBe('Pão e Sobremesas'); });
    test('chocolate → Pão e Sobremesas', () => { expect(autoAssignCategoria('Chocolate')).toBe('Pão e Sobremesas'); });
    test('azeite → Condimentos', () => { expect(autoAssignCategoria('Azeite')).toBe('Condimentos'); });
    test('alho → Legumes e Vegetais', () => { expect(autoAssignCategoria('Alho')).toBe('Legumes e Vegetais'); });
    test('cenoura → Legumes e Vegetais', () => { expect(autoAssignCategoria('Cenoura')).toBe('Legumes e Vegetais'); });
    test('unknown → Outros', () => { expect(autoAssignCategoria('Ingrediente Misterioso')).toBe('Outros'); });
    test('null → Outros', () => { expect(autoAssignCategoria(null)).toBe('Outros'); });
    test('case insensitive', () => { expect(autoAssignCategoria('FRANGO')).toBe('Carne e Peixe'); });
    test('all results are in CATEGORIAS', () => {
        ['Frango','Leite','Fiambre','Banana','Esparguete','Pão','Azeite','Cenoura'].forEach(function(n) {
            expect(CATEGORIAS).toContain(autoAssignCategoria(n));
        });
    });
    // EN ingredient names (bilingual regex coverage)
    test('Chicken → Carne e Peixe', () => { expect(autoAssignCategoria('Chicken')).toBe('Carne e Peixe'); });
    test('Salmon → Carne e Peixe', () => { expect(autoAssignCategoria('Salmon')).toBe('Carne e Peixe'); });
    test('Milk → Lacticínios', () => { expect(autoAssignCategoria('Milk')).toBe('Lacticínios'); });
    test('Cheese → Lacticínios', () => { expect(autoAssignCategoria('Cheese')).toBe('Lacticínios'); });
    test('Bread → Pão e Sobremesas', () => { expect(autoAssignCategoria('Bread')).toBe('Pão e Sobremesas'); });
    // Household items
    test.each([
        'Papel higiénico', 'Guardanapos', 'Rolo de cozinha', 'Detergente loiça', 'Lixívia',
        'Sacos do lixo', 'Esponjas', 'Gel de banho', 'Champô', 'Pasta de dentes', 'Toalhitas'
    ])('%s → Casa e Higiene', (n) => { expect(autoAssignCategoria(n)).toBe('Casa e Higiene'); });
    test('pasta (food) still → Massas e Conservas', () => { expect(autoAssignCategoria('Pasta')).toBe('Massas e Conservas'); });
    test('sal still → Condimentos', () => { expect(autoAssignCategoria('Sal')).toBe('Condimentos'); });
});

// ---------------------------------------------------------------------------
// Weekly cycle helpers
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-10-23T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * DAY_MS).toISOString();
const entry = (n, slots) => ({ date: daysAgo(n), week: slots });
const cooked = (name, status) => ({ day: 'X', recipe: { name: name }, status: status });

describe('getHouseLocation', () => {
    test('dairy → frigo', () => { expect(getHouseLocation('Lacticínios')).toBe('frigo'); });
    test('fruit → frescos', () => { expect(getHouseLocation('Fruta')).toBe('frescos'); });
    test('pasta → despensa', () => { expect(getHouseLocation('Massas e Conservas')).toBe('despensa'); });
    test('household → casa', () => { expect(getHouseLocation('Casa e Higiene')).toBe('casa'); });
    test('unknown → outros', () => { expect(getHouseLocation('???')).toBe('outros'); });
    test('every category has a location', () => {
        CATEGORIAS.forEach((c) => {
            expect(HOUSE_LOCATIONS.some((l) => l.cats.indexOf(c) !== -1)).toBe(true);
        });
    });
});

describe('matchHistoryRecipe', () => {
    const recipes = { a: { name: 'Bolonhesa' }, b: { name: 'Frango' } };
    test('by id', () => { expect(matchHistoryRecipe({ id: 'b', name: 'zzz' }, recipes)).toBe('b'); });
    test('by name (case-insensitive) when id missing', () => { expect(matchHistoryRecipe({ name: ' bolonhesa ' }, recipes)).toBe('a'); });
    test('falls back to name when id was deleted', () => { expect(matchHistoryRecipe({ id: 'gone', name: 'Frango' }, recipes)).toBe('b'); });
    test('null when unknown', () => { expect(matchHistoryRecipe({ name: 'Pizza' }, recipes)).toBeNull(); });
    test('null for empty slot', () => { expect(matchHistoryRecipe(null, recipes)).toBeNull(); });
});

describe('slotWasCooked', () => {
    test('legacy slot without status counts', () => { expect(slotWasCooked(cooked('A'))).toBe(true); });
    test('done counts', () => { expect(slotWasCooked(cooked('A', 'done'))).toBe(true); });
    test('skip does not count', () => { expect(slotWasCooked(cooked('A', 'skip'))).toBe(false); });
    test('out does not count', () => { expect(slotWasCooked(cooked('A', 'out'))).toBe(false); });
    test('empty day does not count', () => { expect(slotWasCooked({ day: 'X', recipe: null })).toBe(false); });
});

describe('computeRecipeStats', () => {
    const recipes = {
        bol: { name: 'Bolonhesa' },
        fra: { name: 'Frango' },
        las: { name: 'Lasanha' },
        nov: { name: 'Nova', createdAt: daysAgo(3) },
        pin: { name: 'Bacalhau', tier: 'pin' },
        arc: { name: 'Caril', tier: 'archive' }
    };
    const history = [
        entry(7,  [cooked('Bolonhesa'), cooked('Frango', 'skip'), cooked('Caril')]),
        entry(14, [cooked('Bolonhesa'), cooked('Frango')]),
        entry(21, [cooked('Bolonhesa'), cooked('Caril'), cooked('Caril')]),
        entry(300, [cooked('Lasanha')])
    ];
    const stats = computeRecipeStats(recipes, history, NOW);

    test('counts only cooked days', () => {
        expect(stats.bol.count).toBe(3);
        expect(stats.fra.count).toBe(1);
    });
    test('lastCooked is the most recent cooked entry', () => {
        expect(stats.bol.lastCooked).toBe(Date.parse(daysAgo(7)));
        expect(stats.fra.lastCooked).toBe(Date.parse(daysAgo(14)));
    });
    test('3+ times in 12 weeks → habitual', () => { expect(stats.bol.tier).toBe('habitual'); });
    test('cooked recently but rarely → asvezes', () => { expect(stats.fra.tier).toBe('asvezes'); });
    test('not cooked for > 6 months → arquivo', () => { expect(stats.las.tier).toBe('arquivo'); });
    test('new recipe never cooked stays visible', () => { expect(stats.nov.tier).toBe('asvezes'); });
    test('pin overrides computed tier', () => {
        expect(stats.pin.tier).toBe('habitual');
        expect(stats.pin.manual).toBe('pin');
        expect(stats.pin.autoTier).toBe('arquivo');
    });
    test('archive overrides even a habitual recipe', () => {
        expect(stats.arc.autoTier).toBe('habitual');
        expect(stats.arc.tier).toBe('arquivo');
    });
    test('without any history nothing is archived', () => {
        const s = computeRecipeStats({ x: { name: 'X' } }, [], NOW);
        expect(s.x.tier).toBe('asvezes');
    });
    test('ignores entries with invalid dates', () => {
        const s = computeRecipeStats({ x: { name: 'X' } }, [{ date: 'nope', week: [cooked('X')] }], NOW);
        expect(s.x.count).toBe(0);
    });
});

describe('timeAgoLabel', () => {
    test('null → nunca', () => { expect(timeAgoLabel(null, NOW)).toBe('nunca'); });
    test('today', () => { expect(timeAgoLabel(NOW - 3600e3, NOW)).toBe('hoje'); });
    test('yesterday', () => { expect(timeAgoLabel(NOW - DAY_MS, NOW)).toBe('ontem'); });
    test('days', () => { expect(timeAgoLabel(NOW - 5 * DAY_MS, NOW)).toBe('há 5 dias'); });
    test('weeks', () => { expect(timeAgoLabel(NOW - 21 * DAY_MS, NOW)).toBe('há 3 sem'); });
    test('months', () => { expect(timeAgoLabel(NOW - 90 * DAY_MS, NOW)).toBe('há 3 meses'); });
});

describe('recurring household items', () => {
    test('never checked → due', () => {
        expect(isRecurringDue(undefined, NOW)).toBe(true);
        expect(isRecurringDue({ every: 10 }, NOW)).toBe(true);
    });
    test('bought recently → not due, days left', () => {
        const rec = { every: 21, lastBought: NOW - 7 * DAY_MS };
        expect(isRecurringDue(rec, NOW)).toBe(false);
        expect(recurringDaysLeft(rec, NOW)).toBe(14);
    });
    test('a recent check postpones the reminder', () => {
        const rec = { every: 21, lastBought: NOW - 40 * DAY_MS, lastChecked: NOW - 2 * DAY_MS };
        expect(isRecurringDue(rec, NOW)).toBe(false);
    });
    test('overdue → due', () => {
        expect(isRecurringDue({ every: 21, lastBought: NOW - 22 * DAY_MS }, NOW)).toBe(true);
    });
    test('first purchase keeps the default interval', () => {
        const r = updateRecurringOnPurchase(undefined, NOW);
        expect(r.every).toBe(DEFAULT_RECURRING_EVERY);
        expect(r.lastBought).toBe(NOW);
        expect(r.lastChecked).toBe(NOW);
    });
    test('learns from the observed gap', () => {
        const r = updateRecurringOnPurchase({ every: 21, lastBought: NOW - 13 * DAY_MS }, NOW);
        expect(r.every).toBe(17);
    });
    test('interval is clamped', () => {
        expect(updateRecurringOnPurchase({ every: 3, lastBought: NOW - 1 * DAY_MS }, NOW).every).toBe(3);
        expect(updateRecurringOnPurchase({ every: 120, lastBought: NOW - 400 * DAY_MS }, NOW).every).toBe(120);
    });
    test('same-day repeat purchase does not change the interval', () => {
        expect(updateRecurringOnPurchase({ every: 21, lastBought: NOW - 3600e3 }, NOW).every).toBe(21);
    });
    test('does not mutate the input', () => {
        const rec = { every: 21, lastBought: NOW - 13 * DAY_MS };
        updateRecurringOnPurchase(rec, NOW);
        expect(rec.every).toBe(21);
    });
});

describe('usuallyHave / updateHaveStats', () => {
    test('needs at least 3 reviews', () => {
        let s = updateHaveStats(undefined, true);
        s = updateHaveStats(s, true);
        expect(usuallyHave(s)).toBe(false);
        s = updateHaveStats(s, true);
        expect(usuallyHave(s)).toBe(true);
    });
    test('below 70 % → false', () => { expect(usuallyHave({ seen: 10, have: 6 })).toBe(false); });
    test('at 70 % → true', () => { expect(usuallyHave({ seen: 10, have: 7 })).toBe(true); });
    test('sliding window caps seen at 10', () => {
        const s = updateHaveStats({ seen: 10, have: 10 }, false);
        expect(s.seen).toBe(10);
        expect(s.have).toBe(9);
    });
    test('undefined → false', () => { expect(usuallyHave(undefined)).toBe(false); });
});

describe('week status helpers', () => {
    test('nextWeekStatus cycles done → skip → out → done', () => {
        expect(nextWeekStatus('done')).toBe('skip');
        expect(nextWeekStatus('skip')).toBe('out');
        expect(nextWeekStatus('out')).toBe('done');
        expect(nextWeekStatus(undefined)).toBe('done');
    });
    test('countWeekStatuses', () => {
        const e = { week: [cooked('A'), cooked('B', 'skip'), cooked('C', 'out'), cooked('D', 'done'), { day: 'X', recipe: null }] };
        expect(countWeekStatuses(e)).toEqual({ done: 2, skip: 1, out: 1 });
    });
});

// ---------------------------------------------------------------------------
// getRecipeFoodType
// ---------------------------------------------------------------------------

describe('getRecipeFoodType', () => {
    test('salmon name → peixe', () => {
        expect(getRecipeFoodType('Salmao com Legumes', [])).toBe('peixe');
    });
    test('frango name with ingredients → carne', () => {
        expect(getRecipeFoodType('Frango Assado', ['frango', 'alho', 'limao'])).toBe('carne');
    });
    test('vegetarian recipe → vegetariano', () => {
        expect(getRecipeFoodType('Salada de Grao', ['grao', 'tomate', 'cebola'])).toBe('vegetariano');
    });
    test('carne picada in ingredients → carne', () => {
        expect(getRecipeFoodType('Esparguete Bolonhesa', ['carne picada', 'tomate', 'cebola'])).toBe('carne');
    });
    test('empty name and empty ingredients → vegetariano', () => {
        expect(getRecipeFoodType('', [])).toBe('vegetariano');
    });
    test('peixe takes priority over carne', () => {
        expect(getRecipeFoodType('Salmao com Bacon', ['salmon', 'bacon'])).toBe('peixe');
    });
    test('bacalhau → peixe', () => {
        expect(getRecipeFoodType('Bacalhau com Natas', ['bacalhau', 'natas', 'cebola'])).toBe('peixe');
    });
});

// ---------------------------------------------------------------------------
// getEnSynonym
// ---------------------------------------------------------------------------

describe('getEnSynonym', () => {
    test('frango → Chicken (PT)', () => { expect(getEnSynonym('Frango')).toBe('Chicken'); });
    test('salmão → Salmon (accented PT)', () => { expect(getEnSynonym('Salmão')).toBe('Salmon'); });
    test('bacalhau → Cod', () => { expect(getEnSynonym('Bacalhau')).toBe('Cod'); });
    test('leite → Milk', () => { expect(getEnSynonym('Leite')).toBe('Milk'); });
    test('queijo → Cheese', () => { expect(getEnSynonym('Queijo')).toBe('Cheese'); });
    test('cenoura → Carrot', () => { expect(getEnSynonym('Cenoura')).toBe('Carrot'); });
    test('arroz → Rice', () => { expect(getEnSynonym('Arroz')).toBe('Rice'); });
    test('azeite → Olive Oil', () => { expect(getEnSynonym('Azeite')).toBe('Olive Oil'); });
    test('chicken (already EN) → Chicken', () => { expect(getEnSynonym('Chicken')).toBe('Chicken'); });
    test('salmon (already EN) → Salmon', () => { expect(getEnSynonym('Salmon')).toBe('Salmon'); });
    test('case-insensitive', () => { expect(getEnSynonym('FRANGO')).toBe('Chicken'); });
    test('unknown → null', () => { expect(getEnSynonym('Ingrediente Misterioso')).toBeNull(); });
    test('null → null', () => { expect(getEnSynonym(null)).toBeNull(); });
    test('empty string → null', () => { expect(getEnSynonym('')).toBeNull(); });
});
