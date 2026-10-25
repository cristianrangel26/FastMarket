-- Marketplace de supermercados: esquema inicial.
-- Valores monetários sempre em centavos (integer).

create extension if not exists "pgcrypto";

-- Perfis --------------------------------------------------------------------

create type user_role as enum ('customer', 'store_owner', 'platform_admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin');
$$;

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- Cria o perfil automaticamente no cadastro.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Lojas ---------------------------------------------------------------------

create type store_status as enum ('pending', 'approved', 'suspended');

create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id),
  slug text not null unique,
  name text not null,
  description text not null default '',
  logo_url text,
  status store_status not null default 'pending',
  address text not null,
  lat double precision not null,
  lng double precision not null,
  offers_delivery boolean not null default true,
  offers_pickup boolean not null default true,
  delivery_radius_km numeric(5, 2) not null default 5,
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  free_delivery_from_cents integer check (free_delivery_from_cents >= 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  -- Definida pela plataforma, não pela loja (ver trigger abaixo).
  commission_bps integer not null default 1000 check (commission_bps between 0 and 10000),
  slot_minutes integer not null default 60 check (slot_minutes > 0),
  prep_minutes integer not null default 60 check (prep_minutes >= 0),
  -- Conta do vendedor no Mercado Pago (OAuth), usada no split do pagamento.
  mp_user_id text,
  created_at timestamptz not null default now()
);

create table store_hours (
  store_id uuid not null references stores (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null check (closes > opens),
  primary key (store_id, weekday, opens)
);

create or replace function owns_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from stores where id = p_store_id and owner_id = auth.uid());
$$;

-- Dono da loja não pode se aprovar nem mudar a própria comissão.
create or replace function protect_store_admin_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.commission_bps := 1000;
    else
      new.status := old.status;
      new.commission_bps := old.commission_bps;
    end if;
  end if;
  return new;
end;
$$;

create trigger stores_protect_admin_fields before insert or update on stores
  for each row execute function protect_store_admin_fields();

-- Catálogo ------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  emoji text not null default '',
  sort integer not null default 0
);

create type product_unit as enum ('un', 'kg', 'g', 'l', 'ml', 'pct');

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  category_id uuid not null references categories (id),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  unit product_unit not null default 'un',
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_store_idx on products (store_id) where active;

-- Endereços -----------------------------------------------------------------

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  label text not null default 'Casa',
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  zip text not null,
  lat double precision not null,
  lng double precision not null
);

-- Pedidos -------------------------------------------------------------------

create type fulfillment as enum ('delivery', 'pickup');
-- 'platform' fica reservado para a fase 2 (entregadores da plataforma).
create type delivery_provider as enum ('store', 'platform');
create type order_status as enum (
  'awaiting_payment', 'received', 'picking', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'
);
create type payment_status as enum ('pending', 'approved', 'rejected', 'refunded');

create table orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  store_id uuid not null references stores (id),
  customer_id uuid not null references profiles (id),
  fulfillment fulfillment not null,
  delivery_provider delivery_provider,
  courier_id uuid references profiles (id), -- fase 2
  -- Cópia do endereço no momento do pedido.
  address jsonb,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  subtotal_cents integer not null,
  delivery_fee_cents integer not null,
  total_cents integer not null,
  platform_fee_cents integer not null,
  store_payout_cents integer not null,
  status order_status not null default 'awaiting_payment',
  payment_status payment_status not null default 'pending',
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  check ((fulfillment = 'delivery') = (address is not null))
);

create index orders_store_idx on orders (store_id, created_at desc);
create index orders_customer_idx on orders (customer_id, created_at desc);

create table order_items (
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  name text not null,
  unit_price_cents integer not null,
  quantity integer not null check (quantity > 0),
  primary key (order_id, product_id)
);

