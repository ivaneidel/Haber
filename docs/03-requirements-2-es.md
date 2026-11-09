# Especificación funcional — segunda tanda (2026-11-09)

Texto tal como lo entregó la usuaria después de probar la primera versión a fondo. Las
interpretaciones y el plan están en `04-functional-set-2.md`.

---

Nuestros ingresos – Continuación de requerimientos funcionales

Quiero ampliar y completar los requerimientos de la aplicación Nuestros ingresos, tomando como punto de partida lo que ya está desarrollado.

1. Breve resumen de lo que ya estaba definido

La aplicación tiene como objetivo facilitar la administración de los ingresos familiares, principalmente provenientes de alquileres, pero también de otras fuentes.

La estructura funcional inicial contempla:

- Registro de ingresos por alquileres, identificados por propiedad.
- Registro de otros ingresos (Office Galicia, Mercado Pago, efectivo y otras fuentes).
- Registro de ingresos por ventas ocasionales (Mercado Libre, Marketplace, etc.).
- Consolidación mensual y anual de ingresos.
- Relación con una aplicación de gastos que ya está desarrollada por separado.

La planilla Excel original que se utilizaba como referencia tenía dos hojas:

- ALQUILERES EIDELS: ingresos mensuales por propiedad, honorarios y gastos asociados.
- INGRESOS: consolidación de ingresos por distintos medios, gastos generales y resultados mensuales.

Un criterio fundamental es que los alquileres se registran cuando efectivamente se cobran, no cuando simplemente corresponde cobrarlos.

2. Administración de propiedades

Cada propiedad debe tener una ficha individual y permanente con toda su información.

Además de los datos ya contemplados, quiero incorporar:

- Nomenclatura catastral.
- Número de partida inmobiliaria.
- Domicilio completo.
- Identificación de impuestos y servicios.
- Números de cliente o cuenta de:
  - Gas.
  - Electricidad.
  - Agua.
  - Fibra / Internet.
  - Municipalidad.
  - Expensas.
  - Rentas provinciales.
- Observaciones adicionales.

Estos datos deben cargarse una sola vez y reutilizarse en los movimientos posteriores.

3. Control de impuestos, servicios y vencimientos

Cada servicio o impuesto debe tener su propio registro, vinculado a una propiedad.

Necesito poder registrar:

- Servicio o impuesto.
- Número de cliente o cuenta.
- Fecha habitual de vencimiento.
- Importe de la factura.
- Fecha de recepción de la factura.
- Fecha de vencimiento de cada período.
- Fecha efectiva de pago.
- Medio de pago.
- Observaciones.

También quiero registrar cómo recibo cada factura o aviso:

- Email.
- WhatsApp.
- Papel.
- Portal web del proveedor.
- Otro medio.

Cuando corresponda, guardar el email asociado, el portal de acceso y el enlace para consultar la factura.

Debe existir un campo para indicar si la factura fue recibida.

Medios de pago

Incluir, entre otros:

- Efectivo.
- Transferencia bancaria.
- Débito automático.
- PagoMisCuentas.
- Mercado Pago.
- Tarjeta de crédito.
- Otros.

Importante: PagoMisCuentas debe figurar como un medio de pago independiente. Algunos servicios están registrados allí y el sistema conserva el historial de pagos anteriores. No debe confundirse con una transferencia ni con un débito automático.

Recordatorios

Quiero recibir recordatorios con 3 días de anticipación al vencimiento.

También:

- Aviso el día del vencimiento si todavía no está pagado.
- Identificación de obligaciones vencidas.
- El estado debe actualizarse automáticamente al cargar la fecha de pago.
- Si no recibí la factura, debe poder quedar identificado como pendiente de recepción.

La aplicación debe poder enviar notificaciones aunque no esté abierta.

4. Carga ágil y autocompletado

Este es uno de los requerimientos más importantes de toda la aplicación.

La carga mensual debe ser sencilla, rápida y requerir la menor cantidad posible de datos.

Quiero que el sistema proponga automáticamente información de movimientos anteriores.

Por ejemplo, al registrar una factura nueva de gas:

- Debe recordar la propiedad.
- El número de cliente.
- El medio habitual de pago.
- El email o portal donde se recibe.
- El último vencimiento.
- El último importe como referencia.

