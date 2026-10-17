# Filo viandas

Aplicación web adaptable al celular para gestionar menús, compras, ingredientes y costos.

## Desarrollo

Node.js 24 LTS recomendado (necesario para las dependencias de pruebas actuales).

```sh
npm ci --cache /tmp/filo-npm-cache
npm run dev -- --port 5173
npm test
npm run build
```

## Funciones

- Productos editables, con unidades kg, g, litro, ml y unidad. Cantidades y precios aceptan coma o punto decimal, sin separadores de miles. Se debe usar la misma unidad en compras y recetas; 900 gramos se cargan como 0,9 kg o 900 g, según el producto.
- Compras que permiten elegir cualquier producto registrado o crearlo en el momento; cantidades y total calculan el precio por unidad. Categorías libres y fecha editable.
- Otros gastos sin requisito de ingrediente o cantidad.
- Edición y eliminación de compras nuevas, ajustando diferencias sobre el stock actual. Se rechazan correcciones que dejarían stock negativo. El costo se actualiza al precio de la compra guardada/editada; eliminar una compra conserva el costo unitario actual, editable en Stock.
- Los movimientos anteriores a esta actualización conservan sus importes pero no son editables porque no guardaban el vínculo al ingrediente.
- Recetas editables, precio por vianda y costo de ingredientes/insumos.
- Producción con descuento proporcional de stock y costos históricos. Las ventas se registran junto con la producción; aún no hay edición posterior de jornadas.
- Resultado estimado, sobrantes y costos por menú; exportación e importación JSON validada. Importar reemplaza los datos, no combina versiones.

## Compartir entre celulares

Sin variables de Supabase, funciona localmente por navegador. Para almacenamiento familiar con acceso por correo, configurar `.env.example` en desarrollo o las variables de Vercel, y seguir [supabase/README.md](supabase/README.md). Nunca usar claves secretas en variables VITE_.

Las compras de varios celulares se comparten solo al activar y verificar Supabase. La actualización en otros dispositivos es manual; se detectan conflictos de edición para evitar sobrescrituras silenciosas. No es una PWA ni garantiza funcionamiento sin conexión.

## Control mensual y orientación comercial

Resumen permite elegir mes y ver ventas registradas, compras/gastos pagados, saldo de movimientos, resultado estimado, producción, ventas y sobrantes. Las ventas se consideran cobradas; aún no hay cuentas por cobrar ni conciliación bancaria. El resultado usa ingredientes consumidos y otros gastos, sin volver a descontar las compras de stock.

El mes en curso se compara hasta el mismo día del mes anterior (o su último día si es más corto). Los meses cerrados se comparan completos. El gráfico de seis meses muestra importes nominales; el volumen vendido y el promedio por día registrado ayudan a distinguir cambios de precio de cambios en ventas. Los días sin registro se excluyen del promedio y no se asumen como cero ventas.

Las recomendaciones son reglas explicables, no pronósticos: reservas para reducir sobrantes, revisión de menús con contribución negativa y pruebas de preventa con menús que ya cuentan con registros suficientes. La comparación por menú usa contribución antes de gastos generales. La fecha de una jornada puede cargarse retrospectivamente; el costo corresponde a los precios actuales al momento de cargarla y el consumo descuenta del stock actual.
