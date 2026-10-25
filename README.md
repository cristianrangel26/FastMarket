# Mercado do Futuro

Marketplace de supermercados: o cliente escolhe uma loja da região, monta o carrinho e recebe em casa ou retira na loja. Cada supermercado tem o próprio painel, e a plataforma aprova as lojas e fica com uma comissão sobre as vendas.

## O que já funciona

Sem Supabase configurado, o app roda em **modo demonstração**: o catálogo vem de dados de exemplo e os pedidos ficam guardados no navegador. Com Supabase, tudo vem do banco, com login, cadastro de lojas e produtos e status em tempo real. Dá para percorrer o fluxo inteiro:

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

## Colocando no ar com dados reais

1. Crie um projeto no [Supabase](https://supabase.com) e rode, no **SQL Editor**, os arquivos de `supabase/migrations` em ordem (`0001`, depois `0002`).
2. Importe o repositório na [Vercel](https://vercel.com/new) com **Root Directory** = `apps/web` e as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`: a URL do projeto (`https://<código>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: a chave *publishable* ou *anon* (nunca a *secret*/*service_role*)
3. No Supabase, em **Authentication → URL Configuration**, coloque o endereço da Vercel em **Site URL** para os links de confirmação de e-mail funcionarem.
4. Crie sua conta no site e, no SQL Editor, torne-se administrador da plataforma:
   ```sql
   update profiles set role = 'platform_admin'
   where id = (select id from auth.users where email = 'seu@email.com');
   ```

Sem as variáveis do Supabase o app continua em modo demonstração.

## Decisões

- **Entrega:** no MVP a própria loja entrega. O banco já tem `delivery_provider` e `courier_id` para a fase 2, com entregadores da plataforma.
- **Dinheiro:** sempre em centavos (inteiros).
- **Comissão:** em basis points sobre o subtotal dos produtos; o frete fica com a loja. Só o admin altera.
- **Pedido criado no servidor:** a função `place_order` recalcula preços, frete e comissão, confere área de entrega e horário, e reserva o estoque. O cliente nunca envia valores.
- **Pagamento:** Mercado Pago com split de marketplace (`marketplace_fee` = comissão da plataforma), confirmado por webhook.

## Próximos passos

1. Integrar o Mercado Pago (checkout + webhook) com as contas das lojas conectadas por OAuth.
2. Upload de fotos de produtos.
3. App nativo em `apps/mobile`.
