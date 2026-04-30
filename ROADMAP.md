# ROADMAP — Planeador de Refeições

Ideias e funcionalidades futuras organizadas por tema. Sem ordem de prioridade definida.

---

## 💰 Preços & Supermercados

- **Integração de preços por supermercado** — ir buscar automaticamente os preços dos ingredientes a diferentes cadeias (Continente, Pingo Doce, Lidl, Aldi, etc.), via scraping ou APIs públicas quando disponíveis
- **Associar ingredientes a preços** — ligar cada ingrediente do dicionário a um preço médio ou ao preço mais barato encontrado nos supermercados consultados
- **Comparador de preços na lista de compras** — mostrar, para cada item da lista, onde está mais barato nessa semana
- **Estimativa do custo semanal** — calcular o custo total da lista de compras com base nos preços associados
- **Histórico de preços** — guardar a evolução de preços ao longo do tempo para detetar promoções ou inflação

---

## 🥦 Nutrição

- **Associar nutrientes aos ingredientes** — ligar cada ingrediente do dicionário a valores nutricionais (calorias, proteína, hidratos, gordura, fibra, etc.) a partir de bases de dados abertas (Open Food Facts, USDA FoodData Central)
- **Nível nutricional por refeição** — calcular e mostrar os nutrientes totais de cada receita com base nas suas quantidades de ingredientes
- **Nível nutricional semanal** — agregar os nutrientes de todas as refeições do plano semanal e comparar com doses diárias de referência (DRI/RDA)
- **Alerta de défices** — identificar semanas em que algum macro ou micronutriente está abaixo do recomendado
- **Etiqueta nutricional** — mostrar um resumo visual tipo "semáforo" (verde/amarelo/vermelho) para cada receita

---

## 🔍 Descoberta de Receitas

- **Sugestão automática** — sugerir receitas com base nos ingredientes disponíveis em casa ou que sobram de semanas anteriores
- **Filtros por restrição alimentar** — vegetariano, vegan, sem glúten, sem lactose, etc.
- **Importar receita por URL** — extrair automaticamente ingredientes e passos de sites de culinária

---

## 🗓️ Planeamento

- **Templates de semana** — guardar configurações de semana tipo (ex: "semana de proteínas", "semana económica") para reutilizar rapidamente
- **Rotação automática** — gerar o plano da semana evitando repetir receitas das últimas N semanas (com base no histórico)
- **Plano por pessoa** — adaptar as quantidades consoante o número de pessoas do agregado

---

## 🛒 Lista de Compras

- **Lista por secção do supermercado** — agrupar os itens por corredor (frutas, lacticínios, carnes, etc.) para tornar as compras mais rápidas
- **Partilha da lista** — gerar um link ou QR code para partilhar a lista com outro membro do agregado
- **Integração com app do supermercado** — exportar a lista diretamente para apps como Continente ou Pingo Doce

---

## ⚙️ Técnico / Infraestrutura

- **Modo multi-utilizador** — suporte a famílias com vários perfis separados na mesma conta Firebase
- **Backup e exportação** — exportar todas as receitas e histórico em JSON ou CSV
- **PWA offline melhorado** — sincronização incremental para funcionar melhor em ligações lentas
