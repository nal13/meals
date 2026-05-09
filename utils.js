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

var CATEGORIAS = [
    'Legumes e Vegetais',
    'Fruta',
    'Carne e Peixe',
    'Lacticínios',
    'Charcutaria',
    'Massas e Conservas',
    'Pão e Sobremesas',
    'Condimentos',
    'Outros'
];

var CATEGORIA_ICONS = {
    'Legumes e Vegetais': '🥦',
    'Fruta':              '🍎',
    'Carne e Peixe':      '🥩',
    'Lacticínios':        '🥛',
    'Charcutaria':        '🥓',
    'Massas e Conservas': '🍚',
    'Pão e Sobremesas':   '🍞',
    'Condimentos':        '🧂',
    'Outros':             '🛒'
};

var CATEGORIA_RULES = [
    [/frango|galinha|peru|pato|coelho|borrego|vitela|vaca\b|porco|entrecosto|costeleta|lombinho|secreto|bife|carne\b|atum|salmao|bacalhau|camarao|lulas|amijoas|peixe|pescada|tamboril|robalo|dourada|truta|sardinha|marisco|linguado|febras|cachaco|chicken|turkey|duck|rabbit|lamb\b|beef|pork\b|ribs\b|steak|tuna|salmon|cod\b|shrimp|prawn|squid|clam\b|fish\b|sardine|seafood/i, 'Carne e Peixe'],
    [/leite|natas\b|iogurte|manteiga|requeijao|queijo|cream.?cheese|mascarpone|kefir|ovo\b|ovos\b|milk\b|cream\b|yogur[th]|butter\b|cheese|egg\b|eggs\b/i,                                                                                         'Lacticínios'],
    [/fiambre|presunto|chourico|salame|mortadela|bacon|morcela|linguica|paio|salpicao|alheira|farinheira|ham\b|salami|chorizo|sausage|pepperoni|prosciutto/i,                                                                                       'Charcutaria'],
    [/maca\b|pera\b|banana|laranja|limao\b|uva\b|morango|melao|melancia|ananas|kiwi|manga\b|pessego|damasco|cereja|ameixa|framboesa|mirtilo|figo\b|coco\b|abacate|apple\b|pear\b|orange\b|lemon|grape|strawberr|watermelon|pineapple|mango\b|peach|cherry|plum|raspberr|blueberr|fig\b|coconut|avocado/i, 'Fruta'],
    [/massa\b|esparguete|spaghetti|penne|rigatoni|fettuccine|lasanha|macarrao|arroz\b|grao|lentilha|polpa|conserva|pasta\b|noodle|rice\b|lentil|chickpea|bean\b|beans\b/i,                                                                         'Massas e Conservas'],
    [/pao\b|tosta|bolacha|farinha|acucar|chocolate|mel\b|croissant|brioche|bolo\b|biscoito|bread|toast|biscuit|cookie|flour|sugar\b|honey\b/i,                                                                                                     'Pão e Sobremesas'],
    [/alface|cenoura|tomate\b|cebola|alho\b|brocolo|espinafre|courgette|abobrinha|beringela|pimento\b|pepino|batata|couve|ervilha|feijao|cogumelo|alho.?frances|aipo|nabo|abobora|milho\b|rucula|agriao|beterraba|funcho|curgete|rabanete|alho.?porro|lettuce|carrot|tomato|onion|garlic|broccoli|spinach|zucchini|aubergine|eggplant|bell.?pepper|capsicum|cucumber|potato|cabbage|pea\b|peas\b|mushroom|celery|turnip|pumpkin|corn\b|sweetcorn|rocket\b|arugula|beet\b|fennel|radish|leek/i, 'Legumes e Vegetais'],
    [/azeite|oleo\b|sal\b|pimenta\b|vinagre|mostarda|ketchup|molho|salsa\b|coentro|manjericao|oregao|tomilho|louro\b|alecrim|curcuma|paprika|caril|canela|noz.?moscada|gengibre|colorau|caldo\b|cominhos|olive.?oil|oil\b|salt\b|pepper\b|vinegar|mustard|sauce\b|parsley|coriander|basil\b|oregano|thyme|rosemary|turmeric|curry\b|cinnamon|nutmeg|ginger\b|stock\b|cumin|spice\b|almond|walnut|cashew|peanut|pistachio|hazelnut|pecan|nut\b/i, 'Condimentos'],
];

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

/** Returns the best-matching CATEGORIAS entry for an ingredient name. Falls back to 'Outros'. */
function autoAssignCategoria(name) {
    var text = _normalize((name || '').toLowerCase());
    for (var i = 0; i < CATEGORIA_RULES.length; i++) {
        if (CATEGORIA_RULES[i][0].test(text)) return CATEGORIA_RULES[i][1];
    }
    return 'Outros';
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

var FOOD_TYPE_RULES = [
    ['peixe',       /peixe|fish|salmon|salmao|atum|tuna|bacalhau|cod\b|camarao|shrimp|prawn|marisco|seafood|tamboril|robalo|dourada|truta|sardinha|linguado|lulas|amijoas|pescada|tilapia|cavala|polvo|lagosta|gambas/i],
    ['carne',       /frango|galinha|chicken|peru|pato|coelho|borrego|vitela|vaca\b|porco|entrecosto|costeleta|lombinho|secreto|bife|steak|carne\b|beef|pork\b|ribs\b|lamb\b|turkey|duck|rabbit|bacon|fiambre|presunto|chourico|salsichas|linguica|alheira|mortadela|salame|pepperoni/i],
];

/**
 * Returns the food type of a recipe: 'peixe', 'carne', or 'vegetariano'.
 * Fish is checked before meat; vegetariano is the fallback.
 * @param {string} name - recipe name
 * @param {string[]} ingredientNames - array of ingredient name strings
 */
function getRecipeFoodType(name, ingredientNames) {
    var text = _normalize((name || '').toLowerCase()) + ' ' +
               (ingredientNames || []).map(function(n) { return _normalize((n || '').toLowerCase()); }).join(' ');
    for (var i = 0; i < FOOD_TYPE_RULES.length; i++) {
        if (FOOD_TYPE_RULES[i][1].test(text)) return FOOD_TYPE_RULES[i][0];
    }
    return 'vegetariano';
}

// CommonJS export (used by Jest tests); no-op in browser
if (typeof module !== 'undefined') {
    module.exports = { DEFAULT_ICONS: DEFAULT_ICONS, ICON_RULES: ICON_RULES, CATEGORIAS: CATEGORIAS, CATEGORIA_ICONS: CATEGORIA_ICONS, CATEGORIA_RULES: CATEGORIA_RULES, autoAssignIcon: autoAssignIcon, autoAssignCategoria: autoAssignCategoria, esc: esc, uid: uid, getRecipeFoodType: getRecipeFoodType };
}
