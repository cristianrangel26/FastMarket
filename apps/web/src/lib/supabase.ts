"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sem as variáveis do Supabase o app roda em modo demonstração. */
export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("Supabase não configurado.");
  client ??= createBrowserClient(url!, key!);
  return client;
}

const ERRORS: Record<string, string> = {
  not_authenticated: "Entre na sua conta para continuar.",
  not_allowed: "Você não tem permissão para isso.",
  store_unavailable: "Esta loja não está aceitando pedidos.",
  delivery_not_offered: "Esta loja não faz entregas.",
  pickup_not_offered: "Esta loja não oferece retirada.",
  address_required: "Informe o endereço de entrega.",
  address_out_of_range: "O endereço está fora da área de entrega da loja.",
  slot_too_soon: "Esse horário não está mais disponível. Escolha outro.",
  invalid_items: "Algum produto do carrinho não está mais disponível.",
  invalid_quantity: "Quantidade inválida.",
  below_min_order: "O pedido não atingiu o valor mínimo da loja.",
  invalid_transition: "O pedido não pode mudar para essa etapa.",
};

/** Converte os códigos de erro das funções do banco em mensagens para o usuário. */
export function friendlyError(error: { message: string }): Error {
  const [code, detail] = error.message.split(":");
  if (code === "out_of_stock") return new Error(`Estoque insuficiente de ${detail}.`);
  if (/Invalid login credentials/i.test(error.message)) return new Error("E-mail ou senha incorretos.");
  if (/already registered/i.test(error.message)) return new Error("Este e-mail já tem cadastro. Entre com sua senha.");
  if (/Email not confirmed/i.test(error.message)) return new Error("Confirme seu e-mail pelo link que enviamos antes de entrar.");
  if (/duplicate key.*slug/i.test(error.message)) return new Error("Já existe uma loja com esse endereço de página. Mude o nome.");
  return new Error(ERRORS[code] ?? error.message);
}
