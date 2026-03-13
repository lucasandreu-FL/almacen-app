# GÜERJAUS TBT — Borrador de Casos

> Estado: **pendiente de validación**. Una vez confirmados, se exportan a `casos.json`.
> Los casos están anonimizados: sin nombres de cliente, producto ni ubicación específica.
> Duración estimada por caso: ~14-15 min (Stage 1+debate → Stage 2+debate → Stage 3+quiz+resultados)

---

## Cómo leer este documento

Cada caso tiene:
- **Puntos base** y **dificultad estimada**
- **Stage 1/2/3** con criterio de calidad
- **4 respuestas** — las marcadas con `⭐` son las dos más plausibles tras la pista
- **✅ Correcta** marcada explícitamente
- **Moraleja** — la lección que deja el caso (a incorporar en plantilla a futuro)

---

---

## CASO 1 — "El Sistema que Durmió el Almacén"
**Puntos:** 200 | **Dificultad:** ⭐⭐⭐⭐⭐

> *Inspirado en: deadlock de concurrencia en producción con almacén de alta rotación*

### Stage 1
A las 10 de la mañana, en un almacén con más de mil quinientos pedidos diarios, todos los operarios quedan bloqueados simultáneamente: cada intento de completar una operación en el sistema de gestión se congela y acaba en error. El responsable de turno escala la incidencia como crítica. No ha habido ningún despliegue reciente. Hay pedidos urgentes que no pueden salir.

### Stage 2
Los técnicos acceden a los logs del servidor. Detectan errores repetidos en la capa de gestión de stock del tipo "proceso en espera de recurso ocupado". El bloqueo comenzó exactamente cuando el turno de mañana arrancó con sus dos equipos trabajando en paralelo sobre el mismo tipo de albaranes. Cuando se prueba con un solo operario activo, el sistema responde con normalidad. La configuración no ha cambiado. No hay errores en los despliegues anteriores.

### Stage 3
En el log de base de datos hay dos procesos que llevan más de ocho minutos esperándose mutuamente: cada uno retiene un bloqueo sobre el recurso que el otro necesita para continuar.

### Respuestas
- A. Reiniciar el servidor para liberar los bloqueos y operar con un operario por turno hasta localizar la causa
- B. Identificar y cancelar los dos procesos bloqueados, analizar qué operación los originó y revisar si el módulo de reservas de stock necesita gestión de concurrencia
- C. Hacer rollback al despliegue anterior asumiendo que hay un bug reciente no detectado
- D. Limitar el acceso al sistema a un operario simultáneo por tipo de albarán hasta resolver el problema

**✅ Correcta: B** — D alivia el síntoma pero no identifica la causa ni la previene. A es parche sin diagnóstico. C parte de una hipótesis incorrecta (no hubo despliegue).

### Moraleja
Un sistema que funciona perfectamente en pruebas puede colapsar bajo carga concurrente real. La diferencia entre "funciona en test" y "funciona con veinte operarios simultáneos" solo se descubre con pruebas de carga en condiciones reales.

---

---

## CASO 2 — "La Mejora que Paró el Almacén"
**Puntos:** 200 | **Dificultad:** ⭐⭐⭐⭐⭐

> *Inspirado en: refactorización del selector de parámetros del SGA revertida en producción*

### Stage 1
Lunes por la mañana. Los operarios reportan que el sistema de gestión del almacén "se ha roto": al escanear productos en las preparaciones de pedido, la pantalla se queda en blanco o lanza un error genérico. El viernes todo funcionaba. El almacén lleva dos horas con las salidas paralizadas y hay pedidos con entrega comprometida para hoy.

### Stage 2
El equipo técnico localiza un despliegue realizado el viernes tarde: una mejora en el módulo que gestiona la selección de líneas cuando un albarán tiene varias del mismo producto. La mejora fue validada en el entorno de pruebas sin incidencias. Al comparar los albaranes reales con los de prueba, se descubre un patrón que no existía en test: hay albaranes con dos líneas del mismo producto que no se diferencian en ningún atributo (mismo lote, misma ubicación, mismo paquete). Este caso no se contempló al redactar las pruebas funcionales.

### Stage 3
El módulo actualizado abre siempre la pantalla de selección cuando detecta más de una línea del mismo producto, sin verificar previamente si esas líneas tienen algún campo distinto que el operario pueda escoger.

### Respuestas
- A. Pedirle al cliente que consolide manualmente las líneas duplicadas antes de continuar operando
- B. Revertir el despliegue para restaurar la operativa de inmediato, y abrir una nueva tarea documentando el caso real no contemplado en pruebas
- C. Corregir el módulo para que solo abra la selección cuando las líneas realmente difieren, sin revertir, y desplegar la corrección hoy mismo
- D. Deshabilitar la pantalla de selección en todos los albaranes hasta tener el fix

**✅ Correcta: B** — C es la solución técnica ideal a medio plazo, pero en producción con el almacén parado la prioridad es restaurar la operativa. C requiere desarrollo, pruebas y un nuevo despliegue que no se puede garantizar en horas. Revertir es inmediato y seguro.

### Moraleja
Una mejora técnica correcta puede romper producción si los datos de test no representan la diversidad real del cliente. Validar funcionalmente con datos reales del entorno de producción es tan crítico como las pruebas técnicas.

---

---

## CASO 3 — "Los Albaranes que Desaparecieron"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: eliminación de albaranes en almacén multisede, stock descuadrado y sin trazabilidad*

### Stage 1
El equipo de logística detecta que no puede generar etiquetas de envío para más de cuarenta albaranes. El sistema indica que esos documentos no tienen asociado ningún pedido de venta de origen. Los albaranes existen, están en estado "listo" y los productos están físicamente preparados. Sin etiqueta no puede salir ningún paquete.

### Stage 2
Investigando, se descubre que unos días atrás se realizó una operación de limpieza de datos en el sistema: se eliminaron registros que se consideraban de prueba. Los albaranes afectados tienen sus líneas de movimiento con información incompleta: falta el pedido de venta de origen y el grupo de abastecimiento. La empresa gestiona tres almacenes distintos en el mismo sistema. Los albaranes del mismo período de los otros dos almacenes están correctamente vinculados y no presentan ningún problema.

