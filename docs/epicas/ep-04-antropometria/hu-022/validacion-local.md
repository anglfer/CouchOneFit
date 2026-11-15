# Validación local de la evolución antropométrica

## Flujo del profesional

1. En **Clientes → expediente → Evaluación → Nueva evaluación**, elegir el método, introducir la fecha efectiva y capturar las mediciones disponibles. Si se omite la fecha efectiva, el servidor usa el día UTC en el que confirma el registro.
2. Al guardar se agrega una evaluación al historial. La aplicación indica si el servidor confirmó el guardado o si la operación sigue pendiente de sincronización.
3. En **Evaluación → Evolución antropométrica**, elegir medición, método y periodo. La tabla muestra las fechas y las lecturas disponibles. La gráfica conserva los huecos y separa registros con protocolos incompatibles.
4. Con el cálculo candidato de HU-023 habilitado en desarrollo local, elegir **Grasa corporal estimada** para comparar el porcentaje preliminar de los registros guardados. La opción **Grasa corporal medida** muestra los valores informados, como los de bioimpedancia. Desde **Historial confirmado** se puede desplegar cada evaluación y consultar sus mediciones de origen.

## Contrato

`candidateBodyFat` amplía de forma opcional cada muestra de [evolución](../../../api/identity-lifecycle.openapi.json). Incluye porcentaje guardado y versiones técnicas de fórmula y dominio. Conserva la precisión original para la serie y la Web muestra un decimal. Los candidatos se omiten al deshabilitar el cálculo, en producción y cuando faltan entradas o el servidor marca el resultado como no disponible. La gráfica une resultados candidatos solo cuando son comparables según el protocolo, versiones y fechas.

Las páginas de mediciones y el detalle visitado se pueden recuperar de la caché cifrada de la misma cuenta. La caché específica de la serie omite los porcentajes candidatos y la vista avisa que esa comparación requiere el servidor local habilitado. Las páginas sin consultar requieren conexión.

## Evidencia

- **T — Suites completas:** API 242/242 (incluye la suite física y la de migraciones), Web 146/146. Compilaciones API y Web, lint y formato de los archivos Web modificados aprobados. Vite conserva el aviso del tamaño del paquete que ya se observaba en la revisión inicial.
- **T — Navegador y PostgreSQL con datos sintéticos:** la serie de pliegues presentó 13.1 % y 12.5 %, con un segmento entre sus dos fechas. La evaluación de bioimpedancia quedó como «Sin estimación» en esa serie y aportó 15.2 % a la serie medida. La consola no registró errores ni advertencias durante la comprobación.
- **T — PostgreSQL aislado:** instalación limpia y actualización con historial conservado. El arnés físico exige una URL de preparación explícita en `127.0.0.1`, puerto distinto de 5432, base `postgres`, PostgreSQL 17 o superior y opt-in `HU022_TEMPORARY_PG_AUTHORIZED=yes`. Creó y retiró sus propios recursos. La prueba cubrió idempotencia, datos insuficientes, permisos y ocultamiento en producción.
- **T — Caché:** página posterior a la primera recuperada sin red por la misma cuenta, rechazada tras cambiar de cuenta. La serie medida y la estimada muestran valores distintos y las lecturas almacenadas de la serie omiten los candidatos.
- **E — Pendientes:** revisión independiente D0 y comprobación sin red en un dispositivo. La habilitación del cálculo aprobado conserva las [condiciones de HU-023](../hu-023/condiciones-desbloqueo.md).

## Medición inicial en Evolución

- **E.** Al abrir Evolución se selecciona grasa corporal medida. En desarrollo local, si la página consultada ya incluye resultados candidatos visibles, se selecciona grasa corporal estimada. Una selección manual se conserva al actualizar la consulta. «Peso de evaluación» identifica el peso registrado por el profesional en esta vista. El peso de check-in corresponde a HU-037.
- **T.** La regresión Web comprueba la selección inicial con y sin estimaciones, la conservación de la selección manual y la consulta explícita de peso de evaluación.
- **T.** Con respuestas sintéticas, Chrome abrió la tabla con 13.1 % y 12.5 % en sus respectivas fechas y mostró el peso profesional al elegir «Peso de evaluación».
