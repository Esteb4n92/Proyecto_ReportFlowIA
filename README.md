<div align="center">

<img src="public/logo-icon.png" alt="ReportFlow IA" width="72" height="72" />

# ReportFlow IA

**Análisis de reportes con IA y aprobación por email.**

</div>

---

## ✨ Qué hace

1. **Sube tus datos** — `.xlsx`, `.xls`, `.csv` o `.json`, con instrucciones opcionales para la IA.
2. **Análisis automático** — Claude detecta patrones, genera hallazgos clave, sugiere los gráficos adecuados y redacta un informe.
3. **Dashboard interactivo** — KPIs/insights, gráficos (bar, line, area, pie, scatter) y análisis en markdown. Puedes pedirle ajustes a la IA en lenguaje natural.
4. **Exporta** — a **PDF** o a **Excel con gráficos nativos editables**.
5. **Aprobación por email** — envías el reporte a un aprobador; recibe un link con token único para aprobar/rechazar (sin login).
6. **Historial** — seguimiento de todos los reportes y su estado en tiempo real.

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, TypeScript) |
| Estilos | Tailwind CSS v4, fuente Geist |
| UI / Motion | [Motion](https://motion.dev), [Phosphor Icons](https://phosphoricons.com) |
| IA | [Claude API](https://www.anthropic.com) (`@anthropic-ai/sdk`, modelo `claude-haiku-4-5`) |
| Base de datos / Auth | [Supabase](https://supabase.com) (Postgres + Auth + RLS) |
| Emails | [Resend](https://resend.com) |
| Gráficos | [Recharts](https://recharts.org) (web) · `exceljs` + `jszip` (Excel) · `@react-pdf/renderer` (PDF) |
| Parsing | `xlsx` (Excel/CSV) · parser propio (JSON) |
| Gestor de paquetes | **pnpm** |

---

<div align="center">
<sub>Construido por <b>AIGILE</b></sub>
</div>
