# Filo viandas

Primera versión web adaptable al celular para registrar menús, compras, ingredientes y costos.

## Desarrollo

Requiere Node.js 22.12 o superior.

```sh
npm ci --cache /tmp/filo-npm-cache
npm run dev -- --port 5173
```

Compilación: `npm run build`.

## Alcance actual

- Ingredientes con cantidades, unidad, costo y mínimo editable.
- Compras que aumentan stock y actualizan el costo al último precio comprado.
- Recetas editables con rendimiento, ingredientes y precio de venta.
- Jornadas con producción y ventas registradas juntas; consumo proporcional y validación de stock.
- Costos históricos fijados al registrar producción, incluyendo porciones sobrantes.
- Resumen acumulado con margen antes de otros gastos por menú y resultado estimado general.
- Exportación JSON de respaldo (importación pendiente).

Los ejemplos están identificados y pueden borrarse desde la interfaz. Los registros se guardan en localStorage por navegador. No hay sincronización, cuentas, backend, instalación PWA ni funcionamiento sin conexión garantizado. No usar como único registro comercial antes de implementar respaldo recuperable y almacenamiento compartido. No se puede corregir una jornada ya registrada desde la interfaz; sí se pueden editar ingredientes y recetas. El precio de venta de cada jornada corresponde a la receta en el momento de registrarla.

Próxima etapa: almacenamiento compartido y acceso familiar, edición de jornadas con reversión de stock, fechas de compras, backups recuperables y vencimientos/lotes.
