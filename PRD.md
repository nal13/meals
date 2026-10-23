# PRD — Planeador de Refeições

**Versão:** 1.1  
**Data:** Abril 2026  
**Estado:** Em produção

---

## 1. Sumário executivo

Aplicação web PWA para uso pessoal/familiar que resolve o problema de planear refeições semanais, calcular a lista de compras automaticamente e manter um repositório de receitas. Funciona em qualquer browser, instala-se no telemóvel como app nativa e sincroniza em tempo real entre dispositivos via Firebase.

---

## 2. Problema

| Dor | Impacto |
|-----|---------|
| Decidir o que comer todos os dias é cognitivamente custoso | Tempo perdido diariamente |
| A lista de compras é feita à mão, frequentemente esquecendo ingredientes | Idas extra ao supermercado |
| As receitas estão dispersas (livros, notas, memória) | Receitas repetidas ou perdidas |
| Não há histórico do que se comeu nas semanas anteriores | Dificuldade em variar o menu |

---

## 3. Utilizadores-alvo

- **Utilizador primário:** adulto que gere a alimentação do agregado familiar (cozinha 3–7 dias/semana)
- **Dispositivo principal:** telemóvel (Android Chrome ou iOS Safari)
- **Contexto de uso:** em casa, antes de ir às compras ou ao preparar o menu da semana

---

## 4. Objetivos do produto

1. Reduzir o tempo de planeamento semanal de refeições para menos de 5 minutos
2. Gerar uma lista de compras completa e agregada com zero esforço manual
3. Manter um repositório de receitas acessível e sincronizado em todos os dispositivos
4. Funcionar offline após o primeiro carregamento

---

## 5. Âmbito — v1.x (atual)

### 5.0 Navegação e feedback

- Abas: **Semana · Lista · Receitas**. Ao abrir, a app vai para a Lista se houver itens por comprar; caso contrário abre a Semana
- Badge na aba Lista com o nº de itens por comprar
- Ações destrutivas (apagar receita/ingrediente, limpar lista/semana, remover item) não pedem confirmação: mostram um toast com **Desfazer**
- Erros de validação aparecem como toast (sem `alert()`)

### 5.1 Módulo: Semana

- Grelha com os 7 dias da semana (Segunda a Domingo); o dia de hoje fica destacado
- Uma refeição por dia (cozinha-se para o jantar e o almoço do dia seguinte); não é esperado planear sempre os 7 dias
- Cada dia tem um botão "Escolher refeição" que abre o picker
- Ao selecionar: mostra ícone e nome da receita
- Botão para limpar o slot
- Clicar no nome abre o modal de visualização da receita
- Botão fixo **Gerar lista** com resumo (nº de refeições + extras)
- **Toque rápido (quicklist):** fila de chips com as receitas *Habituais*; tocar num chip "arma" a receita e o toque seguinte num dia atribui-a (com Desfazer). Chip **Repetir semana passada** preenche só os dias vazios
- **Fechar semana:** modal "Como correu a semana?" onde cada dia alterna ✅ feito → ❌ não feito → 🛵 comemos fora. As não feitas podem transitar para a semana seguinte (mesmo dia), marcadas como *transitadas* (`week.carried`); depois guarda no histórico e limpa

### 5.2 Módulo: Ingredientes extra

- Secção para tudo o que não está nas receitas (fruta, lanches, básicos da casa…)
- Cada linha: ingrediente + quantidade
- Contribui para a lista de compras gerada

### 5.3 Módulo: Lista de Compras

- Botão **Gerar Lista** abre modal de revisão com todos os ingredientes das receitas da semana + extras + sopa
- O utilizador pode ajustar quantidades e remover itens antes de confirmar
- A revisão está agrupada por **sítio da casa** (Frigorífico, Fruta e legumes, Despensa, Casa e higiene, Outros) para seguir uma volta pela casa; tocar na linha marca/desmarca "já temos"
- Itens pré-riscados automaticamente: **costumam ter** (≥ 3 revisões e ≥ 70 % das vezes em casa — `ingredients.haveStats`) e **da semana passada** (só usados por receitas transitadas). A confirmação atualiza `haveStats`
- No topo, **Artigos de casa a verificar** (os que já passaram do intervalo) com escolha ✓ Temos / 🛒 Comprar
- A lista gerada é persistida no Firestore
- **Artigos de casa** (papel higiénico, detergente…): ingredientes da categoria *Casa e Higiene* ou com `recurring`. Botão **🧴 Casa** + banner "N artigos de casa a verificar" abrem um painel com barra de duração, ✓ Temos / 🛒 Precisamos e campo **"Está a acabar…"**. Ao marcar como comprado, o intervalo aprende-se: `every = média(every, dias desde a última compra)`, entre 3 e 120 dias (padrão 21)
- Adição manual de ingredientes avulsos
- Marcar itens como comprados (move para secção "Já comprado")
- Modo de edição inline de quantidades
- Botão **Limpar lista**