### Stage 3
Todos los albaranes afectados pertenecen exclusivamente al almacén donde se ejecutó la operación de limpieza. Ningún albarán de los otros dos almacenes con las mismas fechas está afectado.

### Respuestas
- A. Regenerar los albaranes afectados desde los pedidos de venta originales y cancelar los actuales
- B. Restaurar la base de datos al estado anterior a la limpieza, revisar exactamente qué fue eliminado y reasociar los albaranes a sus pedidos originales
- C. Identificar cada albarán afectado, asociarlo manualmente a su pedido de venta usando la documentación disponible, y revisar el impacto en contabilidad antes de generar las etiquetas
- D. Emitir las etiquetas sin pedido de venta asociado usando solo la dirección de destino y reconciliar la trazabilidad después del envío

**✅ Correcta: C** — B puede ser ideal técnicamente pero si han transcurrido días hay operaciones intermedias que se perderían. A crea duplicados. D rompe la trazabilidad contable. C es lento pero seguro y auditable.

### Moraleja
Las operaciones de limpieza de datos en producción deben estar acotadas con precisión quirúrgica. En sistemas multisede, una acción aparentemente local puede cortar la trazabilidad de documentos que afectan a contabilidad, logística y cliente final.

---

---

## CASO 4 — "Más Mercancía de la que Toca"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: SGA procesando unidades por encima de la reserva, generando stock negativo*

### Stage 1
El responsable de calidad detecta que varios albaranes de salida contienen más unidades registradas como procesadas de las que tenían asignadas originalmente. En algunos hay líneas nuevas que no existían cuando el picking fue generado. El stock de varios referencias aparece en negativo. Los pedidos han salido y los clientes no se han quejado.

### Stage 2
Se revisan los albaranes afectados: los operarios procesaron más unidades de las asignadas en el sistema de gestión del almacén y el sistema no lanzó ningún aviso ni bloqueó la operación. Los operarios confirmaron que siguieron el procedimiento habitual. Las líneas extra fueron creadas automáticamente por el sistema al superar la cantidad asignada. El problema se repite con distintos operarios, distintos turnos y distintas referencias de producto.

### Stage 3
El módulo de validación del sistema permite procesar más unidades que las reservadas si existe stock físico disponible en la ubicación, generando automáticamente una línea adicional en el albarán en lugar de detener la operación.

### Respuestas
- A. Bloquear todos los pickings activos y pedir a los operarios que revisen manualmente cada uno
- B. Ajustar el stock negativo con un inventario de regularización y activar la opción de "cantidad exacta" en los tipos de operación
- C. Corregir el módulo para que valide contra la cantidad reservada antes de procesar, revertir los albaranes con exceso y regularizar el stock afectado
- D. Configurar los tipos de operación para que no permitan modificar cantidades y ajustar el stock negativo manualmente

**✅ Correcta: C** — D corrige la configuración pero no la lógica del módulo, que seguirá sin validar correctamente en otros escenarios. B regulariza el síntoma sin corregir la causa. C es la única opción que corrige la raíz del problema y el impacto de datos.

### Moraleja
Un sistema que facilita la operativa omitiendo validaciones puede generar inconsistencias de datos más costosas de corregir que la fricción que intentaba eliminar. Cada validación que se "flexibiliza" debe tener consecuencias controladas.

---

---

## CASO 5 — "El Cierre Fiscal que No Llega"
**Puntos:** 200 | **Dificultad:** ⭐⭐⭐⭐⭐

> *Inspirado en: descuadre en valoración de inventario que impide cierre de año fiscal, segunda vez en el año*

### Stage 1
A finales de diciembre, el departamento financiero no puede cerrar el ejercicio. El informe de valoración del inventario muestra una diferencia de varios miles de euros respecto al valor calculado internamente. No es la primera vez: hace unos meses se produjo la misma situación, se resolvió y se cerró la tarea. El tiempo invertido en aquella resolución no pudo facturarse al cliente.

### Stage 2
El equipo analiza el informe de valoración en detalle. Se detectan movimientos de stock con destinos inconsistentes: el movimiento en sí apunta a una ubicación, pero su línea de detalle apunta a otra diferente. Esta divergencia hace que el cálculo del valor del inventario difiera dependiendo de desde qué vista del sistema se consulte. Ambas vistas son internamente coherentes, pero no coinciden entre sí. La antigüedad de estos movimientos inconsistentes se remonta a varios meses atrás.

### Stage 3
Varios de los movimientos con destinos inconsistentes fueron generados durante un ajuste de inventario realizado hace un trimestre. Ese ajuste se ejecutó de forma manual sin seguir el procedimiento habitual del sistema.

### Respuestas
- A. Realizar un inventario físico completo del almacén y ajustar todos los valores del sistema al recuento real
- B. Identificar y corregir los movimientos con destinos inconsistentes, documentar el procedimiento de ajuste correcto y revisar todos los ajustes del trimestre anterior
- C. Usar el valor del informe de inventario como referencia oficial para el cierre y registrar la diferencia como pérdida en la contabilidad
- D. Reabrir la tarea anterior y escalar a soporte del fabricante del ERP solicitando un parche del módulo de valoración

**✅ Correcta: B** — A corrige los síntomas pero no la causa: si hay movimientos inconsistentes el inventario físico no los resuelve. C y D no son soluciones. B es la única opción que identifica la causa raíz, corrige los datos y previene la recurrencia.

### Moraleja
Una tarea cerrada sin identificar la causa raíz es tiempo prestado, no ganado: el problema reaparece, y la segunda vez tampoco es facturable. Los ajustes manuales fuera del procedimiento estándar acumulan deuda técnica que aflora siempre en el peor momento.

---

---

## CASO 6 — "El Albarán que Existía en Dos Mundos"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: discrepancia entre sistema externo de almacén (Factor5) y ERP (Odoo) en albaranes expedidos*

### Stage 1
El equipo de almacén recibe una alerta: hay pedidos que el sistema físico del almacén marca como expedidos, pero en el ERP aparecen todavía como "en curso". La mercancía ha salido físicamente y el cliente ya la tiene. El stock en el ERP no se ha descontado. Hay dinero sin facturar y compromisos de inventario que no existen en la realidad.

