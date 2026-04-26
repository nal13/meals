# Planeador de Refeicoes — Notas do Projeto

## O que é
Aplicação web de planeamento de refeições semanal.
- **PWA** — instalável no telemóvel como app (ícone no ecrã inicial)
- **Sem servidor** — abre diretamente o `index.html` no browser (ou via servidor local)
- **Funciona offline** — Service Worker faz cache dos ficheiros
- Dados guardados no **localStorage** do browser (não em ficheiros)

---

## Como abrir

### No computador
Faz duplo clique em `index.html` ou arrasta para o browser.
> Nota: o Service Worker (offline) só funciona com HTTPS ou localhost — não com `file://`.

### Para testar/usar como app no telemóvel
Corre um servidor local na pasta do projeto:
```
node -e "require('http').createServer((req,res)=>{require('fs').readFile('.'+req.url+(req.url==='/'?'/index.html':''),(_,d)=>{res.end(d)})}).listen(8080)"
```
Ou, se tiveres Python:
```
py -m http.server 8080
```
Depois abre `http://[IP-do-computador]:8080` no telemóvel (na mesma rede WiFi).
No Chrome Android aparece a opção "Adicionar ao ecrã inicial".

### Hospedar online grátis (Netlify)
1. Vai a [netlify.com](https://netlify.com) e cria conta gratuita
2. Arrasta a pasta `meal-planner` para o painel do Netlify
3. Fica online com link `https://xxxx.netlify.app`

---

## Estrutura de ficheiros
```
meal-planner/
├── index.html           — estrutura da página
├── style.css            — estilos visuais + responsivo mobile
├── script.js            — toda a lógica da aplicação + tabs mobile
├── manifest.json        — configuração PWA
├── sw.js                — Service Worker (cache offline)
├── icon-192.png         — ícone PWA 192x192
├── icon-512.png         — ícone PWA 512x512
├── generate-icons.py    — script para regenerar os ícones PNG
└── NOTAS_PROJETO.md     — este ficheiro
```

---

## Funcionalidades implementadas

### Mobile (PWA)
- Layout responsivo com **3 tabs** no fundo: Semana | Receitas | Compras
- Área de toque aumentada em todos os botões
- Impede zoom automático do iOS nos inputs
- Suporte a safe-area-inset (notch do iPhone)
- Instalável no ecrã inicial (Android Chrome e iOS Safari)
- Funciona offline após primeiro carregamento

### Semana
- Grelha com os 7 dias da semana
- Cada dia tem um dropdown para selecionar uma receita
- Botão X para remover a refeição do dia
- Clicar no nome da receita abre o modal de visualização

### Extra
- Secção para refeições fora da semana normal (ex: lanches repetidos)
- Cada linha tem: dropdown de receita + multiplicador (x vezes)
- Botão para adicionar/remover linhas extra

### Lista de Compras
- Gerada automaticamente a partir das receitas da semana + extras
- Agrega ingredientes iguais e soma quantidades
- Download em `.txt` no formato `ingrediente quantidade` (ex: `leite 4`)

### Receitas
- Grelha com cards de todas as receitas
- Cada receita tem: nome, imagem (opcional), lista de ingredientes com quantidade
- Botões editar `[ed]` e apagar `[x]` em cada card
- Modal para criar/editar receitas
- Modal para visualizar receita com imagem e ingredientes
- Imagens redimensionadas automaticamente (max 600x450, JPEG 0.82)

---

## Armazenamento (localStorage)
| Chave | Conteúdo |
|-------|----------|
| `mp_recipes` | `{ id: { name, ingredients:[{name,qty}], image } }` |
| `mp_week` | `{ 0..6: recipeId }` (0=Segunda, 6=Domingo) |
| `mp_extras` | `[ { id, rid, times } ]` |

**Atenção:** Se limpares os dados do browser, as receitas perdem-se.
Para fazer backup, vai a F12 → Application → Local Storage → copia o valor de `mp_recipes`.

---

## Possíveis melhorias futuras
- [ ] Botão exportar receitas para ficheiro JSON
- [ ] Botão importar receitas de ficheiro JSON (backup/restore)
- [ ] Imprimir lista de compras
- [ ] Notas por receita
- [ ] Categorias/tags nas receitas
- [ ] Tema escuro
- [ ] Sincronização entre dispositivos (ex: Firebase)

---

## Contexto para chat futuro
Para continuar o desenvolvimento num novo chat, diz:

> "Tenho uma aplicação de planeador de refeições em `C:\Users\nanobreg\Downloads\meal-planner\`.
> Ficheiros: index.html, style.css, script.js, manifest.json, sw.js (PWA com tabs mobile).
> Dados em localStorage: mp_recipes, mp_week, mp_extras.
> Lê o ficheiro NOTAS_PROJETO.md para mais detalhes."

## O que é
Aplicação web de planeamento de refeições semanal.
- **Sem servidor** — abre diretamente o `index.html` no browser
- **Sem instalação** — funciona offline
- Dados guardados no **localStorage** do browser (não em ficheiros)

---

## Como abrir
Faz duplo clique em `index.html` ou arrasta para o browser.

---

## Estrutura de ficheiros
```
meal-planner/
├── index.html       — estrutura da página
├── style.css        — estilos visuais
├── script.js        — toda a lógica da aplicação
└── NOTAS_PROJETO.md — este ficheiro
```

---

## Funcionalidades implementadas

### Semana
- Grelha com os 7 dias da semana
- Cada dia tem um dropdown para selecionar uma receita
- Botão X para remover a refeição do dia
- Clicar no nome da receita abre o modal de visualização

### Extra
- Secção para refeições fora da semana normal (ex: lanches repetidos)
- Cada linha tem: dropdown de receita + multiplicador (x vezes)
- Botão para adicionar/remover linhas extra

### Lista de Compras
- Gerada automaticamente a partir das receitas da semana + extras
- Agrega ingredientes iguais e soma quantidades
- Download em `.txt` no formato `ingrediente quantidade` (ex: `leite 4`)

### Receitas
- Grelha com cards de todas as receitas
- Cada receita tem: nome, imagem (opcional), lista de ingredientes com quantidade
- Botões editar `[ed]` e apagar `[x]` em cada card
- Modal para criar/editar receitas
- Modal para visualizar receita com imagem e ingredientes
- Imagens redimensionadas automaticamente (max 600x450, JPEG 0.82)

---

## Armazenamento (localStorage)
| Chave | Conteúdo |
|-------|----------|
| `mp_recipes` | `{ id: { name, ingredients:[{name,qty}], image } }` |
| `mp_week` | `{ 0..6: recipeId }` (0=Segunda, 6=Domingo) |
| `mp_extras` | `[ { id, rid, times } ]` |

**Atenção:** Se limpares os dados do browser, as receitas perdem-se.
Para fazer backup, vai a F12 → Application → Local Storage → copia o valor de `mp_recipes`.

---

## Possíveis melhorias futuras
- [ ] Botão exportar receitas para ficheiro JSON
- [ ] Botão importar receitas de ficheiro JSON (backup/restore)
- [ ] Imprimir lista de compras
- [ ] Notas por receita
- [ ] Categorias/tags nas receitas
- [ ] Tema escuro

---

## Contexto para chat futuro
Para continuar o desenvolvimento num novo chat, diz:

> "Tenho uma aplicação de planeador de refeições em `C:\Users\nanobreg\Downloads\meal-planner\`.
> Ficheiros: index.html, style.css, script.js (pure frontend, sem servidor).
> Dados em localStorage: mp_recipes, mp_week, mp_extras.
> Lê o ficheiro NOTAS_PROJETO.md para mais detalhes."
