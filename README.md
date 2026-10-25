# Mercado do Futuro

Marketplace de supermercados: o cliente escolhe uma loja da região, monta o carrinho e recebe em casa ou retira na loja. Cada supermercado tem o próprio painel, e a plataforma aprova as lojas e fica com uma comissão sobre as vendas.

## O que já funciona

A versão atual roda em **modo demonstração**: o catálogo vem de dados de exemplo e pedidos ficam guardados no navegador. Dá para percorrer o fluxo inteiro:

- **Cliente** (`/`): lojas ordenadas por distância do endereço, filtros de entrega e retirada, página da loja com busca e categorias, carrinho (uma loja por vez), checkout com escolha de entrega ou retirada, janela de horário e Pix ou cartão (simulados), e acompanhamento do pedido.
- **Lojista** (`/painel`): quadro de pedidos por etapa, edição de preço, estoque e disponibilidade dos produtos, e resumo de vendas com o repasse da loja.
- **Plataforma** (`/admin`): aprovar ou suspender lojas, definir a comissão de cada uma e ver o volume vendido e a receita da plataforma.

## Estrutura

```
apps/web          App web (Next.js 16, React 19, Tailwind 4), instalável no celular (PWA)
packages/shared   Regras do negócio em TypeScript: carrinho, frete, comissão, horários, status do pedido
supabase/         Banco de dados (Postgres/Supabase): tabelas, segurança por usuário (RLS) e funções
```

O app nativo (React Native/Expo) entra depois em `apps/mobile`, reaproveitando `packages/shared` e o mesmo banco.

## Rodando

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # testes das regras do negócio
```

Testes do banco (precisa de um Postgres local):

```bash
PGHOST=localhost PGUSER=postgres ./supabase/tests/run.sh
```

## Decisões

- **Entrega:** no MVP a própria loja entrega. O banco já tem `delivery_provider` e `courier_id` para a fase 2, com entregadores da plataforma.
- **Dinheiro:** sempre em centavos (inteiros).
- **Comissão:** em basis points sobre o subtotal dos produtos; o frete fica com a loja. Só o admin altera.
- **Pedido criado no servidor:** a função `place_order` recalcula preços, frete e comissão, confere área de entrega e horário, e reserva o estoque. O cliente nunca envia valores.
- **Pagamento:** Mercado Pago com split de marketplace (`marketplace_fee` = comissão da plataforma), confirmado por webhook.

## Próximos passos

1. Criar o projeto no Supabase, aplicar `supabase/migrations` e trocar o modo demonstração pelos dados reais, com login.
2. Integrar o Mercado Pago (checkout + webhook) com as contas das lojas conectadas por OAuth.
3. Cadastro de lojas pelo próprio lojista e upload de fotos de produtos.
4. App nativo em `apps/mobile`.
