# Permisos, Licencias y Vacaciones — Ingeniería de Datos

Herramienta chiquita y autocontenida (un solo archivo HTML) para registrar
permisos, licencias y vacaciones del área, con dashboard de control, alerta de
solapamientos entre técnicos y exportación a Excel/CSV.

## Cómo usarla

1. Descargá `index.html` y abrilo con doble clic en cualquier navegador
   (Chrome, Edge, Firefox). **No necesita internet ni instalar nada.**
2. Cargá los registros desde la pestaña **Nuevo registro**.
3. Los datos se guardan automáticamente en ese navegador (localStorage).

> Como los datos viven en el navegador, conviene abrir siempre el archivo desde
> el mismo lugar y hacer **backup** cada tanto (pestaña *Datos → Backup JSON*).

## Qué hace

- **Panel:** métricas (ausentes hoy, pendientes, conflictos, días de vacaciones
  del año), próximas ausencias y días por persona.
- **Nuevo registro:** persona, tipo (Vacaciones / Licencia / Permiso / Otro),
  fechas, estado (Aprobado / Solicitado / Rechazado) y motivo. Calcula días
  corridos y hábiles.
- **Regla de los dos técnicos:** Luciana Campestrini y Néstor Sosa Santander
  están marcados como *técnicos*; si sus ausencias se solapan, el sistema avisa
  al cargar y marca el conflicto en el panel, la tabla y el calendario. La
  coordinación no tiene esta restricción.
- **Registros:** tabla con filtros por persona, tipo, estado y búsqueda por
  motivo; editar y borrar.
- **Calendario:** vista mensual con quién está ausente cada día.
- **Personas:** alta/edición; marcá quién es técnico/a.
- **Datos:** exportar **CSV** (separado por `;`, abre en Excel es-AR),
  exportar **Excel** (`.xls`), **backup/restore** en JSON y borrado total.

## Personalizar

- Cambiá el nombre de la coordinación en **Personas → Editar**.
- Agregá o quitá personas según cambie el equipo.
- La regla de conflicto aplica **solo entre personas marcadas como técnicas**,
  así que sirve igual si el área crece.