### Stage 2
Se revisan los logs de la integración entre el ERP y el sistema físico de almacén. Los mensajes de sincronización de estado se enviaron correctamente desde el sistema físico en el momento de la expedición, pero el ERP no refleja el cambio. El resto de albaranes del mismo período se sincronizaron sin problema. Los albaranes afectados tienen en común que se expidieron durante un intervalo de tiempo concreto del día anterior.

### Stage 3
En el historial del ERP se registra un período de mantenimiento programado durante ese intervalo. Los mensajes de sincronización que llegaron mientras el sistema estaba en mantenimiento fueron rechazados y no existe registro de ellos en ninguna cola de reintento.

### Respuestas
- A. Ajustar manualmente el stock y los estados de los albaranes en el ERP para que reflejen la realidad física expedida
- B. Recuperar todos los mensajes de sincronización del intervalo afectado, procesarlos o forzar una resincronización, y revisar que la integración tenga mecanismo de reintentos ante rechazos
- C. Cancelar los albaranes afectados en el ERP y recrearlos directamente como "entregados"
- D. Configurar la integración para que no envíe mensajes durante ventanas de mantenimiento programado

**✅ Correcta: B** — A corrige los datos pero deja la integración sin mecanismo de recuperación ante futuros mantenimientos. D soluciona hacia el futuro pero no resuelve el presente ni garantiza que en el próximo mantenimiento no vuelva a ocurrir. B es la única que corrige datos Y el gap arquitectural.

### Moraleja
Las integraciones que fallan silenciosamente son las más peligrosas. Un mensaje rechazado sin reintento es un dato perdido para siempre. El mantenimiento de un sistema no puede ser invisible para los sistemas que dependen de él.

---

---

## CASO 7 — "La Preparación Sin Fin"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: timeout al validar albaranes en Holiday Golf con flujo MTO+MTS*

### Stage 1
En plena operativa de tarde, los operarios no pueden completar las preparaciones de pedido. Al intentar validar en el sistema de gestión del almacén, la pantalla se congela durante varios minutos y acaba mostrando un error de tiempo de espera superado. Los pedidos con entrega comprometida hoy no pueden salir. El problema afecta solo a un tipo de artículo, no a todos los albaranes.

### Stage 2
El equipo analiza qué tienen en común los albaranes que fallan. Todos involucran artículos gestionados con una ruta de aprovisionamiento especial: cada compra a proveedor está vinculada directamente a una venta en firme concreta. Al validar, el sistema ejecuta una cadena de movimientos encadenados. Los albaranes con rutas de aprovisionamiento estándar se validan de forma instantánea. El problema es reproducible de forma consistente con cualquier albarán que contenga estos artículos especiales.

### Stage 3
Uno de los artículos con esta ruta especial tiene cuarenta y siete pedidos de venta activos distintos pendientes de aprovisionamiento. Al validar cualquier movimiento que lo involucra, el sistema carga y recalcula las necesidades de los cuarenta y siete pedidos antes de confirmar la operación.

### Respuestas
- A. Deshabilitar temporalmente la ruta especial para estos artículos y procesar los albaranes manualmente como entregas directas
- B. Lanzar las validaciones en modo asíncrono (segundo plano) para evitar el timeout visible en la interfaz del operario
- C. Identificar por qué el sistema recalcula todas las necesidades del artículo en lugar de solo la vinculada al movimiento actual, corregir el filtro y desbloquear los albaranes pendientes
- D. Reducir el número de pedidos activos del artículo cancelando los más antiguos hasta que la validación deje de hacer timeout

**✅ Correcta: C** — B es un workaround válido a corto plazo pero el proceso puede igualmente agotar el tiempo en segundo plano; no corrige la causa. A y D alteran la lógica de negocio. C es la única que identifica y corrige la raíz: el recálculo no acotado de necesidades.

### Moraleja
Los flujos de aprovisionamiento vinculados a demanda son potentes pero computacionalmente costosos. Sin acotar el alcance del recálculo a lo estrictamente necesario, un artículo popular puede paralizar toda la operativa de salidas.

---

---

## CASO 8 — "El Día que Llegó la Integración"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: expedite de etiquetado EDI el primer día de operativa real en Fisura*

### Stage 1
Una empresa activa hoy su integración con una plataforma de ventas de alto volumen. Es el primer día de operativa real. A media mañana, los operarios no pueden generar etiquetas de envío para los primeros pedidos: sin etiqueta no puede salir ningún paquete. El transportista recoge en menos de tres horas. Hay docenas de paquetes preparados físicamente que no pueden moverse.

### Stage 2
El equipo funcional analiza los albaranes bloqueados. El módulo de etiquetado no reconoce el formato de los albaranes generados por la nueva integración, que usa un tipo de operación diferente al habitual. La plantilla de etiqueta fue desarrollada y validada correctamente con albaranes del flujo estándar. Nadie había probado la plantilla con los albaranes que genera específicamente la nueva integración. La configuración técnica de la integración es correcta: los albaranes se crean bien, solo falla la generación de etiqueta.

### Stage 3
La plantilla de etiqueta obtiene algunos campos críticos (referencia, dirección, datos del transportista) a través del pedido de venta asociado al albarán. Los albaranes generados por la nueva integración no tienen pedido de venta vinculado en el ERP: el pedido existe en la plataforma externa pero no se replica localmente.

### Respuestas
- A. Crear manualmente en el ERP un pedido de venta por cada albarán afectado para que la plantilla pueda obtener los datos
- B. Adaptar la plantilla para que obtenga los datos directamente del albarán cuando no existe pedido de venta vinculado, y usar una etiqueta manual provisional para los paquetes de hoy mientras se despliega el fix
- C. Posponer la operativa de la integración hasta tener el módulo de etiquetado adaptado al nuevo flujo
- D. Generar las etiquetas manualmente desde la plataforma externa para no bloquear la operativa del día y abrir tarea para corregir el módulo después

**✅ Correcta: B** — D es un workaround que funciona hoy pero deja el problema abierto sin plan de resolución. A no escala ni es sostenible. C cancela un lanzamiento comprometido con el cliente. B es la única que resuelve hoy Y corrige el problema de raíz.

