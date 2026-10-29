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

- Productos editables, con unidades kg, g, litro, ml y unidad. Cantidades y precios aceptan coma o punto decimal, sin separadores de miles. Compras y recetas permiten elegir g/kg, ml/litro o unidad por ingrediente. Las cantidades y los precios se convierten a la unidad del stock: 300 g a $2500/kg cuestan $750 y consumen 0,3 kg. Las correcciones entre unidades, peso y volumen requieren una equivalencia explícita para ese producto. No se suponen densidades ni tamaños de botellas.
- Inventario inicial y ajustes por conteo separados de las reposiciones. «Ajustar inventario / precio» reemplaza el total disponible y permite corregir el precio de referencia sin registrar un pago. «Sumar compra» abre el producto ya seleccionado y agrega lo comprado al stock existente. No se establece un tope fijo de cantidad; se rechazan números inválidos o que excedan la representación numérica.
- Conteo opcional por paquetes, bolsas o cajas, con cantidad de paquetes y contenido real explícito. 15 paquetes de 500 g son 7,5 kg; 5 paquetes adicionales de 500 g suman 2,5 kg. También admite cajas de unidades y contenidos en litros/ml. Nunca se supone el peso de un paquete.
- Compras que permiten elegir cualquier producto registrado o crearlo en el momento. Se puede ingresar el total del ticket o el precio por unidad/paquete y calcular el total automáticamente. Vista previa de la cantidad que quedará y el nuevo precio para recetas. Categorías libres, fecha de compra editable y marca de fecha/hora de carga conservada al editar.
- Historial filtrable por producto, accesible desde Stock, con cantidad, precio unitario, total, fecha y detalle de la compra. Los paquetes también conservan su presentación y precio por paquete. Las compras previas siguen siendo compatibles.
- Otros gastos sin requisito de ingrediente o cantidad.
- Edición y eliminación de compras nuevas, ajustando diferencias sobre el stock actual. Se rechazan correcciones que dejarían stock negativo. El costo de referencia se actualiza al precio de la última compra guardada/editada, incluso si tiene fecha anterior; no es un promedio ponderado del inventario ni se recalculan jornadas anteriores. Eliminar una compra conserva el costo unitario actual, editable en Stock. Cantidad y precio se validan antes de aplicar cualquier cambio, evitando actualizaciones parciales.
- Los movimientos anteriores a esta actualización conservan sus importes pero no son editables porque no guardaban el vínculo al ingrediente.
- Recetas editables con cantidad y unidad por ingrediente, equivalencia con el stock, costo individual y total de la preparación antes de guardar. La cantidad es para toda la preparación, dividida por su rendimiento.
- En Stock se puede elegir por separado la unidad de cantidad y la unidad del precio. Cambiar kg a g o litro a ml convierte stock, mínimos y costo por unidad, conservando las unidades de compras y consumos anteriores. Los registros antiguos mantienen su unidad original hasta que se editen explícitamente. Las jornadas ya cargadas conservan su costo histórico.
- Para corregir un producto de unidad a litros (o entre otras dimensiones), elegir la nueva medida en Stock → Ajustar inventario / precio e indicar a cuánto equivale 1 unidad actual. Ej.: 1 unidad = 900 ml; 15 unidades pasan a 13,5 litros y $900/unidad a $1000/litro. «Aplicar equivalencia» prepara los campos, y «Guardar inventario y precio» guarda todo junto. Si solo se eligió mal el nombre de la unidad, se puede indicar 1 en la nueva medida. Se convierten también cantidades de recetas, compras (incluido contenido por paquete), consumos de jornadas y consumos familiares, con sus precios por unidad; los totales históricos pagados, costos de jornadas, fechas, porciones e identificadores se conservan. Queda un registro de cada equivalencia aplicada. Cancelar no modifica nada. Para nuevas compras en botellas se usa el contador de paquetes con su contenido real.
- Las cantidades en kg/litro muestran al menos tres decimales (0,360 kg = 360 g). El cero final no cambia el valor. Los costos por unidad admiten decimales para evitar redondear precios por gramo a cero.
- Producción con descuento proporcional de stock y costos históricos. Las ventas iniciales se registran con la producción y luego se pueden actualizar desde «Jornadas de hoy» o «Jornadas del mes» en Resumen. Se carga el total acumulado vendido (entre 0 y las porciones preparadas), sin repetir el consumo de ingredientes ni cambiar el costo o el precio históricos. La producción registrada no se edita con esta opción.
- Resultado estimado, sobrantes y costos por menú; exportación e importación JSON validada. Importar reemplaza los datos, no combina versiones.