### 5.4 Módulo: Receitas

- Grelha com todos os cards de receitas, ordenados por nome
- Cada receita: nome, ícone/emoji, lista de ingredientes com quantidade
- **Auto-icon:** emoji atribuído automaticamente por regras baseadas no nome/ingredientes; atualizável manualmente
- Editar e apagar receitas via modal
- Modal de visualização completa (ícone grande + lista de ingredientes)
- Botão **Limpar duplicadas:** remove receitas com o mesmo nome e re-aplica ícones
- Deduplicação silenciosa automática ao carregar a app
- **Níveis automáticos** a partir do histórico: ⭐ *Habituais* (feitas ≥ 3× nas últimas 12 semanas), 🔄 *Às vezes* (feitas nos últimos 6 meses, ou criadas há < 30 dias) e 🗄️ *Arquivo* (o resto — nunca se apaga nada). Pode-se **Fixar nas Habituais** ou **Arquivar** manualmente (`recipe.tier = 'pin' | 'archive'`)
- O picker mostra Habituais e Às vezes; o Arquivo fica recolhido em "Ver arquivo (N)". A pesquisa procura em tudo
- Cada receita mostra "Feita N× · última vez há X"
- **Rascunhos:** é possível guardar uma receita só com o nome (pill "rascunho"); os ingredientes acrescentam-se depois

### 5.5 Módulo: Ingredientes

- Dicionário centralizado de ingredientes
- Flags por ingrediente: `canSopa`, `canExtra`
- Editar nome (propaga a todas as receitas que o usam)
- Apagar (só permitido se não for usado em nenhuma receita)
- Mostra em que receitas cada ingrediente aparece
- Categoria **Casa e Higiene** (🧴) para artigos não alimentares; ingredientes antigos em "Outros" que encaixem são migrados automaticamente
- Caixa **Por arrumar**: ingredientes em "Outros" com chips de categoria — um toque arruma (5 de cada vez)

### 5.6 Módulo: Histórico

- Snapshot automático da semana ao clicar **Fechar semana**
- Guarda: data, receitas por dia (com `id` e estado `done | skip | out`), lista de ingredientes gerada
- Mostra o resumo ✅/❌/🛵 da semana e o estado de cada dia; registos antigos sem estado contam como feitos
- Navegação paginada entre snapshots (máx. 3 em v1, ilimitado planeado)

### 5.7 Módulo: Exportar / Importar

- **Exportar:** descarrega JSON com todas as receitas e ingredientes
- **Importar:** carrega JSON com mapeamento inteligente de ingredientes existentes
  - Ingredientes novos identificados com ★
  - Dropdown para mapear para ingrediente existente e evitar duplicados
- Ficheiro `template_importacao.json` como ponto de partida

---

## 6. Arquitetura técnica

```
Browser (PWA)
│
├── index.html          — estrutura da UI (tabs, modais, grelhas)
├── style.css           — estilos + responsivo + safe-area iOS
├── utils.js            — funções puras: uid(), esc(), autoAssignIcon()
├── script.js           — toda a lógica de UI + Firestore listeners
├── sw.js               — Service Worker: cache offline (mp-v8)
└── manifest.json       — configuração PWA (ícones, nome, theme)

Firebase Firestore (base de dados em tempo real)
├── recipes/{id}        — { name, icon, ingredients:[{name,qty}] }
├── data/week           — { days: { '0'...'6': recipeId|null } }
├── data/extras         — { list: [{id, ingId, qty}] }
├── data/sopa           — { list: [{id, ingId, qty}] }
├── data/ingredients    — { dict: { id: {name, canSopa, canExtra} } }
├── data/shopping       — { extra:[...], done:{...}, generated:[...] }
└── data/history        — { items: [{date, week, lista}] }

Testes (Node.js)
├── package.json        — Jest como test runner
└── tests/utils.test.js — 153 testes: ícones, categorias, ciclo semanal (níveis, artigos de casa, "já temos", estados)
```