### Moraleja
Una integración nueva debe validarse de extremo a extremo: el hecho de que el módulo A genere bien los documentos no garantiza que los módulos B, C y D que dependen de ellos los procesen correctamente. Las dependencias ocultas aparecen siempre en producción.

---

---

## CASO 9 — "Dos Modos, Un Solo Canal"
**Puntos:** 200 | **Dificultad:** ⭐⭐⭐⭐⭐

> *Inspirado en: coexistencia de escenarios ATC y SGA con mismo `_usage` en fl-v16 #8238*

### Stage 1
En un almacén con operativa mixta (parte de los pedidos se gestiona desde el backoffice, parte desde el sistema de gestión móvil del almacén), empiezan a aparecer pedidos procesados por el flujo equivocado: algunos albaranes que deberían prepararse por el sistema móvil los está cogiendo el backoffice, y viceversa. El equipo no entiende la lógica de la distribución. El problema no ocurre siempre: hay días que todo funciona correctamente.

### Stage 2
Se analiza la configuración de los dos módulos activos. Cada uno tiene su propio escenario configurado y ambos están correctamente definidos por separado. El problema solo ocurre cuando un albarán podría ser reclamado por cualquiera de los dos módulos: cuando cumple las condiciones de ambos simultáneamente. Cuando un albarán solo puede corresponder a uno de los dos flujos, se procesa correctamente. No hay ningún error en los logs durante los fallos.

### Stage 3
Ambos escenarios utilizan el mismo valor en el campo que el sistema emplea internamente para identificar qué módulo debe gestionar cada operación. Cuando los dos coinciden, el sistema asigna la operación al primero que encuentra en su búsqueda interna.

### Respuestas
- A. Deshabilitar uno de los dos módulos y operar con un solo flujo hasta encontrar una solución definitiva
- B. Corregir el campo de identificación para que cada escenario tenga un valor verdaderamente único, añadir una prueba automatizada que detecte este conflicto antes de cualquier despliegue
- C. Crear un módulo coordinador que analice cada albarán y decida explícitamente qué flujo debe gestionarlo
- D. Segmentar los usuarios para que los del backoffice y los del sistema móvil nunca accedan a los mismos albaranes

**✅ Correcta: B** — A pierde funcionalidad y no es una solución real. C sobreingeniería el problema. D no resuelve el conflicto de configuración. B es la única que corrige la raíz (el campo no diferenciado) y previene la recurrencia con un test.

### Moraleja
La configuración de módulos que comparten el mismo canal de operaciones requiere identificadores verdaderamente únicos. Un campo mal diferenciado puede ser inofensivo en solitario y catastrófico en coexistencia. Lo que funciona en aislado no garantiza que funcione en conjunto.

---

---

## CASO 10 — "Lo que Salió y No se Cobró"
**Puntos:** 100 | **Dificultad:** ⭐⭐⭐

> *Inspirado en: diferencias sistemáticas entre entregado y facturado en Compañía Fantástica*

### Stage 1
El equipo de administración detecta una divergencia sistemática entre las cantidades que los clientes han recibido y lo que se les ha facturado. Afecta a decenas de pedidos de los últimos dos meses. No hay reclamaciones de clientes, lo que hace imposible saber desde fuera si se está cobrando de más o de menos. El margen de error acumulado es significativo.

### Stage 2
Al revisar los registros se encuentran dos problemas entremezclados: por un lado, albaranes con cantidades de reserva incorrectas; por otro, albaranes cancelados que dejaron movimientos de stock en estado incompleto. Algunos de estos albaranes cancelados siguen siendo contados en el cálculo de entregas. El equipo técnico determina que parte del problema proviene de cancelaciones ejecutadas por el cliente sin seguir el procedimiento estándar, y parte de un comportamiento inesperado del sistema al procesar esas cancelaciones.

### Stage 3
Cuando un albarán se cancela después de haber sido procesado parcialmente en el sistema de almacén, los movimientos de stock ya ejecutados no se revierten: quedan cantidades residuales que el sistema sigue considerando como reservadas o entregadas.

### Respuestas
- A. Realizar un recuento físico completo del almacén y ajustar el sistema a la realidad física como punto de partida limpio
- B. Identificar todos los albaranes cancelados con movimientos parciales, corregir las cantidades residuales, revisar las facturas emitidas con divergencia y establecer un protocolo que fuerce la reversión completa al cancelar
- C. Emitir facturas rectificativas para todos los pedidos con diferencia y congelar nuevas operaciones hasta tener los datos limpios
- D. Bloquear la opción de cancelar albaranes parcialmente procesados hasta implementar la corrección técnica

**✅ Correcta: B** — A corrige síntomas pero no causa: si los movimientos inconsistentes persisten en el sistema, el siguiente mes vuelve a pasar. C y D son parches sin corrección de raíz. B es la única que corrige datos, facturas y proceso simultáneamente.

### Moraleja
Los flujos de cancelación son tan críticos como los de creación. Un sistema que crea datos correctamente pero no los revierte de forma limpia al cancelar acumula deuda de datos que siempre aflora en la contabilidad. Lo que entra debe poder salir limpiamente.

---

---

---

## CASO 11 — "Los Pedidos que No Encontraban su Lugar"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: Scalpers v11 #4927 — Batchs de Venta en Firme sin poder asignar ubicaciones*

### Stage 1
Un equipo de almacén de alta rotación lleva varios turnos bloqueado: los lotes de preparación generados automáticamente para pedidos ya confirmados no pueden ser asignados a ninguna ubicación. El sistema no muestra error, simplemente no asigna. Los lotes aparecen en estado "listos para preparar" pero ningún operario puede trabajar en ellos.

### Stage 2
El equipo técnico analiza los lotes afectados. Todos pertenecen a pedidos marcados como "venta en firme": confirmados con stock reservado en el momento del pedido. Al comparar con lotes normales, la diferencia está en cómo se generaron las reservas: en los pedidos en firme el stock se reservó antes de que se asignaran los lotes. El sistema intenta asignar ubicaciones de picking a movimientos que ya tienen reserva sobre ubicaciones no válidas para el tipo de operación del lote.

### Stage 3
Los movimientos de los lotes en firme tienen reservas sobre ubicaciones virtuales de "stock entrante" que aún no han pasado por recepción. El sistema no puede asignar ubicaciones físicas de picking a movimientos cuya reserva apunta a stock que todavía no está disponible en la ubicación correcta.