Para los alquileres debe recuperar los datos del último cobro de cada propiedad y sugerirlos como punto de partida.

Incorporar funciones como:

- Repetir movimiento anterior.
- Copiar datos del mes pasado.
- Autocompletar campos habituales.
- Confirmar y guardar.

Importante: los datos anteriores son sugerencias. Nunca deben generar automáticamente un pago o ingreso sin confirmación del usuario.

Los importes y vencimientos anteriores deben servir como referencia, no asumirse como valores definitivos.

No quiero tener que volver a escribir información que ya está registrada.

5. Gastos asociados a las propiedades y rentabilidad

Aunque existe una aplicación independiente de gastos, esta aplicación de ingresos debe poder registrar los costos vinculados a cada propiedad para calcular su rentabilidad real.

Distinguir tres categorías:

A. Gastos fijos

- Rentas provinciales.
- Impuestos.
- Servicios.
- Expensas.
- Otros costos recurrentes.

B. Gastos en cuotas

- Electrodomésticos.
- Equipamiento.
- Mejoras.
- Otros bienes adquiridos en cuotas.

Registrar importe, cantidad de cuotas, cuota actual, cuotas pendientes y propiedad asociada.

El sistema debe permitir conocer el impacto mensual y los compromisos futuros.

C. Gastos eventuales

- Reparaciones.
- Mano de obra.
- Materiales.
- Trabajos de mantenimiento.
- Otros gastos extraordinarios.

Trabajos realizados en propiedades

Cada intervención debe poder registrarse con:

- Propiedad.
- Fecha.
- Descripción del trabajo.
- Materiales.
- Mano de obra.
- Otros costos.
- Importe total.
- Quién gestionó el trabajo.
- Quién lo abonó.
- Fecha de pago.
- Observaciones.

La carga debe ser mixta y flexible: los campos de materiales y mano de obra son opcionales. A veces recibo un presupuesto o una liquidación con el importe total del trabajo, sin discriminación.

Por ejemplo:

- Si conozco el costo de materiales y mano de obra, los cargo por separado.
- Si solamente conozco el total, cargo ese importe.
- Si tengo información parcial, puedo completar solamente los datos conocidos.

El sistema debe evitar duplicar importes cuando se informa el total junto con algún detalle parcial.

Pago por inmobiliaria o administradora

Incorporar el campo «Quién abonó el trabajo»:

- Yo.
- Inmobiliaria / administradora.
- Inquilino.
- Otro.

En muchos casos la inmobiliaria gestiona y paga el trabajo, pero luego descuenta el importe de la liquidación mensual del alquiler.

En esos casos debe registrarse como gasto de la propiedad y descontarse del alquiler bruto para calcular el importe neto recibido.

Debe quedar identificado que fue pagado por la inmobiliaria y descontado de la liquidación.

Si un gasto fue asumido realmente por otra persona y no se descontó de mis fondos, no debe contabilizarse como un egreso propio.

Es importante evitar duplicaciones.

6. Propiedades desocupadas

Cada propiedad debe tener un estado actual:

- Alquilada.
- Desocupada.
- En reparación.
- En preparación para alquilar.
- En venta.

Cuando una propiedad queda vacía, registrar:

- Fecha desde la que está desocupada.
- Fecha en que vuelve a alquilarse.
- Gastos generados durante ese período.
- Tiempo total de desocupación.
- Costo acumulado de mantenerla vacía.

Los gastos deben seguir registrándose aunque la propiedad no genere ingresos.

Quiero poder conocer cuánto cuesta mantener cada inmueble desocupado y cómo afecta eso a su rentabilidad anual.

7. Rentabilidad de las propiedades

La aplicación debe mostrar por cada propiedad:

- Ingresos brutos anuales.
- Gastos fijos.
- Gastos en cuotas.
- Gastos eventuales.
- Honorarios de administración.
- Resultado neto anual.
- Meses alquilados.
- Meses desocupados.
- Costos de los períodos sin alquiler.

También quiero poder incorporar un valor estimado actual de mercado de cada propiedad, que pueda actualizar cuando sea necesario.

Como son propiedades heredadas, no cuento con los valores originales de adquisición.

Con el valor estimado actual, calcular:

Rendimiento anual neto porcentual = Resultado neto anual / Valor actual estimado del inmueble × 100.

