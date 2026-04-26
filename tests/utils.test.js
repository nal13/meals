'use strict';

const { autoAssignIcon, esc, uid, DEFAULT_ICONS } = require('../utils');

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
