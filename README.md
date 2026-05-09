# 🍽️ Planeador de Refeições

Aplicação web PWA para planear refeições semanais, gerir receitas e gerar lista de compras automaticamente.

---

## Funcionalidades

### 📅 Semana
- Grelha com os 7 dias da semana
- Cada dia tem um slot de refeição
- Botão **+ Escolher** abre um picker com pesquisa e filtros (Peixe / Carne / Vegetariano)
- Botão para remover a refeição do slot
- Clicar no nome da receita abre o modal de visualização

### ➕ Extra
- Secção para refeições fora da semana normal (ex: lanches, sobremesas frequentes)
- Cada linha tem: dropdown de prato principal + dropdown de acompanhamento
- Botão para adicionar/remover linhas extra

### 🛒 Lista de Compras
- Gerada automaticamente a partir das receitas da semana + extras
- Agrega ingredientes iguais e soma quantidades
- Adição manual de ingredientes
- Marcar itens como feitos (oculta da lista)
- Botão **Limpar** — limpa a semana e lista de compras

### 📖 Receitas
- Grelha com cards de todas as receitas
- Tipos: `main` (prato principal) ou `side` (sopa, sobremesa, acompanhamento)
- Cada receita tem: nome, ícone/emoji, lista de ingredientes com quantidade
- Botões editar e apagar em cada card
- Modal para criar/editar receitas (com autocomplete de ingredientes)
- Modal para visualizar receita completa
- **Auto-icon**: ícone/emoji atribuído automaticamente com base no nome e ingredientes da receita
- **Limpar duplicadas**: botão para remover receitas duplicadas e corrigir ícones (também corre silenciosamente ao carregar a app)

### 🧅 Ingredientes
- Dicionário centralizado de ingredientes
- Todos os ingredientes das receitas têm de existir no dicionário
- Mostra em que receitas cada ingrediente é usado

### 📋 Registo
- Histórico das semanas anteriores (máx. 30 registos)
- Botão **Limpar e Registar** — guarda snapshot da semana atual e limpa tudo
- Cada registo mostra data, dias da semana e extras

### 💾 Exportar / Importar
- **Exportar** — descarrega ficheiro `.json` com todas as receitas e ingredientes
- **Importar** — carrega ficheiro `.json` com mapeamento inteligente de ingredientes
  - Ingredientes novos são identificados (marcados com ★)
  - Ingredientes existentes podem ser mapeados para evitar duplicados
- Ficheiro `template_importacao.json` disponível como ponto de partida

---

## Tecnologia

| Componente | Detalhe |
|---|---|
| Frontend | HTML + CSS + JavaScript (vanilla, sem frameworks) |
| Persistência | **localStorage** (por browser/dispositivo) |
| Offline | Service Worker (cache completo) |
| Hosting | GitHub Pages (estático, sem servidor) |
| PWA | Instalável no ecrã inicial (Android e iOS) |

### Chaves localStorage
| Chave | Conteúdo |
|---|---|
| `mp_recipes` | `{ id: { name, icon, ingredients:[{ingId,qty}] } }` |
| `mp_week` | `{ '0': recipeId\|null, … }` (0=Segunda … 6=Domingo) |
| `mp_extras` | `[{ id, ingId, qty }]` |
| `mp_sopa` | `[{ id, ingId, qty }]` |
| `mp_ingredients` | `{ id: { name, categoria, canSopa, canExtra } }` |
| `mp_shopping` | `{ extra:[…], done:{…}, generated:[…] }` |
| `mp_history` | `[{ date, week, lista }]` (máx. 3) |

---

## Como abrir

### No computador
Faz duplo clique em `index.html` ou arrasta para o browser.
> O Service Worker (offline) só funciona com HTTPS ou `localhost` — não com `file://`.

### Servidor local (para testar PWA)
```bash
# Python
py -m http.server 8080

# Node.js
node -e "require('http').createServer((req,res)=>{require('fs').readFile('.'+req.url+(req.url==='/'?'/index.html':''),(_,d)=>{res.end(d)})}).listen(8080)"
```
Depois abre `http://localhost:8080` no browser ou `http://[IP-do-computador]:8080` no telemóvel (mesma rede WiFi).

### GitHub Pages
O repositório está configurado para publicar automaticamente via GitHub Pages.
A app fica disponível em `https://nunogouveia91.github.io/meal-planner/`.

---

## Estrutura de ficheiros
```
meal-planner/
├── index.html                — estrutura da página
├── style.css                 — estilos visuais + responsivo mobile
├── utils.js                  — funções puras (autoAssignIcon, esc, uid)
├── script.js                 — lógica completa da aplicação (localStorage)
├── manifest.json             — configuração PWA
├── sw.js                     — Service Worker (cache offline)
├── icon-192.png              — ícone PWA 192×192
├── icon-512.png              — ícone PWA 512×512
├── generate-icons.py         — script para regenerar os ícones PNG
├── rebuild.py                — utilitário de build
├── template_importacao.json  — template para importar receitas
├── tests/utils.test.js       — testes Jest (62 testes)
├── package.json              — dependências de desenvolvimento (Jest)
├── AGENTS.md                 — guia para agentes AI
├── PRD.md                    — product requirements document
└── README.md                 — este ficheiro
```

---

## Mobile (PWA)
- Layout responsivo com **3 tabs** no fundo: Lista | Semana | Receitas
- Área de toque aumentada em todos os botões
- Impede zoom automático do iOS nos inputs
- Suporte a safe-area-inset (notch do iPhone)
- Instalável no ecrã inicial (Android Chrome e iOS Safari)
- Dados guardados por browser via `localStorage`

---

## Possíveis melhorias futuras
- [ ] Imprimir lista de compras
- [ ] Notas por receita
- [ ] Categorias/tags nas receitas
- [ ] Tema escuro
- [ ] Autenticação de utilizador (dados privados por conta)
- [ ] Partilhar plano semanal com outra pessoa