create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  status order_status not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Cria o pedido no servidor: preços, frete, comissão e estoque nunca vêm do cliente.
create or replace function place_order(
  p_store_id uuid,
  p_items jsonb, -- [{ "product_id": uuid, "quantity": int }]
  p_fulfillment fulfillment,
  p_address_id uuid,
  p_slot_start timestamptz
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_store stores;
  v_address addresses;
  v_subtotal integer := 0;
  v_fee integer := 0;
  v_order orders;
  v_item record;
  v_distance double precision;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_store from stores where id = p_store_id and status = 'approved';
  if not found then raise exception 'store_unavailable'; end if;

  if p_fulfillment = 'delivery' then
    if not v_store.offers_delivery then raise exception 'delivery_not_offered'; end if;
    select * into v_address from addresses where id = p_address_id and user_id = auth.uid();
    if not found then raise exception 'address_required'; end if;
    v_distance := 6371 * 2 * asin(sqrt(
      sin(radians(v_address.lat - v_store.lat) / 2) ^ 2 +
      cos(radians(v_store.lat)) * cos(radians(v_address.lat)) * sin(radians(v_address.lng - v_store.lng) / 2) ^ 2));
    if v_distance > v_store.delivery_radius_km then raise exception 'address_out_of_range'; end if;
  elsif not v_store.offers_pickup then
    raise exception 'pickup_not_offered';
  end if;

  if p_slot_start < now() + make_interval(mins => v_store.prep_minutes) then
    raise exception 'slot_too_soon';
  end if;

  insert into orders (
    store_id, customer_id, fulfillment, delivery_provider, address, slot_start, slot_end,
    subtotal_cents, delivery_fee_cents, total_cents, platform_fee_cents, store_payout_cents
  ) values (
    p_store_id, auth.uid(), p_fulfillment,
    case when p_fulfillment = 'delivery' then 'store'::delivery_provider end,
    case when p_fulfillment = 'delivery' then to_jsonb(v_address) - 'user_id' - 'id' end,
    p_slot_start, p_slot_start + make_interval(mins => v_store.slot_minutes),
    0, 0, 0, 0, 0
  ) returning * into v_order;

  for v_item in
    select p.id, p.name, p.price_cents, (i ->> 'quantity')::int as quantity
    from jsonb_array_elements(p_items) i
    join products p on p.id = (i ->> 'product_id')::uuid and p.store_id = p_store_id and p.active
  loop
    if v_item.quantity <= 0 then raise exception 'invalid_quantity'; end if;
    update products set stock = stock - v_item.quantity
      where id = v_item.id and stock >= v_item.quantity;
    if not found then raise exception 'out_of_stock:%', v_item.name; end if;
    insert into order_items (order_id, product_id, name, unit_price_cents, quantity)
      values (v_order.id, v_item.id, v_item.name, v_item.price_cents, v_item.quantity);
    v_subtotal := v_subtotal + v_item.price_cents * v_item.quantity;
  end loop;

  if (select count(*) from order_items where order_id = v_order.id) <> jsonb_array_length(p_items) then
    raise exception 'invalid_items';
  end if;
  if v_subtotal < v_store.min_order_cents then raise exception 'below_min_order'; end if;

  if p_fulfillment = 'delivery'
     and (v_store.free_delivery_from_cents is null or v_subtotal < v_store.free_delivery_from_cents) then
    v_fee := v_store.delivery_fee_cents;
  end if;

  update orders set
    subtotal_cents = v_subtotal,
    delivery_fee_cents = v_fee,
    total_cents = v_subtotal + v_fee,
    platform_fee_cents = round(v_subtotal * v_store.commission_bps / 10000.0),
    store_payout_cents = v_subtotal + v_fee - round(v_subtotal * v_store.commission_bps / 10000.0)
  where id = v_order.id
  returning * into v_order;

  insert into order_events (order_id, status, created_by) values (v_order.id, v_order.status, auth.uid());
  return v_order;
end;
$$;

-- Loja avança o status seguindo o fluxo (o pagamento aprovado vem do webhook, com service role).
create or replace function advance_order(p_order_id uuid, p_status order_status) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_flow order_status[];
  v_idx integer;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not (owns_store(v_order.store_id) or is_platform_admin()) then
    raise exception 'not_allowed';
  end if;

  if p_status = 'cancelled' then
    if v_order.status in ('completed', 'cancelled') then raise exception 'invalid_transition'; end if;
    -- Devolve ao estoque o que foi reservado no pedido.
    update products p set stock = p.stock + i.quantity
      from order_items i where i.order_id = p_order_id and p.id = i.product_id;
  else
    v_flow := case v_order.fulfillment
      when 'delivery' then array['received', 'picking', 'out_for_delivery', 'completed']::order_status[]
      else array['received', 'picking', 'ready_for_pickup', 'completed']::order_status[] end;
    v_idx := array_position(v_flow, v_order.status);
    if v_idx is null or v_flow[v_idx + 1] is distinct from p_status then
      raise exception 'invalid_transition';
    end if;
  end if;

  update orders set status = p_status where id = p_order_id returning * into v_order;
  insert into order_events (order_id, status, created_by) values (p_order_id, p_status, auth.uid());
  return v_order;
end;
$$;

-- RLS -----------------------------------------------------------------------

alter table profiles enable row level security;
alter table stores enable row level security;
alter table store_hours enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

create policy "perfil próprio" on profiles for select using (id = auth.uid() or is_platform_admin());
create policy "editar perfil próprio" on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role());
create policy "admin edita perfis" on profiles for update using (is_platform_admin());

create policy "lojas aprovadas são públicas" on stores for select
  using (status = 'approved' or owner_id = auth.uid() or is_platform_admin());
create policy "cadastrar loja" on stores for insert with check (owner_id = auth.uid());
create policy "dono ou admin edita loja" on stores for update
  using (owner_id = auth.uid() or is_platform_admin());

create policy "horários públicos" on store_hours for select using (true);
create policy "dono gerencia horários" on store_hours for all
  using (owns_store(store_id)) with check (owns_store(store_id));

create policy "categorias públicas" on categories for select using (true);
create policy "admin gerencia categorias" on categories for all
  using (is_platform_admin()) with check (is_platform_admin());

create policy "produtos de lojas aprovadas são públicos" on products for select using (
  (active and exists (select 1 from stores s where s.id = store_id and s.status = 'approved'))
  or owns_store(store_id) or is_platform_admin()
);
create policy "dono gerencia produtos" on products for all
  using (owns_store(store_id)) with check (owns_store(store_id));

create policy "endereços próprios" on addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pedidos só são criados por place_order e alterados por advance_order / webhook.
create policy "ver pedidos" on orders for select
  using (customer_id = auth.uid() or owns_store(store_id) or is_platform_admin());
create policy "ver itens" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or owns_store(o.store_id) or is_platform_admin()))
);
create policy "ver histórico" on order_events for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or owns_store(o.store_id) or is_platform_admin()))
);

-- Atualização em tempo real do status para o cliente e para a loja.
alter publication supabase_realtime add table orders;
