# Roadmap — Planeador de Refeições

Issues and improvements are grouped by effort and impact. Items at the top of each tier are higher priority.

---

## Tier 1 — Quick wins

- [ ] **Imprimir lista de compras** — botão que abre uma vista de impressão limpa (só a lista, sem navegação)
- [ ] **Notas por receita** — campo de texto livre no modal de criação/edição
- [ ] **Filtrar receitas por nome** — campo de pesquisa rápida na grelha de receitas
- [ ] **Ordenar receitas** — opção de ordenar por nome, data de criação ou ícone
- [ ] **Duplicar receita** — botão para criar uma cópia com nome diferente

---

## Tier 2 — Funcionalidades novas

- [ ] **Categorias / tags nas receitas** — ex: "Rápida", "Vegetariana", "Forno"; filtros na grelha
- [ ] **Tema escuro** — toggle claro/escuro com persistência em localStorage
- [ ] **Favoritos** — marcar receitas preferidas e filtrar por elas
- [ ] **Tempo de preparação** — campo opcional por receita; visível no card e no modal
- [ ] **Escala de porções** — multiplicador de ingredientes ao ver uma receita (ex: ×2 para 4 pessoas)
- [ ] **Partilhar plano semanal** — link ou imagem exportável para enviar a outra pessoa

---

## Tier 3 — Infraestrutura

- [ ] **Autenticação de utilizador** — Firebase Auth (Google Sign-In) para dados privados por conta
- [ ] **Multi-utilizador / família** — partilhar um "espaço" com outra conta com permissões de escrita
- [ ] **Backup automático** — exportar para Google Drive / Dropbox periodicamente
- [ ] **Histórico ilimitado** — remover o limite de 3 snapshots; arquivo paginado
- [ ] **Versioning das receitas** — guardar histórico de edições de cada receita

---

## Concluído ✓

- [x] PWA instalável (Android + iOS)
- [x] Sincronização em tempo real via Firebase Firestore
- [x] Lista de compras gerada automaticamente com revisão antes de aplicar
- [x] Importação / exportação JSON com mapeamento inteligente de ingredientes
- [x] Dicionário centralizado de ingredientes com flags Extra/Sopa
- [x] Histórico das últimas semanas
- [x] Auto-icon: ícone emoji atribuído automaticamente por nome/ingredientes
- [x] Deduplicação automática de receitas ao carregar a app