### Respuestas
- A. Cancelar las reservas incorrectas y volver a reservar desde ubicaciones físicas disponibles antes de regenerar los lotes
- B. Eliminar los lotes y recrearlos manualmente desde cero para que el sistema asigne ubicaciones desde el principio
- C. Identificar los movimientos con reservas en ubicaciones virtuales, forzar su disponibilidad mediante un traslado previo y desbloquear los lotes
- D. Deshabilitar la función de "venta en firme" hasta que se resuelva el problema de asignación

**✅ Correcta: A** — C requiere crear movimientos adicionales que pueden generar inconsistencias. B es más lento y no corrige la raíz. D elimina funcionalidad de negocio. A es la forma estándar de resolver reservas incorrectas sin crear movimientos extra.

### Moraleja
Las reservas de stock en pedidos "en firme" deben apuntar exclusivamente a stock físicamente disponible en las ubicaciones correctas para el flujo de picking. Reservar contra stock en tránsito bloquea toda la cadena de preparación.

---

---

## CASO 12 — "El Reabastecedor que No Dejaba Trabajar"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: Noon #841 — Reposición en caliente bloqueante*

### Stage 1
En plena operativa de mañana, el sistema lanza automáticamente las órdenes de reposición de ubicaciones de picking. A partir de ese momento, los operarios no pueden completar ninguna preparación de pedido: el sistema indica que no hay stock disponible en las ubicaciones, aunque físicamente los productos están allí. Los pedidos urgentes no pueden salir.

### Stage 2
El equipo investiga. El módulo de reposición automática está reservando todo el stock disponible de las ubicaciones de picking para los movimientos de reabastecimiento, aunque esos movimientos aún no se han ejecutado físicamente. Los pedidos de cliente que llegaron después de la reserva de reposición no encuentran stock libre. La reposición reserva en la misma ubicación que el picking sin tener en cuenta los compromisos de salida ya existentes.

### Stage 3
Las órdenes de reposición tienen prioridad de reserva por encima de los pedidos de cliente en el sistema. Al ejecutarse durante el horario de operativa, bloquean el stock que los operarios necesitan para las preparaciones ya asignadas.

### Respuestas
- A. Desactivar la reposición automática y lanzarla manualmente solo fuera del horario de picking
- B. Configurar la reposición para que se ejecute fuera del horario de operativa y revisar las reglas de prioridad de reserva para que los compromisos existentes tengan precedencia
- C. Liberar manualmente las reservas de reposición que bloquean los pickings urgentes y procesar los pedidos; ajustar la configuración de prioridades para que no vuelva a ocurrir
- D. Aumentar el stock mínimo de las ubicaciones de picking para que haya suficiente para reposición y pedidos simultáneamente

**✅ Correcta: B** — C resuelve hoy pero no el problema estructural. A funciona operativamente pero no es escalable ni corrige la raíz. D es un workaround de inventario que no resuelve el conflicto de prioridades. B es la única que corrige la configuración y previene la recurrencia.

### Moraleja
Los sistemas de reposición automática deben diseñarse respetando los compromisos de picking existentes. La prioridad de reserva entre reposición y preparación de pedidos es una decisión de negocio crítica que debe estar explícitamente configurada, no dejada al orden de ejecución del sistema.

---

---

## CASO 13 — "El Valor que No Cuadraba"
**Puntos:** 200 | **Dificultad:** ⭐⭐⭐⭐⭐

> *Inspirado en: fl-v16 #8217 — Informe valoración FIFO incorrecto*

### Stage 1
El departamento financiero detecta que el informe de valoración del inventario no coincide con los registros contables. La diferencia aparece exclusivamente en productos gestionados con método de coste FIFO. No hay errores ni alertas en el sistema. El informe ha estado dando valores incorrectos durante semanas sin que nadie lo advirtiera.

### Stage 2
El equipo analiza los movimientos de stock de los productos afectados. Todos tienen en común operaciones de devolución de cliente: mercancía devuelta que volvió al almacén y fue reincorporada al stock. En cada devolución, el sistema asignó el coste de la devolución como si fuera una nueva capa FIFO en lugar de recuperar el coste original de la capa consumida. Los informes de movimiento son correctos; el error está exclusivamente en el cálculo de la valoración acumulada.

### Stage 3
Cuando una devolución se procesa sin referenciar el albarán original, el sistema no puede recuperar el coste FIFO de la capa que se consumió en la venta. En su lugar, crea una nueva entrada de coste usando el precio de coste actual del producto, que puede diferir del original.

### Respuestas
- A. Cambiar el método de valoración de FIFO a precio medio ponderado para evitar el problema de capas
- B. Corregir el módulo para que las devoluciones recuperen el coste de la capa FIFO original, y ajustar la valoración histórica de los productos afectados con asientos de corrección
- C. Procesar todas las devoluciones futuras siempre referenciando el albarán original y aceptar la desviación histórica como pérdida contable
- D. Recalcular manualmente el valor FIFO de todos los productos afectados y ajustar vía inventario de regularización

**✅ Correcta: B** — A cambia la metodología contable de toda la empresa, decisión que no puede tomarse unilateralmente. C no corrige el pasado y deja una deuda contable. D corrige los datos pero no el comportamiento del sistema: el problema seguirá ocurriendo. B es la única que corrige la lógica y los datos históricos.

### Moraleja
El FIFO es un método de coste que depende de trazar la identidad de las capas de entrada y salida. Cualquier movimiento que corte esa trazabilidad —devoluciones sin referencia, ajustes, transferencias— puede generar divergencias contables silenciosas y difíciles de detectar.

---

---

## CASO 14 — "El Pedido que No Sabía Dónde Ir"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: fl-v16 #7823 — Cancelación pedidos intercompany (routing dinámico)*

### Stage 1
Una empresa con dos sociedades en el mismo sistema detecta que al cancelar un pedido de compra desde la sociedad compradora, el pedido de venta correspondiente en la sociedad vendedora queda en estado inconsistente: aparece como confirmado pero sin movimientos de stock asociados. Los contadores no pueden conciliar las cuentas entre empresas.

