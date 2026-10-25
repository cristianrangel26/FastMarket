-- Categorias iniciais, confirmação de pagamento manual (enquanto o Mercado Pago
-- não está integrado) e acesso da loja ao nome dos clientes dos seus pedidos.

insert into categories (slug, name, emoji, sort) values
  ('hortifruti', 'Hortifrúti', '🥬', 1),
  ('padaria', 'Padaria', '🥖', 2),
  ('acougue', 'Açougue', '🥩', 3),
  ('laticinios', 'Laticínios', '🧀', 4),
  ('mercearia', 'Mercearia', '🥫', 5),
  ('bebidas', 'Bebidas', '🥤', 6),
  ('limpeza', 'Limpeza', '🧴', 7),
  ('higiene', 'Higiene', '🪥', 8),
  ('congelados', 'Congelados', '🧊', 9),
  ('pet', 'Pet', '🐾', 10)
on conflict (slug) do nothing;

-- A loja (ou o admin) marca o pedido como pago. Será substituída pelo webhook
-- do Mercado Pago; depois disso fica só para pagamentos na entrega.
create or replace function mark_order_paid(p_order_id uuid) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not (owns_store(v_order.store_id) or is_platform_admin()) then
    raise exception 'not_allowed';
  end if;
  if v_order.status <> 'awaiting_payment' then raise exception 'invalid_transition'; end if;
  update orders set status = 'received', payment_status = 'approved' where id = p_order_id returning * into v_order;
  insert into order_events (order_id, status, created_by) values (p_order_id, 'received', auth.uid());
  return v_order;
end;
$$;

-- O cliente pode cancelar enquanto não pagou.
create or replace function cancel_my_order(p_order_id uuid) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'not_allowed'; end if;
  if v_order.status <> 'awaiting_payment' then raise exception 'invalid_transition'; end if;
  update products p set stock = p.stock + i.quantity
    from order_items i where i.order_id = p_order_id and p.id = i.product_id;
  update orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  insert into order_events (order_id, status, created_by) values (p_order_id, 'cancelled', auth.uid());
  return v_order;
end;
$$;

create policy "loja vê clientes dos seus pedidos" on profiles for select using (
  exists (select 1 from orders o where o.customer_id = profiles.id and owns_store(o.store_id))
);
