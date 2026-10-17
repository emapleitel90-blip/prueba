# Activar datos compartidos

1. Abrir el proyecto de Supabase (o crear uno).
2. En SQL Editor, ejecutar el contenido de `setup.sql`. Descomentar y completar los correos reales de la familia en el INSERT final. Las tablas tienen RLS; una sesión sin un correo autorizado no puede leer ni editar los datos.
3. En Authentication → URL Configuration, usar `https://filoviandas.vercel.app` como Site URL y agregar `https://filoviandas.vercel.app/**` a Redirect URLs. Dejar habilitado el proveedor de correo y los enlaces de acceso. Revisar las restricciones de envío de correo del proyecto; según el proveedor puede requerirse configurar SMTP para que lleguen a los miembros.
4. En Vercel → proyecto → Settings → Environment Variables, agregar para Production:
   - `VITE_SUPABASE_URL`: Project URL de Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: clave **publishable** (o anon legacy). Es pública y se incluye en el navegador. Nunca usar una clave secret ni service_role.
5. Volver a desplegar desde Deployments → Redeploy para incorporar las variables a la compilación.
6. Abrir la web en dos navegadores e ingresar por correo con dos miembros autorizados.

## Prueba real requerida

- En el primer dispositivo: crear una compra de un producto nuevo de 0,9 kg por $8100.
- En el segundo: pulsar Actualizar datos. Debe mostrar 0,9 kg y $9000/kg.
- Editar la cantidad y el total en el segundo. Actualizar el primero y verificar que no duplicó la compra.
- Para probar conflictos: cargar los datos en ambos; guardar un cambio en uno y después en el otro SIN actualizar. El segundo guardado debe rechazarse conservando el borrador. Descargar el borrador y actualizar antes de repetir la edición.
- Cerrar sesión y verificar que no se muestran los registros compartidos.
- Con un correo no autorizado, verificar que no se pueden leer ni editar registros.

La sincronización es al guardar y al pulsar **Actualizar datos**. No hay actualización en tiempo real ni mezcla automática de cambios. Cada guardado exige la versión que se cargó; un conflicto bloquea ediciones nuevas hasta actualizar. Un error de red puede tener un resultado incierto: actualizar primero y comprobar si el movimiento llegó antes de repetirlo.

## Datos que ya existían en el celular

Al activar Supabase se respalda la copia local previa en ese navegador. El botón "Descargar copia previa" permite recuperarla. Importar esa copia reemplaza los datos familiares: hacerlo una sola vez, coordinando con los demás y exportando antes los datos compartidos actuales. No importa ni combina automáticamente datos de varios celulares.

## Estado de validación

Las pruebas automatizadas cubren interfaz, movimientos y guardado/conflictos con un servicio simulado. La compilación se valida con y sin variables de Supabase. La conexión real, las políticas SQL y la entrega de correo requieren la configuración del proyecto y la prueba en dos dispositivos; no están verificadas por las pruebas simuladas.