### Stage 2
Se analiza el flujo intercompany. Cuando se cancela el pedido de compra, el sistema anula los movimientos del lado comprador. Sin embargo, el pedido de venta en la sociedad vendedora no recibe la señal de cancelación. El motivo: la ruta de aprovisionamiento que vinculaba ambos pedidos fue modificada entre la creación del pedido y su cancelación. Al cancelar, el sistema busca el vínculo por la ruta activa actual, que ya no es la misma que cuando se creó el pedido.

### Stage 3
El identificador de la ruta de aprovisionamiento se recalcula en tiempo real en lugar de guardarse en el momento de la creación del pedido. Al cambiar la configuración de rutas, los pedidos existentes pierden su vínculo de cancelación intercompany.

### Respuestas
- A. Cancelar manualmente el pedido de venta huérfano y ajustar los apuntes contables intercompany afectados
- B. Revertir el cambio de rutas a la configuración anterior y volver a cancelar el pedido desde el inicio
- C. Corregir el módulo para que almacene el identificador de ruta en el momento de la creación y no lo recalcule al cancelar; cancelar manualmente los pedidos huérfanos existentes
- D. Deshabilitar el flujo intercompany automático y gestionar los pedidos entre sociedades manualmente hasta tener el fix

**✅ Correcta: C** — A resuelve el síntoma pero deja el bug abierto para que ocurra en el próximo cambio de rutas. B puede generar efectos secundarios en pedidos activos. D elimina funcionalidad crítica. C es la única que corrige la causa raíz y limpia los datos existentes.

### Moraleja
Los datos de configuración que vinculan documentos entre sí deben almacenarse en el momento de la creación, no recalcularse en tiempo real. Lo que creó un vínculo debe ser lo que lo deshaga, independientemente de los cambios de configuración posteriores.

---

---

## CASO 15 — "El Stock que Viajó en el Tiempo"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: Fisura #990 — Stock a fecha anterior, ubicaciones mal configuradas*

### Stage 1
El equipo de logística consulta el informe de stock a una fecha anterior para auditar una discrepancia. Los valores que muestra el informe no coinciden con los registros históricos del almacén. Para algunas referencias, el sistema muestra más stock del que había realmente en esa fecha; para otras, menos. Las operaciones de ese período están todas confirmadas y no hay movimientos pendientes.

### Stage 2
El equipo técnico revisa la configuración de las ubicaciones del almacén. Descubren que varias ubicaciones fueron marcadas recientemente como "archivadas" o cambiaron de tipo (de ubicación interna a ubicación virtual). Los movimientos históricos asociados a esas ubicaciones siguen existiendo en la base de datos, pero el informe de stock a fecha los excluye o los incluye de forma diferente según el estado actual de la ubicación, no el estado que tenía en el momento del movimiento.

### Stage 3
El informe de stock a fecha filtra los movimientos usando el estado actual de las ubicaciones en lugar del estado que tenían en la fecha consultada. Ubicaciones archivadas hoy eran ubicaciones activas e internas en la fecha de la consulta, pero sus movimientos aparecen excluidos del cálculo.

### Respuestas
- A. Restaurar temporalmente las ubicaciones archivadas, extraer el informe y volver a archivarlas
- B. Corregir el informe para que evalúe el estado de las ubicaciones en la fecha consultada y no en la fecha actual; recuperar el histórico afectado con una consulta directa a base de datos como solución inmediata
- C. Extraer los movimientos directamente desde base de datos sin usar el informe estándar para la auditoría en curso, y abrir una tarea de mejora del informe
- D. Reconstruir el historial de stock manualmente a partir de los albaranes físicos del período auditado

**✅ Correcta: B** — A es un workaround temporal que no corrige el bug y puede afectar a otros informes. D es inviable a escala. C resuelve la urgencia de la auditoría pero no corrige el informe para el futuro. B resuelve tanto la auditoría actual como el problema de raíz.

### Moraleja
Los informes históricos deben evaluar el estado del sistema en el momento consultado, no en el momento de la consulta. Un informe "a fecha" que usa configuración actual en lugar de histórica no es un informe a fecha: es un informe sesgado por el presente.

---

---

## CASO 16 — "Los Negativos que No Deberían Existir"
**Puntos:** 100 | **Dificultad:** ⭐⭐⭐

> *Inspirado en: Boxnox #1040 — Unidades en negativo pedidos ECI*

### Stage 1
El equipo de almacén detecta que varias referencias tienen stock en negativo en el sistema. Las referencias afectadas corresponden a pedidos de un canal de ventas externo integrado con el ERP. Físicamente, el producto existe en el almacén. Los pedidos del canal han sido procesados y expedidos correctamente. No hay alertas en el sistema.

### Stage 2
Se revisa el flujo de integración del canal externo. Los pedidos llegan con cantidades en formato decimal usando el separador equivocado para el idioma configurado en el sistema: donde el canal envía una coma como separador de miles, el ERP lo interpreta como separador decimal. Un pedido de "1,500 unidades" llega al sistema como "1.5 unidades". La diferencia entre unidades expedidas físicamente y unidades registradas crea el stock negativo.

### Stage 3
La configuración regional del conector de integración usa el separador decimal del país origen del canal (punto), mientras que el ERP está configurado con el separador decimal del país destino (coma). Ninguno de los dos sistemas lanza un error: ambos procesan los números como válidos, pero con interpretaciones distintas.

### Respuestas
- A. Ajustar manualmente el stock negativo con un inventario de regularización y revisar uno a uno los pedidos del canal del último mes
- B. Corregir la configuración regional del conector para que ambos sistemas usen el mismo formato numérico, validar retroactivamente los pedidos afectados y ajustar el stock
- C. Añadir una validación en el conector que detecte cantidades con formato ambiguo y las rechace antes de crear el movimiento en el ERP
- D. Solicitar al canal externo que cambie su formato de exportación al estándar del ERP

**✅ Correcta: B** — C añade validación útil pero no corrige los datos ya mal importados ni la configuración regional incorrecta. A es un parche sin causa identificada. D depende de un tercero y puede tardar semanas. B corrige la causa raíz y valida el impacto histórico.

### Moraleja
Las integraciones entre sistemas de distintos países deben definir explícitamente el formato numérico en el contrato de integración. Un separador de miles interpretado como decimal puede multiplicar por mil el error en stock, facturación y contabilidad sin que ningún sistema lo detecte como incorrecto.

