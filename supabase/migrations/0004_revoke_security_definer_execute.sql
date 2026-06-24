-- Hardening de seguridad: quitar el permiso EXECUTE de más sobre dos funciones
-- SECURITY DEFINER que quedaban invocables por anon/authenticated vía RPC.
--
-- - handle_new_user(): trigger en auth.users que crea el profile al registrarse.
-- - rls_auto_enable(): event trigger que activa RLS en tablas nuevas de public.
--
-- Ambas se siguen disparando como (event) triggers — eso NO requiere EXECUTE —,
-- así que revocarlo no rompe el registro de usuarios ni el auto-RLS; solo cierra
-- la puerta a que se llamen directo desde la API pública (mínimo privilegio).
--
-- Detectado por el security advisor de Supabase (lints 0028/0029). Aplicada vía MCP.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