## Pedidos y clientes

Pedidos permite registrar nombre del cliente, menú, cantidad entera de porciones, fecha (incluidos próximos días), teléfono y horario opcionales, retiro por el cliente o entrega a domicilio con dirección obligatoria, observaciones y estado Pendiente/Listo/Entregado/Cancelado. Se puede editar, filtrar por fecha/estado, consultar todas las fechas y eliminar cargas erróneas. Cancelar conserva el historial; los pedidos del día se muestran también en Hoy. No se envían mensajes ni se exige tener un teléfono.

Se pueden tomar pedidos antes de cocinar, sin jornada asignada. Cuando se registra la producción en Hoy, se puede editar cada pedido y vincularlo a una jornada del mismo menú, preparada hasta la fecha de entrega. La vinculación agrega un identificador estable a jornadas antiguas que no lo tenían. La suma de pedidos no cancelados de una jornada no puede superar su producción menos las porciones de casa. Los consumos familiares de viandas preparadas respetan el mayor entre ventas registradas y pedidos asignados, para poder identificar ventas que ya estaban cargadas sin sumar dos veces sus porciones. No se pueden eliminar jornadas mientras tengan pedidos vinculados, incluso cancelados: primero se reasignan o se eliminan las cargas erróneas.

**Los pedidos son una agenda de porciones y entregas; no son un registro de cobros.** Guardar, editar, cancelar, eliminar o marcar entregado un pedido no cambia las ventas, precios históricos ni el stock de ingredientes. Las ventas continúan cargándose desde Actualizar ventas en Hoy/Resumen. No se distinguen pagos o cuentas por cobrar en este módulo. Los pedidos sin jornada no reservan stock ni garantizan producción disponible.

Los datos se guardan en el mismo documento familiar, con las mismas restricciones de acceso y control de versión. Las copias anteriores sin `orders` siguen siendo válidas. Exportar/importar incluye pedidos y valida sus referencias, estados y cantidades. Los datos personales del cliente permanecen dentro del acceso familiar existente. Es necesario recargar los dispositivos para usar la actualización.

## Porcentaje de gastos adicionales en recetas

En Recetas → Editar receta se puede indicar «Gastos adicionales (%)» o usar el botón «Aplicar 10% de gastos adicionales». El porcentaje se aplica una sola vez sobre el costo de todos los ingredientes y se divide por el rendimiento. Ej.: $2000 de ingredientes por porción + 10% ($200) = $2200 de costo presupuestado por vianda. Admite coma o punto y porcentajes decimales. Cero deja el costo de ingredientes; las recetas anteriores parten de cero hasta que se elija y guarde un porcentaje.

La pantalla muestra ingredientes por porción, adicional, costo total por vianda y total de toda la preparación. El precio de venta sigue siendo un campo independiente. El porcentaje es una estimación global para costos que no se hayan incluido ya como ingredientes, como electricidad, trabajo o insumos menores. No determina cantidades físicas de sal, aceite o envases: si se necesitan controlar en stock, se cargan como ingredientes.

Al registrar una nueva jornada se conservan el costo de ingredientes, el porcentaje y el adicional presupuestado de ese momento. Editar una receta no recalcula jornadas anteriores. Las cantidades consumidas de stock dependen de los ingredientes, no del porcentaje.

Resumen incluye un presupuesto de producción para el negocio, con el adicional separado. Las compras, pagos y resultado del negocio continúan usando ingredientes consumidos y gastos reales registrados, para no descontar a la vez el adicional estimado y el mismo gasto pagado. Familia conserva el costo histórico de los ingredientes y las porciones de casa se excluyen del presupuesto comercial.

## Consumo familiar

