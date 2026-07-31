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

/** PT (normalized) → canonical EN name lookup table for ingredient aliases. */
var PT_EN_SYNONYMS = {
    // Carne
    'frango': 'Chicken', 'galinha': 'Chicken', 'chicken': 'Chicken',
    'peru': 'Turkey', 'turkey': 'Turkey',
    'pato': 'Duck', 'duck': 'Duck',
    'coelho': 'Rabbit', 'rabbit': 'Rabbit',
    'borrego': 'Lamb', 'lamb': 'Lamb',
    'vitela': 'Veal', 'veal': 'Veal',
    'vaca': 'Beef', 'carne': 'Beef', 'beef': 'Beef',
    'porco': 'Pork', 'pork': 'Pork',
    'entrecosto': 'Ribs', 'ribs': 'Ribs',
    'costeleta': 'Pork Chop',
    'lombinho': 'Tenderloin', 'tenderloin': 'Tenderloin',
    'bife': 'Steak', 'steak': 'Steak',
    'carne picada': 'Minced Meat', 'minced meat': 'Minced Meat',
    // Peixe
    'atum': 'Tuna', 'tuna': 'Tuna',
    'salmao': 'Salmon', 'salmon': 'Salmon',
    'bacalhau': 'Cod', 'cod': 'Cod',
    'camarao': 'Shrimp', 'shrimp': 'Shrimp', 'prawns': 'Shrimp',
    'gambas': 'Prawns',
    'lulas': 'Squid', 'squid': 'Squid',
    'amijoas': 'Clams', 'clams': 'Clams',
    'peixe': 'Fish', 'fish': 'Fish',
    'pescada': 'Hake', 'hake': 'Hake',
    'tamboril': 'Monkfish', 'monkfish': 'Monkfish',
    'robalo': 'Sea Bass', 'sea bass': 'Sea Bass',
    'dourada': 'Sea Bream', 'sea bream': 'Sea Bream',
    'truta': 'Trout', 'trout': 'Trout',
    'sardinha': 'Sardine', 'sardine': 'Sardine',
    'marisco': 'Seafood', 'seafood': 'Seafood',
    'linguado': 'Sole', 'sole': 'Sole',
    'polvo': 'Octopus', 'octopus': 'Octopus',
    'cavala': 'Mackerel', 'mackerel': 'Mackerel',
    // Lacticínios
    'leite': 'Milk', 'milk': 'Milk',
    'natas': 'Cream', 'cream': 'Cream',
    'iogurte': 'Yogurt', 'yogurt': 'Yogurt', 'yoghurt': 'Yogurt',
    'manteiga': 'Butter', 'butter': 'Butter',
    'requeijao': 'Ricotta', 'ricotta': 'Ricotta',
    'queijo': 'Cheese', 'cheese': 'Cheese',
    'mascarpone': 'Mascarpone',
    'ovo': 'Egg', 'ovos': 'Eggs', 'egg': 'Egg', 'eggs': 'Eggs',
    // Charcutaria
    'fiambre': 'Ham', 'ham': 'Ham',
    'presunto': 'Prosciutto', 'prosciutto': 'Prosciutto',
    'bacon': 'Bacon',
    'chourico': 'Chorizo', 'chorizo': 'Chorizo',
    'salame': 'Salami', 'salami': 'Salami',
    'mortadela': 'Mortadella', 'mortadella': 'Mortadella',
    'salsichas': 'Sausages', 'salsichas frescas': 'Sausages', 'sausage': 'Sausage', 'sausages': 'Sausages',
    'alheira': 'Alheira',
    // Fruta
    'maca': 'Apple', 'apple': 'Apple',
    'pera': 'Pear', 'pear': 'Pear',
    'banana': 'Banana',
    'laranja': 'Orange', 'orange': 'Orange',
    'limao': 'Lemon', 'lemon': 'Lemon',
    'uva': 'Grape', 'uvas': 'Grapes', 'grape': 'Grape', 'grapes': 'Grapes',
    'morango': 'Strawberry', 'morangos': 'Strawberries', 'strawberry': 'Strawberry',
    'melao': 'Melon', 'melon': 'Melon',
    'melancia': 'Watermelon', 'watermelon': 'Watermelon',
    'ananas': 'Pineapple', 'pineapple': 'Pineapple',
    'kiwi': 'Kiwi',
    'manga': 'Mango', 'mango': 'Mango',
    'pessego': 'Peach', 'peach': 'Peach',
    'cereja': 'Cherry', 'cherry': 'Cherry',
    'ameixa': 'Plum', 'plum': 'Plum',
    'framboesa': 'Raspberry', 'raspberry': 'Raspberry',
    'mirtilo': 'Blueberry', 'blueberry': 'Blueberry',
    'abacate': 'Avocado', 'avocado': 'Avocado',
    'coco': 'Coconut', 'coconut': 'Coconut',
    // Massas e Conservas
    'arroz': 'Rice', 'rice': 'Rice',
    'massa': 'Pasta', 'pasta': 'Pasta',
    'esparguete': 'Spaghetti', 'spaghetti': 'Spaghetti',
    'penne': 'Penne',
    'lasanha': 'Lasagna', 'lasagna': 'Lasagna',
    'macarrao': 'Macaroni', 'macaroni': 'Macaroni',
    'grao': 'Chickpeas', 'chickpeas': 'Chickpeas',
    'lentilha': 'Lentils', 'lentilhas': 'Lentils', 'lentils': 'Lentils',
    'feijao': 'Beans', 'beans': 'Beans',
    'polpa de tomate': 'Tomato Pulp', 'tomato pulp': 'Tomato Pulp',
    'noodles': 'Noodles',
    // Pão e Sobremesas
    'pao': 'Bread', 'bread': 'Bread',
    'tosta': 'Toast', 'tostas': 'Toast', 'toast': 'Toast',
    'bolacha': 'Biscuit', 'bolachas': 'Biscuits', 'biscuit': 'Biscuit', 'cookie': 'Cookie',
    'farinha': 'Flour', 'flour': 'Flour',
    'acucar': 'Sugar', 'sugar': 'Sugar',
    'chocolate': 'Chocolate',
    'mel': 'Honey', 'honey': 'Honey',
    'croissant': 'Croissant',
    'bolo': 'Cake', 'cake': 'Cake',
    // Legumes e Vegetais
    'alface': 'Lettuce', 'lettuce': 'Lettuce',
    'cenoura': 'Carrot', 'cenouras': 'Carrots', 'carrot': 'Carrot',
    'tomate': 'Tomato', 'tomates': 'Tomatoes', 'tomato': 'Tomato',
    'cebola': 'Onion', 'cebolas': 'Onions', 'onion': 'Onion',
    'alho': 'Garlic', 'garlic': 'Garlic',
    'brocolo': 'Broccoli', 'brocoli': 'Broccoli', 'broculos': 'Broccoli', 'broccoli': 'Broccoli',
    'espinafre': 'Spinach', 'espinafres': 'Spinach', 'spinach': 'Spinach',
    'courgette': 'Zucchini', 'zucchini': 'Zucchini', 'curgete': 'Zucchini',
    'beringela': 'Aubergine', 'aubergine': 'Aubergine', 'eggplant': 'Eggplant',
    'pimento': 'Bell Pepper', 'bell pepper': 'Bell Pepper', 'capsicum': 'Capsicum',
    'pepino': 'Cucumber', 'cucumber': 'Cucumber',
    'batata': 'Potato', 'batatas': 'Potatoes', 'potato': 'Potato',
    'couve': 'Cabbage', 'cabbage': 'Cabbage',
    'ervilha': 'Peas', 'ervilhas': 'Peas', 'peas': 'Peas',
    'cogumelo': 'Mushroom', 'cogumelos': 'Mushrooms', 'mushroom': 'Mushroom',
    'aipo': 'Celery', 'celery': 'Celery',
    'nabo': 'Turnip', 'turnip': 'Turnip',
    'abobora': 'Pumpkin', 'pumpkin': 'Pumpkin',
    'milho': 'Corn', 'corn': 'Corn',
    'rucula': 'Rocket', 'rocket': 'Rocket', 'arugula': 'Arugula',
    'beterraba': 'Beetroot', 'beetroot': 'Beetroot',
    'funcho': 'Fennel', 'fennel': 'Fennel',
    'rabanete': 'Radish', 'radish': 'Radish',
    'alho frances': 'Leek', 'alho porro': 'Leek', 'leek': 'Leek',
    'agriao': 'Watercress', 'watercress': 'Watercress',
    // Condimentos
    'azeite': 'Olive Oil', 'olive oil': 'Olive Oil',
    'oleo': 'Oil', 'oil': 'Oil',
    'sal': 'Salt', 'salt': 'Salt',
    'pimenta': 'Pepper', 'pepper': 'Pepper',
    'vinagre': 'Vinegar', 'vinegar': 'Vinegar',
    'mostarda': 'Mustard', 'mustard': 'Mustard',
    'ketchup': 'Ketchup',
    'molho': 'Sauce', 'sauce': 'Sauce',
    'salsa': 'Parsley', 'parsley': 'Parsley',
    'coentro': 'Coriander', 'coentros': 'Coriander', 'coriander': 'Coriander',
    'manjericao': 'Basil', 'basil': 'Basil',
    'oregao': 'Oregano', 'oregano': 'Oregano',
    'tomilho': 'Thyme', 'thyme': 'Thyme',
    'louro': 'Bay Leaf', 'bay leaf': 'Bay Leaf',
    'alecrim': 'Rosemary', 'rosemary': 'Rosemary',
    'curcuma': 'Turmeric', 'turmeric': 'Turmeric',
    'paprika': 'Paprika', 'colorau': 'Paprika',
    'caril': 'Curry', 'curry': 'Curry',
    'canela': 'Cinnamon', 'cinnamon': 'Cinnamon',
    'noz moscada': 'Nutmeg', 'nutmeg': 'Nutmeg',
    'gengibre': 'Ginger', 'ginger': 'Ginger',
    'caldo': 'Stock', 'stock': 'Stock',
    'cominhos': 'Cumin', 'cumin': 'Cumin',
};

/**
 * Returns the canonical EN name for a PT (or EN) ingredient name.
 * Uses normalized lookup (no accents, lowercase). Returns null if not found.
 */
function getEnSynonym(name) {
    var key = _normalize((name || '').trim().toLowerCase());
    return PT_EN_SYNONYMS[key] || null;
}

// CommonJS export (used by Jest tests); no-op in browser
if (typeof module !== 'undefined') {
    module.exports = { DEFAULT_ICONS: DEFAULT_ICONS, ICON_RULES: ICON_RULES, CATEGORIAS: CATEGORIAS, CATEGORIA_ICONS: CATEGORIA_ICONS, CATEGORIA_RULES: CATEGORIA_RULES, PT_EN_SYNONYMS: PT_EN_SYNONYMS, autoAssignIcon: autoAssignIcon, autoAssignCategoria: autoAssignCategoria, getEnSynonym: getEnSynonym, esc: esc, uid: uid, getRecipeFoodType: getRecipeFoodType };
}
