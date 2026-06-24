-- Guarda el correo del admin que envió el reporte a aprobación, para poder
-- notificarle cuando un aprobador responde (aprueba/rechaza).
alter table public.reports
  add column if not exists sender_email text;