### Fluxo de dados

```
Firestore onSnapshot → variáveis globais (recipes, week, ...) → render*()
UI event → update variável → save*() → Firestore → onSnapshot → render
```

### Estratégia offline

O Service Worker faz cache de todos os ficheiros estáticos na instalação. O Firestore SDK tem persistência local ativa (`enablePersistence`), permitindo leituras e escritas offline com sincronização automática ao retomar ligação.

---

## 7. Modelo de dados

### Recipe

```json
{
  "name": "Frango no Forno",
  "icon": "🍗",
  "ingredients": [
    { "name": "Frango", "qty": "1" },
    { "name": "Azeite", "qty": "2" }
  ]
}
```

### Ingredient

```json
{
  "name": "Frango",
  "canSopa": false,
  "canExtra": true
}
```

### Week

```json
{
  "days": {
    "0": "rec_abc123",
    "1": null,
    "2": "rec_xyz789"
  },
  "carried": { "2": "rec_xyz789" }
}
```

`carried` marca os dias cuja receita transitou da semana anterior (os ingredientes já devem estar em casa).

### Campos do ciclo semanal

| Onde | Campo | Significado |
|------|-------|-------------|
| `recipes/{id}` | `tier` | `'pin'` (fixada nas Habituais) ou `'archive'`; ausente = automático |
| `recipes/{id}` | `createdAt` | ISO; receitas novas ficam em "Às vezes" durante 30 dias |
| `data/ingredients.dict[id]` | `recurring` | `{ every, lastBought, lastChecked }` (ms) — artigos de casa |
| `data/ingredients.dict[id]` | `haveStats` | `{ seen, have }` — janela de 10 revisões do "já temos" |
| `data/shopping.extra[]` | `ingId` | opcional, liga o item avulso ao dicionário |
| `data/history.items[].week[]` | `recipe.id`, `status` | id da receita e `'done' \| 'skip' \| 'out'` |

---

## 8. Requisitos não-funcionais

| Atributo | Requisito |
|----------|-----------|
| Performance | App carrega e fica usável em < 2s numa ligação 4G |
| Offline | Todas as funcionalidades de leitura disponíveis sem ligação |
| Compatibilidade | Chrome Android 90+, Safari iOS 14+, Chrome/Firefox desktop |
| Segurança | Sem autenticação em v1 (dados partilhados por quem tiver o link Firebase); v2 planeia Firebase Auth |
| Escalabilidade | Desenhado para 1–2 utilizadores; sem limites de receitas ou ingredientes |
| Testes | Funções puras em `utils.js` cobertas por testes Jest |

---

## 9. Fora de âmbito (v1)

- Autenticação / contas de utilizador
- Múltiplos utilizadores com permissões diferentes
- Notificações push
- Integração com serviços externos (supermercados, delivery)
- Modo de impressão dedicado
- App nativa (React Native / Flutter)

---

## 10. Métricas de sucesso

- Utilizador consegue planear a semana completa em < 5 minutos
- Lista de compras gerada sem itens em falta relativamente às receitas selecionadas
- App abre e é utilizável offline após primeiro carregamento
- 0 erros de sincronização entre dispositivos na mesma sessão

---

## 11. Decisões de design registadas

| Decisão | Racional |
|---------|----------|
| Vanilla JS sem framework | Sem build step, zero dependências em runtime, fácil de hospedar como ficheiros estáticos |
| Firebase Firestore | Sincronização em tempo real sem servidor próprio; free tier suficiente para uso pessoal |
| Dicionário centralizado de ingredientes | Garante consistência de nomes na lista de compras e permite flags (canSopa, canExtra) |
| Auto-icon por regex | Melhora a UX visualmente sem requerer que o utilizador escolha um ícone manualmente |
| `utils.js` separado de `script.js` | Permite testar funções puras com Jest sem precisar de browser ou mock do DOM |
