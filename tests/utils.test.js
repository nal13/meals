'use strict';

const { autoAssignIcon, esc, uid, DEFAULT_ICONS, CATEGORIAS, autoAssignCategoria, getRecipeFoodType } = require('../utils');

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
    test('is an array of 9 strings', () => {
        expect(Array.isArray(CATEGORIAS)).toBe(true);
        expect(CATEGORIAS).toHaveLength(9);
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