El objetivo es comparar la rentabilidad de las propiedades y conocer cuáles generan mejores resultados.

8. Nuevas fuentes de ingresos: inversiones

Quiero incorporar un módulo específico para registrar futuras inversiones.

Debe permitir cargar:

- Tipo de inversión.
- Entidad o plataforma.
- Fecha de inversión.
- Capital invertido.
- Moneda.
- Rendimiento obtenido.
- Fecha de cobro del rendimiento.
- Capital recuperado.
- Estado: vigente, vencida o rescatada.
- Observaciones.

Es fundamental distinguir:

- Capital invertido.
- Capital recuperado.
- Ganancia o rendimiento obtenido.

La devolución del capital no debe contabilizarse como un ingreso o ganancia.

Los rendimientos efectivamente obtenidos deben incorporarse al resumen de ingresos.

También debe ser posible consultar el rendimiento acumulado de cada inversión.

9. Patrimonio y capital disponible

Incorporar una sección separada de los ingresos habituales para registrar capital y patrimonio.

Por ejemplo:

- Dinero disponible.
- Capital proveniente de venta de propiedades.
- Capital invertido.
- Capital recuperado.
- Valor estimado de propiedades.

Ya se realizó una venta inmobiliaria y quedaron aproximadamente USD 20.000 disponibles.

Además, existe la posibilidad de una futura venta que podría generar aproximadamente USD 130.000 adicionales.

Estos importes deben tratarse como capital extraordinario, no como ingresos habituales ni como rendimientos.

El objetivo es poder conocer cuánto capital tengo, dónde está colocado y qué rendimiento produce.

10. Planificación de ingresos previsionales

Quiero que la aplicación permita distinguir ingresos actuales de ingresos futuros.

Mi jubilación comenzaría aproximadamente en mayo de 2027.

La jubilación de mi marido comenzaría dentro de aproximadamente cuatro años.

Los ingresos previsionales serán relativamente bajos, por lo que los alquileres y las inversiones tendrán un papel importante en la economía familiar.

No deben incorporarse como ingresos actuales antes de que efectivamente comiencen a percibirse.

Sería útil poder visualizar distintos escenarios:

- Situación económica actual.
- Situación desde mayo de 2027, incorporando mi jubilación.
- Situación futura, cuando también se incorpore la jubilación de mi marido.

11. Tablero general e informes

Quiero que la información surja fácilmente, sin necesidad de conocimientos financieros.

El tablero principal debe mostrar, de forma clara:

- Total de ingresos del mes.
- Total de ingresos del año.
- Ingresos por alquileres.
- Otros ingresos.
- Rendimientos de inversiones.
- Gastos asociados a propiedades.
- Resultado neto.
- Evolución mensual.
- Comparación anual.

También quiero poder consultar:

- Rentabilidad de cada propiedad.
- Comparación entre propiedades.
- Gastos por categoría.
- Costos de propiedades desocupadas.
- Rendimientos de inversiones.
- Evolución del patrimonio.

Los indicadores deben estar explicados con lenguaje sencillo. Por ejemplo, en lugar de mostrar solamente «rentabilidad neta», explicar cuánto dinero dejó una propiedad después de descontar sus gastos.

12. Criterios generales de diseño

El nombre de la aplicación es Nuestros ingresos.

Los criterios más importantes son:

1. La carga debe ser ágil y sencilla.
2. Cada dato debe cargarse una sola vez.
3. El sistema debe reutilizar y proponer información anterior.
4. Los cálculos deben ser automáticos.
5. No se deben duplicar gastos ni ingresos.
6. Debe diferenciarse el dinero efectivamente cobrado del que está pendiente.
7. Debe distinguirse capital de inversión de rentabilidad obtenida.
8. Debe permitir incorporar nuevas propiedades y fuentes de ingresos sin modificar toda la estructura.
9. Debe mantener un historial de movimientos.
10. Debe ofrecer información clara para tomar decisiones sin exigir conocimientos financieros.

La idea central es que yo solamente tenga que cargar los movimientos que se producen. El sistema debe encargarse de organizarlos, relacionarlos, calcular resultados y mostrarme la situación económica familiar.

No quiero una aplicación compleja de administrar, sino una herramienta sencilla que me permita tener un control ordenado de nuestros ingresos, nuestro patrimonio, los costos de las propiedades y las rentas que generan.
