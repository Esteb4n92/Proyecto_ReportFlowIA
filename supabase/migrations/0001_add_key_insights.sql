-- Hallazgos clave estructurados que devuelve Claude (alimentan las tarjetas
-- del dashboard, en vez de extraerlos del markdown con regex).
-- Cada item: { "label": string, "value": string, "description": string }
alter table public.reports
  add column if not exists key_insights jsonb;

comment on column public.reports.key_insights is
  'Array de hallazgos clave {label,value,description} generado por la IA';