---

---

## CASO 17 — "El Informe que Se Caía Solo"
**Puntos:** 100 | **Dificultad:** ⭐⭐⭐

> *Inspirado en: fl-v16 #6748 — Error "expected singleton" informe albarán (Bimani)*

### Stage 1
Varios usuarios reportan que al intentar imprimir el albarán de entrega de determinados pedidos, el sistema lanza un error y el informe no se genera. No todos los albaranes fallan: algunos se imprimen sin problema. Los pedidos afectados parecen ser los de mayor volumen, pero no hay una regla clara. El equipo de administración no puede enviar documentación a los clientes.

### Stage 2
El equipo técnico reproduce el error. El mensaje indica que el sistema esperaba encontrar un único registro pero encontró varios. Al analizar la plantilla del informe, se identifica que hay una búsqueda que debería devolver un solo resultado —el transportista principal del albarán— pero en los albaranes afectados devuelve más de uno. Los albaranes que fallan tienen varios transportistas en diferentes líneas; los que funcionan tienen un único transportista para todo el albarán.

### Stage 3
La plantilla del informe usa un método de búsqueda no diseñado para manejar múltiples resultados. Funciona correctamente con un solo transportista porque históricamente ese era el único caso. Los albaranes multi-transportista aparecieron cuando se activó la funcionalidad de entregas parciales con transportistas distintos.

### Respuestas
- A. Deshabilitar la opción de asignar múltiples transportistas por albarán hasta tener el informe corregido
- B. Desconsolidar manualmente los albaranes multi-transportista en albaranes separados antes de imprimir
- C. Corregir la plantilla del informe para que gestione correctamente el caso de múltiples transportistas, mostrando todos los asociados al albarán
- D. Como solución inmediata, asignar un transportista único a cada albarán antes de imprimir; corregir la plantilla en paralelo para que soporte múltiples

**✅ Correcta: C** — D es un workaround manual no escalable. A y B limitan funcionalidad de negocio. C es la solución que aborda directamente el bug en la plantilla y preserva la funcionalidad multi-transportista.

### Moraleja
Las plantillas de informe deben validarse ante todos los casos de uso posibles, especialmente cuando se activan nuevas funcionalidades. Un informe que asume "siempre habrá un solo resultado" falla silenciosamente hasta que la realidad del negocio cambia.

---

---

## CASO 18 — "La Reserva que se Perdió"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: Weelko #380 — Error en asignaciones con reserva*

### Stage 1
El equipo de almacén detecta que una parte de los pickings generados automáticamente llegan sin stock asignado, aunque hay existencias disponibles. Al intentar forzar la asignación manualmente, el sistema confirma que el proceso se completó, pero el picking sigue sin stock reservado. Los operarios no pueden trabajar esos pickings.

### Stage 2
Se analizan los pickings afectados. Todos tienen en común que el proceso de asignación se lanzó mientras otra operación sobre el mismo almacén estaba en curso: un ajuste de inventario que modificó las cantidades disponibles en tiempo real. El sistema ejecutó la asignación, calculó el stock disponible al inicio del proceso, pero entre el cálculo y la escritura de la reserva el ajuste de inventario modificó el stock. El sistema confirmó la asignación sin verificar que la reserva efectivamente se había registrado.

### Stage 3
El proceso de asignación de stock no tiene bloqueo de concurrencia: calcula el stock disponible, luego escribe la reserva. Si entre esos dos pasos otro proceso modifica el mismo stock, la reserva se escribe sobre datos que ya no son válidos, y el sistema no detecta la discrepancia.

### Respuestas
- A. Prohibir los ajustes de inventario durante el horario de generación de pickings
- B. Añadir una verificación post-asignación que compruebe que la reserva efectivamente se registró, y reintentar en caso de discrepancia; revisar si el módulo de asignación necesita bloqueo transaccional
- C. Lanzar los ajustes de inventario y las asignaciones de forma secuencial, nunca simultánea, como norma operativa mientras se implementa el fix técnico
- D. Deshabilitar la asignación automática y asignar stock manualmente en todos los pickings

**✅ Correcta: B** — C es una norma operativa útil a corto plazo pero no escala ni garantiza que otros procesos no generen el mismo conflicto. A limita la operativa sin corregir el problema. D no es viable en un almacén de volumen. B aborda el problema técnico de raíz con verificación y bloqueo transaccional.

### Moraleja
Las operaciones que leen y luego escriben sobre datos compartidos requieren protección de concurrencia. Sin ella, dos procesos simultáneos pueden producir un resultado que ambos consideran correcto pero que es incoherente. "Calculé, luego escribí" no es equivalente a "calculé y escribí como una única operación atómica".

---

---

## CASO 19 — "El Arranque que No Arrancaba"
**Puntos:** 150 | **Dificultad:** ⭐⭐⭐⭐

> *Inspirado en: MasMusculo — Arranque: flujo de rutas no funciona*

### Stage 1
El día del arranque de un nuevo cliente, los primeros pedidos de venta confirmados no generan los movimientos de stock esperados. Algunos albaranes no se crean. Otros se crean pero en el almacén equivocado. El cliente lleva meses esperando este momento y tiene pedidos comprometidos para hoy. El equipo está in situ en las instalaciones del cliente.

### Stage 2
El equipo técnico revisa la configuración de rutas de aprovisionamiento. En el entorno de pruebas todo funcionaba correctamente. Al comparar las configuraciones de test y producción, se detectan diferencias en los almacenes asignados en las rutas: en test se usaron almacenes de prueba; en producción se replicó la configuración pero algunos almacenes tienen IDs diferentes. Las rutas apuntan a los IDs del entorno de test, que en producción corresponden a almacenes distintos o inexistentes.

### Stage 3
La exportación de configuración de rutas entre entornos preserva los IDs de los almacenes de origen, no sus nombres. En producción, esos mismos IDs corresponden a almacenes diferentes porque el orden de creación fue distinto entre entornos.

