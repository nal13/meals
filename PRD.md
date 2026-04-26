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

### 5.1 Módulo: Semana

- Grelha com os 7 dias da semana (Segunda a Domingo)
- Cada dia tem um slot para selecionar uma receita via dropdown
- Ao selecionar: mostra ícone e nome da receita; oculta o dropdown
- Botão para limpar o slot
- Clicar no nome abre o modal de visualização da receita

### 5.2 Módulo: Extra Semanal & Sopa

- Secção para ingredientes fora das receitas da semana (ex: sopas diárias, lanches)
- Cada linha: ingrediente + quantidade, com flag `canExtra` ou `canSopa` no dicionário
- Máx. 10 entradas por lista
- Contribui para a lista de compras gerada

### 5.3 Módulo: Lista de Compras

- Botão **Gerar Lista** abre modal de revisão com todos os ingredientes das receitas da semana + extras + sopa
- O utilizador pode ajustar quantidades e remover itens antes de confirmar
- A lista gerada é persistida no Firestore
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

### 5.5 Módulo: Ingredientes

- Dicionário centralizado de ingredientes
- Flags por ingrediente: `canSopa`, `canExtra`
- Editar nome (propaga a todas as receitas que o usam)
- Apagar (só permitido se não for usado em nenhuma receita)
- Mostra em que receitas cada ingrediente aparece

### 5.6 Módulo: Histórico

- Snapshot automático da semana ao clicar **Limpar e Registar**
- Guarda: data, receitas por dia, lista de ingredientes gerada
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
├── sw.js               — Service Worker: cache offline (mp-v4)
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
└── tests/utils.test.js — 32 testes: autoAssignIcon, esc, uid
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
  }
}
```

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