La sección Familia usa el mismo stock que el emprendimiento y parte de cuatro personas/porciones, editable en cada registro. No descuenta una comida automáticamente ni supone que siempre comieron los cuatro.

- Ingredientes sueltos: se carga la cantidad total usada entre todos, con g/kg, ml/litro o unidad. Se descuenta una sola vez, sin multiplicar por las personas.
- Receta para casa: escala sus ingredientes al número de porciones. Conserva el rendimiento y los ingredientes usados como una copia del momento del consumo, para que editar la receta después no modifique el historial.
- Viandas ya preparadas: se vinculan a una jornada existente y se asignan solo las porciones que quedan después de ventas y consumos familiares. No vuelven a descontar ingredientes. La primera asignación agrega un identificador estable a jornadas antiguas que no lo tenían.
- Cada consumo guarda fecha, detalle, cantidades y costo histórico. Corregirlo aplica diferencias sobre el stock actual; anular una carga errónea restituye los ingredientes o las porciones correspondientes. Se impiden cantidades insuficientes, fechas futuras y consumos anteriores a la preparación.
- Las ventas posteriores no pueden usar porciones asignadas a casa. Una jornada con consumos familiares vinculados no se puede eliminar hasta corregir o anular esas asignaciones.

Resumen distingue consumo familiar, ventas y porciones disponibles. El costo de viandas destinadas a casa se separa de la producción para el negocio en la fecha de la jornada original; el historial familiar informa el consumo en su fecha efectiva. Los ingredientes usados directamente en casa no generan producción comercial. Las compras siguen reflejando todo lo pagado por el stock compartido: el consumo familiar no agrega otro pago. No es una valoración por lotes ni una contabilidad fiscal.

Las copias y datos compartidos anteriores, sin historial familiar, siguen siendo válidos. Los registros nuevos se guardan en el mismo documento familiar y usan el control de versión existente. Todos los dispositivos deben recargar la app para utilizar estas reglas. Las fechas operativas se calculan en horario de Córdoba.

## Compartir entre celulares

Sin variables de Supabase, funciona localmente por navegador. Para almacenamiento familiar con acceso por correo, configurar `.env.example` en desarrollo o las variables de Vercel, y seguir [supabase/README.md](supabase/README.md). Nunca usar claves secretas en variables VITE_.

Las compras de varios celulares se comparten solo al activar y verificar Supabase. La actualización en otros dispositivos es manual; se detectan conflictos de edición para evitar sobrescrituras silenciosas. Si una lectura o guardado falla, un aviso permanece visible al desplazarse y permite actualizar los datos para recuperar la edición. «Ajustar inventario / precio» y «Sumar compra» también pueden iniciar esa recuperación: primero cargan una versión válida y después abren el producto con sus valores actuales. Los borradores de cargas fallidas se conservan; no se aplican sobre otros cambios automáticamente. Si falta la sesión, se dirige al acceso y se mantienen bloqueados los formularios. Renovar la sesión permite recuperar errores anteriores sin consultar Supabase dentro del callback de autenticación. No es una PWA ni garantiza funcionamiento sin conexión.

## Control mensual y orientación comercial

Resumen permite elegir mes y ver ventas registradas, compras/gastos pagados, saldo de movimientos, resultado estimado, producción, ventas y sobrantes. Las ventas se consideran cobradas; aún no hay cuentas por cobrar ni conciliación bancaria. El resultado usa ingredientes consumidos y otros gastos, sin volver a descontar las compras de stock.

El mes en curso se compara hasta el mismo día del mes anterior (o su último día si es más corto). Los meses cerrados se comparan completos. El gráfico de seis meses muestra importes nominales; el volumen vendido y el promedio por día registrado ayudan a distinguir cambios de precio de cambios en ventas. Los días sin registro se excluyen del promedio y no se asumen como cero ventas.

Las recomendaciones son reglas explicables, no pronósticos: reservas para reducir sobrantes, revisión de menús con contribución negativa y pruebas de preventa con menús que ya cuentan con registros suficientes. La comparación por menú usa contribución antes de gastos generales. La fecha de una jornada puede cargarse retrospectivamente; el costo corresponde a los precios actuales al momento de cargarla y el consumo descuenta del stock actual.