### Respuestas
- A. Recrear todos los pedidos de venta del día desde cero asignando manualmente el almacén correcto
- B. Corregir las rutas en producción para que apunten a los almacenes correctos, forzar la reasignación de rutas en los pedidos existentes y monitorizar la generación de los próximos albaranes
- C. Para los pedidos urgentes del día, crear los albaranes manualmente en el almacén correcto; corregir las rutas en paralelo para que los pedidos nuevos funcionen correctamente desde ese momento
- D. Revertir a un proceso completamente manual de creación de albaranes durante el día de arranque

**✅ Correcta: C** — B corrige el problema estructural pero los pedidos urgentes del día necesitan solución inmediata mientras se aplica el fix. A crea duplicados si los pedidos originales ya tienen movimientos parciales. D abandona la automatización sin corregir nada. C equilibra urgencia operativa y corrección técnica.

### Moraleja
La migración de configuraciones entre entornos debe validar referencias por nombre o clave de negocio, nunca por ID interno. Los IDs de base de datos son específicos de cada instalación. Una configuración que funciona en test puede apuntar a entidades completamente diferentes en producción.

---

---

## CASO 20 — "El FIFO que Sumaba al Revés"
**Puntos:** 200 | **Dificultad:** ⭐⭐⭐⭐⭐

> *Inspirado en: Nait Nait — FIFO + valoración por ubicación específica*

### Stage 1
El departamento financiero detecta que la valoración del inventario de algunos productos no cuadra con los costes de compra registrados. Los productos afectados se gestionan con el método de coste FIFO. El valor del inventario varía significativamente según desde qué pantalla del sistema se consulte. Los auditores externos han señalado la discrepancia.

### Stage 2
Se analiza en detalle la configuración del almacén. El cliente tiene activada la valoración por ubicación específica: algunos productos tienen un coste diferente dependiendo de en qué zona del almacén se almacenen. El módulo FIFO estándar calcula las capas de coste a nivel de producto, sin considerar la ubicación. El módulo de valoración por ubicación añade un ajuste posterior. Cuando ambos módulos actúan sobre el mismo producto, sus cálculos interfieren mutuamente.

### Stage 3
El módulo de valoración por ubicación aplica su ajuste sobre el valor que ya ha calculado el FIFO, pero el FIFO no tiene en cuenta que parte del stock de ese producto está en una ubicación con coste diferente. Cada módulo asume que el otro no está activo, y el resultado es una doble contabilización de ajustes en algunos movimientos.

### Respuestas
- A. Desactivar la valoración por ubicación específica y usar solo FIFO estándar para todos los productos
- B. Identificar y corregir los movimientos con doble ajuste, documentar el impacto contable y evaluar si la combinación FIFO + valoración por ubicación está soportada en la versión actual del sistema
- C. Separar los productos por método: los que requieren valoración por ubicación usan precio medio ponderado; los que requieren FIFO no tienen valoración por ubicación
- D. Corregir manualmente la valoración de cada producto afectado mediante asientos contables sin tocar la configuración del sistema

**✅ Correcta: B** — A elimina funcionalidad que el cliente necesita. C puede ser válida pero implica cambios de metodología contable que requieren validación con auditoría. D es inviable a largo plazo. B es el único enfoque que evalúa correctamente el soporte real de la combinación y corrige los datos afectados.

### Moraleja
La combinación de múltiples módulos de valoración de stock puede generar interferencias que ninguno de los módulos por separado detecta como error. Antes de activar dos módulos que actúan sobre el mismo dominio, es imprescindible verificar que están diseñados para coexistir.

---

---

## Resumen de los 20 casos

| # | Título | Puntos | Dificultad | Tarea origen |
|---|--------|--------|-----------|--------------|
| 1 | El Sistema que Durmió el Almacén | 200 | ⭐⭐⭐⭐⭐ | Noon deadlock / fl-v16 #5945 |
| 2 | La Mejora que Paró el Almacén | 200 | ⭐⭐⭐⭐⭐ | fl-v16 #6031 |
| 3 | Los Albaranes que Desaparecieron | 150 | ⭐⭐⭐⭐ | The New Society |
| 4 | Más Mercancía de la que Toca | 150 | ⭐⭐⭐⭐ | Patitas #449 |
| 5 | El Cierre Fiscal que No Llega | 200 | ⭐⭐⭐⭐⭐ | Safeguru #798+#745 |
| 6 | El Albarán que Existía en Dos Mundos | 150 | ⭐⭐⭐⭐ | Boxnox #1017 |
| 7 | La Preparación Sin Fin | 150 | ⭐⭐⭐⭐ | Holiday Golf #709 |
| 8 | El Día que Llegó la Integración | 150 | ⭐⭐⭐⭐ | Fisura #1041+#984 |
| 9 | Dos Modos, Un Solo Canal | 200 | ⭐⭐⭐⭐⭐ | fl-v16 #8238 |
| 10 | Lo que Salió y No se Cobró | 100 | ⭐⭐⭐ | Compañía Fantástica #1790 |
| 11 | Los Pedidos que No Encontraban su Lugar | 150 | ⭐⭐⭐⭐ | Scalpers v11 #4927 |
| 12 | El Reabastecedor que No Dejaba Trabajar | 150 | ⭐⭐⭐⭐ | Noon #841 |
| 13 | El Valor que No Cuadraba | 200 | ⭐⭐⭐⭐⭐ | fl-v16 #8217 |
| 14 | El Pedido que No Sabía Dónde Ir | 150 | ⭐⭐⭐⭐ | fl-v16 #7823 |
| 15 | El Stock que Viajó en el Tiempo | 150 | ⭐⭐⭐⭐ | Fisura #990 |
| 16 | Los Negativos que No Deberían Existir | 100 | ⭐⭐⭐ | Boxnox #1040 |
| 17 | El Informe que Se Caía Solo | 100 | ⭐⭐⭐ | fl-v16 #6748 |
| 18 | La Reserva que se Perdió | 150 | ⭐⭐⭐⭐ | Weelko #380 |
| 19 | El Arranque que No Arrancaba | 150 | ⭐⭐⭐⭐ | MasMusculo |
| 20 | El FIFO que Sumaba al Revés | 200 | ⭐⭐⭐⭐⭐ | Nait Nait |

---

## Próximo paso

Cuando confirmes los casos (o indiques ajustes), se generará el archivo `casos.json`
listo para importar en la app desde **Admin → Casos → 📥 Importar JSON**.
