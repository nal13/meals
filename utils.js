'use strict';

// ---- Constants --------------------------------------------------------------

var DEFAULT_ICONS = ['🍝','🍜','🍲','🥘','🍛','🍣','🥗','🍕','🥩','🍗','🍖','🐟','🥚','🥞','🧀','🥓','🌮','🌯','🥙','🫕','🍱','🥣','🧆','🍤','🍳','🥐','🥖','🫔','🍅','🥦','🥕','🍰','🧁','🍩','🍪','🍦','🎂','🥧','🫐','🍓'];

var ICON_RULES = [
    [/pasta|esparguete|spaghetti|penne|rigatoni|fettuccine|linguine|lasanha|lasagna|bolognese|carbonara|macarr/i, '🍝'],
    [/sopa|soup|caldo|broth|bisque|chowder|stew|guisado|cozido|ensopado/i,                                       '🍲'],
    [/salad|salada|coleslaw|caesar/i,                                                                             '🥗'],
    [/curry|tikka|masala|vindaloo/i,                                                                              '🍛'],
    [/sushi|maki|nigiri|temaki/i,                                                                                 '🍣'],
    [/pizza/i,                                                                                                    '🍕'],
    [/pad.?thai|noodle|ramen|pho|yakisoba|stir.?fry|wok/i,                                                       '🍜'],
    [/taco|burrito|fajita|quesadilla/i,                                                                           '🌮'],
    [/wrap|pita|flatbread/i,                                                                                      '🌯'],
    [/frango|chicken|galinha/i,                                                                                   '🍗'],
    [/porco|pork|entrecosto|ribs|sausage|salsichas|chourico|linguica/i,                                           '🍖'],
    [/beef|vaca|borrego|lamb|steak|bife|ground beef|carne\s*(picada|assada|de vaca)/i,                            '🥩'],
    [/peixe|fish|salmao|salmon|atum|tuna|bacalhau|cod|camarao|shrimp|marisco|seafood/i,                           '🐟'],
    [/hamburguer|burger/i,                                                                                         '🍔'],
    [/bacon|presunto|\bham\b/i,                                                                                   '🥓'],
    [/ovo|egg|ovos|omelette|frittata|quiche/i,                                                                    '🥚'],
    [/panqueca|pancake|waffle/i,                                                                                   '🥞'],
    [/brownie|muffin|bolinho/i,                                                                                   '🧁'],
    [/bolo|cake|tarte|torta|cheesecake/i,                                                                         '🎂'],
    [/queijo|cheese|feta|mozzarella|parmesao|parmesan/i,                                                          '🧀'],
    [/arroz|rice|paella|risotto/i,                                                                                 '🍚'],
    [/feijao|bean|lentilha|lentil|grao|chickpea|tofu|vegano|vegan/i,                                              '🫕'],
];  // hamburguer is now handled above the ham rule

// ---- Pure utility functions -------------------------------------------------

/**
 * Returns the best-matching emoji icon for a recipe given its name and ingredients.
 * Falls back to DEFAULT_ICONS[0] when no rule matches.
 */
function _normalize(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function autoAssignIcon(name, ingredients) {
    var text = _normalize((name || '').toLowerCase()) + ' ' +
               (ingredients || []).map(function(i) { return _normalize((i.name || '').toLowerCase()); }).join(' ');
    for (var i = 0; i < ICON_RULES.length; i++) {
        if (ICON_RULES[i][0].test(text)) return ICON_RULES[i][1];
    }
    return DEFAULT_ICONS[0];
}

/** Escapes HTML special characters to prevent XSS. */
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Generates a short random unique ID. */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// CommonJS export (used by Jest tests); no-op in browser
if (typeof module !== 'undefined') {
    module.exports = { DEFAULT_ICONS: DEFAULT_ICONS, ICON_RULES: ICON_RULES, autoAssignIcon: autoAssignIcon, esc: esc, uid: uid };
}
