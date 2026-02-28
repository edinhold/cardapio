# Ponto Certo - Sistema de Gestão para Restaurantes

Sistema completo para gestão de restaurantes, incluindo menu digital para clientes, painel administrativo e painel de cozinha em tempo real.

## Funcionalidades

- **Menu Digital:** Clientes podem visualizar o cardápio, selecionar mesa ou balcão, e fazer pedidos com observações e adicionais.
- **Painel Administrativo:** Gestão de cardápio, funcionários, mesas, adicionais e visualização de estatísticas de vendas.
- **Painel da Cozinha:** Recebimento de pedidos em tempo real via WebSockets, com alertas sonoros e gestão de status (Pendente, Preparando, Pronto, Entregue).
- **Impressão de Comandas:** Geração de comanda formatada para impressão térmica.
- **Dashboard:** Gráficos de desempenho e resumo de vendas diárias, semanais e mensais.

## Tecnologias Utilizadas

- **Frontend:** React, TypeScript, Tailwind CSS, Lucide React, Recharts, Framer Motion.
- **Backend:** Node.js, Express, WebSockets (ws).
- **Banco de Dados:** SQLite (better-sqlite3).
- **Build Tool:** Vite.

## Como Executar

### Pré-requisitos

- Node.js (v18 ou superior)
- npm ou yarn

### Instalação

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd ponto-certo
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

### Desenvolvimento

Para iniciar o servidor de desenvolvimento (frontend e backend):

```bash
npm run dev
```

O sistema estará disponível em `http://localhost:3000`.

### Produção

1. Gere o build do frontend:
   ```bash
   npm run build
   ```

2. Inicie o servidor:
   ```bash
   npm start
   ```

## Estrutura do Projeto

- `server.ts`: Servidor Express com API e integração de WebSockets.
- `src/App.tsx`: Componente principal com toda a lógica de roteamento e visualizações.
- `src/types.ts`: Definições de tipos TypeScript.
- `restaurant.db`: Banco de Dados SQLite (gerado automaticamente na primeira execução).

## Licença

Este projeto está sob a licença MIT.
