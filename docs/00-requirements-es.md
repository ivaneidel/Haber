# Especificación funcional (original)

Texto tal como lo entregó la usuaria (redactado con ChatGPT). Es la fuente del alcance; las
interpretaciones y decisiones están en `01-decisions.md`.

---

ESPECIFICACIÓN FUNCIONAL – SISTEMA DE ADMINISTRACIÓN DE INGRESOS Y PATRIMONIO

1. OBJETIVO GENERAL — Aplicación sencilla e intuitiva para administrar los ingresos personales y familiares, principalmente alquileres, también ventas ocasionales, inversiones y futuros ingresos previsionales. Registrar fácilmente los movimientos, conocer ingresos reales, controlar gastos asociados a propiedades, visualizar la rentabilidad de cada inmueble y obtener un panorama económico y patrimonial. *La complejidad debe estar en el sistema, no en el usuario.*

2. CONTEXTO — Alquileres como fuente principal (≈5 cobros significativos por mes como máximo); ventas por Mercado Libre / Marketplace; inversiones financieras previstas; jubilación desde mayo 2027 y la del marido ≈4 años después (haberes bajos); existe otra app para gastos generales; contemplar venta de propiedades e incorporación de ese capital.

3. ALQUILERES — Registrar lo efectivamente cobrado: fecha de cobro, mes al que corresponde, propiedad, inquilino (opcional), importe, medio de cobro, observaciones. Diferenciar fecha de cobro y período. Registro de propiedades (nombre, dirección, localidad/provincia, inquilino, contrato, alquiler de referencia, inicio/fin de contrato, valor de mercado), alta/modificación/baja sin alterar históricos. Resultado por propiedad: cobrado, gastos, neto mensual y anual, evolución, comparación con años anteriores.

4. GASTOS DE PROPIEDADES — A. Fijos (Rentas Río Negro, impuestos, tasas, servicios; periodicidad, importe habitual modificable). B. En cuotas (propiedad, concepto, total, cantidad, valor de cuota, inicio, pagadas, pendientes; pagado por mes y compromisos futuros). C. Eventuales (fecha, propiedad, concepto, importe, medio, observaciones). Resultado neto inmobiliario = cobrado − pagado, por propiedad/mes/año; cuotas en el mes en que se pagan; obligaciones futuras consultables.

5. VENTAS OCASIONALES — Fecha de operación, fecha de cobro, artículo, canal, bruto, comisiones, neto, medio, observaciones. Separadas de alquileres e inversiones.

6. INVERSIONES — Nombre, tipo, entidad, moneda, capital, fecha, vencimiento, rendimiento, fecha de percepción, capital recuperado, estado (vigente/vencida/rescatada). No confundir capital con rendimiento. Ver capital invertido, colocado, disponible, rendimientos percibidos y acumulados, vigentes, vencimientos. ARS y USD sin mezclar ni convertir sin mostrar el tipo de cambio.

7. VENTA DE PROPIEDADES Y PATRIMONIO — Operaciones extraordinarias (venta 2026 con ≈USD 20.000 disponibles; otra prevista ≈USD 130.000) como movimientos de capital: propiedad, fecha, importe, gastos y comisiones, neto, destino, capital disponible. Sección de patrimonio: propiedades, inversiones, capital disponible.

8. INGRESOS PREVISIONALES — Primera jubilación mayo 2027, segunda ≈4 años después; importes a cargar cuando se conozcan; distinguir actuales, futuras y proyecciones; nunca contar futuras como percibidas.

9. TABLERO — Ingresos del mes y del año, gastos de propiedades, neto inmobiliario, rendimientos, otros ingresos, capital disponible e invertido; desglose de ingresos (alquileres, inversiones, ventas, jubilaciones, otros) y de gastos (fijos, cuotas, eventuales); gráficos de ingresos mensuales/anuales, gastos, neto y comparación entre años; filtros por período y propiedad.

10. RENTABILIDAD ANUAL — Por inmueble: renta bruta, gastos, renta neta, rentabilidad % = neta / valor actual estimado × 100 (propiedades heredadas, sin valor de compra); valor actualizable a mano; rentabilidad por propiedad y total, comparación y evolución; no confundir renta con valorización.

11. PROYECCIONES — Escenario actual; desde mayo 2027; ≈4 años después. Ver la importancia de alquileres e inversiones frente a los haberes. Claramente estimaciones, sin mezclarse con lo real.

12. FACILIDAD DE USO — Pantalla única de carga, fecha de hoy por defecto, listas desplegables, propiedades/categorías/medios precargados, campos opcionales, editar, duplicar, autocompletar, validar, buscar y filtrar. Sin carga masiva. Sin conocimientos contables.

13. MONEDAS — ARS y USD; cada movimiento conserva su moneda; reportes por moneda; consolidación solo con tipo de cambio explícito y configurable, indicando fecha y criterio.

14. HISTORIAL — No modificar automáticamente datos de años anteriores al actualizar alquileres, propiedades o valores; consultar evolución histórica; exportar a Excel.

15. BASE DE DESARROLLO — Entidades separadas (propiedades, inquilinos, contratos, ingresos, gastos, cuotas, ventas, inversiones, rendimientos, ventas de inmuebles, patrimonio, tipos de cambio); movimientos individuales, no totales; resúmenes derivados.

16. PRIORIDADES — Etapa 1: propiedades, alquileres, gastos (3 tipos), resultado por propiedad, tablero. Etapa 2: ventas, inversiones, rendimientos, capital, venta de inmuebles. Etapa 3: rentabilidad, comparación, evolución patrimonial, proyecciones.

17. CRITERIO FINAL — Herramienta personal, no sistema contable ni plataforma inmobiliaria profesional. Pocos minutos de carga mensual para una visión clara y confiable.
