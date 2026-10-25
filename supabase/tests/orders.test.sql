-- Testes do fluxo de pedidos. Rode com: ./supabase/tests/run.sh
\set ON_ERROR_STOP on
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', '{"full_name":"Dono"}'),
  ('00000000-0000-0000-0000-000000000003', '{"full_name":"Cliente"}');
update profiles set role = 'platform_admin' where id = '00000000-0000-0000-0000-000000000001';
update profiles set role = 'store_owner' where id = '00000000-0000-0000-0000-000000000002';

update categories set id = '10000000-0000-0000-0000-000000000001' where slug = 'mercearia';

-- Dono cadastra a loja: entra pendente e com a comissão padrão, mesmo tentando burlar.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into stores (id, owner_id, slug, name, address, lat, lng, delivery_fee_cents, free_delivery_from_cents,
                    min_order_cents, status, commission_bps, prep_minutes)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'loja', 'Loja',
        'Rua X', -23.55, -46.63, 799, 15000, 2000, 'approved', 0, 0);
do $$ begin
  assert (select status from stores) = 'pending', 'loja deveria entrar pendente';
  assert (select commission_bps from stores) = 1000, 'dono não pode definir a comissão';
end $$;
insert into products (id, store_id, category_id, name, price_cents, stock) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'Arroz 5kg', 2500, 3);

-- Cliente não vê loja pendente.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin assert (select count(*) from stores) = 0, 'loja pendente não deveria ser pública'; end $$;

-- Admin aprova.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update stores set status = 'approved';

-- Cliente faz um pedido de entrega.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
insert into addresses (id, user_id, street, number, neighborhood, city, state, zip, lat, lng) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
   'Rua A', '1', 'Centro', 'São Paulo', 'SP', '01000-000', -23.56, -46.64);
do $$
declare o orders;
begin
  o := place_order('20000000-0000-0000-0000-000000000001',
    '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":2}]',
    'delivery', '40000000-0000-0000-0000-000000000001', now() + interval '2 hours');
  assert o.subtotal_cents = 5000, 'subtotal';
  assert o.delivery_fee_cents = 799, 'frete';
  assert o.total_cents = 5799, 'total';
  assert o.platform_fee_cents = 500, 'comissão';
  assert o.store_payout_cents = 5299, 'repasse';
  assert (select stock from products) = 1, 'estoque reservado';

  begin
    perform place_order('20000000-0000-0000-0000-000000000001',
      '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":2}]',
      'pickup', null, now() + interval '2 hours');
    assert false, 'deveria faltar estoque';
  exception when raise_exception then
    assert sqlerrm like 'out_of_stock%', sqlerrm;
  end;

  -- Cliente não pode avançar o status.
  begin
    perform advance_order(o.id, 'received');
    assert false, 'cliente não deveria mudar status';
  exception when raise_exception then
    assert sqlerrm = 'not_allowed', sqlerrm;
  end;
end $$;

-- Loja confirma o pagamento, segue o fluxo e cancela, devolvendo o estoque.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare v_id uuid := (select id from orders);
begin
  assert (select count(*) from profiles where id = '00000000-0000-0000-0000-000000000003') = 1,
    'loja deveria ver o cliente do pedido';
  perform mark_order_paid(v_id);
  assert (select payment_status from orders) = 'approved', 'pago';
  perform advance_order(v_id, 'picking');
  begin
    perform advance_order(v_id, 'completed');
    assert false, 'não pode pular etapa';
  exception when raise_exception then
    assert sqlerrm = 'invalid_transition', sqlerrm;
  end;
  perform advance_order(v_id, 'cancelled');
  assert (select stock from products) = 3, 'estoque devolvido';
  assert (select count(*) from order_events where order_id = v_id) = 4, 'histórico';
end $$;

-- Cliente cancela pedido ainda não pago e não consegue confirmar o próprio pagamento.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$
declare o orders;
begin
  o := place_order('20000000-0000-0000-0000-000000000001',
    '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]',
    'pickup', null, now() + interval '2 hours');
  begin
    perform mark_order_paid(o.id);
    assert false, 'cliente não pode confirmar pagamento';
  exception when raise_exception then
    assert sqlerrm = 'not_allowed', sqlerrm;
  end;
  perform cancel_my_order(o.id);
  assert (select stock from products) = 3, 'estoque devolvido no cancelamento do cliente';
  assert (select count(*) from categories) >= 10, 'categorias iniciais';
end $$;

\echo 'OK: todos os testes de pedidos passaram'
