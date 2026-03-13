# Guía para crear casos — GÜERJAUS TBT

> Documento de referencia para colaboradores que quieran diseñar nuevos casos para la dinámica de teambuilding.

---

## Qué es esto

**GÜERJAUS TBT** (*El 'Throwback Thursday' de Almacén*) es una dinámica de equipo en formato quiz/investigación para el equipo de almacén de FactorLibre. Participan ~14 personas divididas en 3 equipos. Un proyector grande muestra la información en tiempo real; los equipos responden desde sus dispositivos.

Cada **caso** es un incidente real o realista del día a día del equipo de almacén (ERP, WMS, integraciones, operativa). Los equipos reciben la información en tres etapas de dificultad creciente y deben identificar la causa raíz antes de responder a un quiz de 4 opciones.

---

## Cómo fluye un caso (lo que ven los equipos y el proyector)

```
STAGE_1 ──► STAGE_1_DEBATE ──► STAGE_2 ──► STAGE_2_DEBATE ──► STAGE_3 ──► STAGE_3_DEBATE ──► STAGE_4 (quiz) ──► RESULTS
```

### Lo que se muestra en cada etapa

| Etapa | Tiempo | Lo que ve el proyector | Lo que hace el equipo |
|-------|--------|------------------------|-----------------------|
| **STAGE_1** | 60 seg | 🟣 **Simulación Slack**: la Service Manager abre un expedite urgente en el canal `#soporte-almacen`. Tres mensajes aparecen secuencialmente: título del incidente → descripción del contexto → impacto en la operativa. Al entrar en zona roja del timer, Luis Novalio responde "Nos ponemos con ello 💪" | Leer, discutir internamente |
| **STAGE_1_DEBATE** | 120 seg | Misma pantalla Slack, todos los mensajes ya visibles + banner de debate | Debate interno del equipo |
| **STAGE_2** | 90 seg | 🟦 **Formato GitLab/GitHub issue**: dos comentarios de miembros del equipo técnico/funcional aparecen secuencialmente revelando contexto ampliado (~70% de la información). ~10 seg después del segundo comentario, Luis Novalio deja un mensaje motivacional con humor almacenero | Analizar el contexto ampliado. Los equipos pueden **adelantar a la resolución** si creen que ya tienen suficiente información (riesgo/recompensa) |
| **STAGE_2_DEBATE** | 300 seg | Misma pantalla GitLab, todos los comentarios visibles + banner "Debate activo — pueden adelantar" | Debatir si adelantar o esperar la pista final |
| **STAGE_3** | 60 seg | 🟣 **Slack de nuevo**: un miembro aleatorio del equipo revela la pista clave como un mensaje en el canal. La pista es sutil pero decisiva | Incorporar la pista al análisis |
| **STAGE_3_DEBATE** | 180 seg | Mismo mensaje Slack visible + banner debate final | Debate final antes del quiz |
| **STAGE_4** | 120 seg | Las 4 opciones de respuesta (A/B/C/D) | Enviar respuesta (una sola por equipo) |
| **RESULTS** | 20 seg | Respuesta correcta + puntuación de cada equipo | Ver resultados |

---

## Los personajes del escenario

### Service Managers (aparecen en STAGE_1 abriendo el expedite)
Rotan por caso de forma determinista. El primer caso usa Mayte, el segundo Ilse, el tercero Sergio del Castillo, y así cíclicamente.

| Nombre | Iniciales |
|--------|-----------|
| Mayte | MY |
| Ilse | IL |
| Sergio del Castillo | SC |

### Luis Novalio — Jefe de Operaciones
- En **STAGE_1**: aparece cuando el timer entra en zona roja (≤15% restante) con un mensaje de urgencia: *"Nos ponemos con ello 💪"*
- En **STAGE_2**: aparece ~10 segundos después del último comentario de equipo con un mensaje motivacional con jerga de almacén y toque andaluz, siempre terminando con 💪

### Miembros del equipo (comentan en STAGE_2 y STAGE_3)
Rotan por caso de forma determinista — nadie se repite consecutivamente.

**Perfil Dev (comentario 1 en STAGE_2):**
| Nombre | Iniciales |
|--------|-----------|
| Adrian Cifuentes | AC |
| Oscar Indias | OI |
| Álvaro Gómez | AG |
| Sergio Bustamante | SB |

**Perfil Funcional (comentario 2 en STAGE_2):**
| Nombre | Iniciales |
|--------|-----------|
| Javier Sánchez | JS |
| Fabio García | FG |
| Jesús Sánchez | JES |
| Nacho Morales | NM |
| Sabrina Iborra | SI |
| Daniel Cagigas | DC |
| Nuria Delgado | ND |

El miembro de **STAGE_3** sale del pool combinado con un offset diferente para evitar repetir al mismo que apareció en STAGE_2.

---

## Estructura JSON de un caso

```json
{
  "title": "Título del incidente (corto y descriptivo)",
  "points": 150,

  "stage1Titulo": "Titular del expedite — lo que la SM escribe como primer mensaje",
  "stage1Contexto": "Descripción breve del problema — segundo mensaje de la SM en Slack",
  "stage1Impacto": "Consecuencia concreta en la operativa — tercer mensaje (en rojo, urgente)",

  "stage1": "Texto completo de contexto inicial (se guarda internamente, puede coincidir con stage1Contexto ampliado)",
  "stage2": "Contexto ampliado (~70% de la información necesaria para resolver el caso)",
  "stage3": "Pista clave — sutil pero decisiva para identificar la causa raíz",

  "answers": [
    "Opción A — descripción de la acción",
    "Opción B — descripción de la acción",
    "Opción C — descripción de la acción",
    "Opción D — descripción de la acción"
  ],
  "correctAnswerIndex": 1,

  "moraleja": "Lección que se extrae del caso — no se muestra durante la dinámica, se usa como reflexión posterior"
}
```

> **Importante:** `correctAnswerIndex` es **0-based**. `0` = A, `1` = B, `2` = C, `3` = D.

---

## Guía campo a campo

### `title`
El nombre del incidente. Debe ser intrigante pero sin revelar la solución. Funciona bien la metáfora o la descripción del síntoma visible.

✅ *"La Mejora que Paró el Almacén"*
✅ *"El Albarán que Existía en Dos Mundos"*
❌ *"Bug de deadlock por concurrencia"* — revela la causa raíz

---

### `stage1Titulo`
Lo que la SM escribe como **primer mensaje** en el canal de Slack. Debe ser el asunto urgente en una frase. Aparece así en pantalla:

> 🚨 Tengo un expedite urgente: **[stage1Titulo]**

Máximo ~120 caracteres. Directo al grano, en jerga funcional.

✅ *"Todos los operarios bloqueados — el sistema congela todas las operaciones"*
✅ *"No podemos generar etiquetas de envío — más de 40 albaranes sin pedido de venta de origen"*

---

### `stage1Contexto`
**Segundo mensaje** de la SM. Descripción breve del síntoma observado: qué pasa, desde cuándo, quién lo ha detectado. Sin hipótesis técnicas aún.

✅ *"Llevamos 30 minutos sin poder completar ninguna operación de almacén. Al intentar validar cualquier movimiento el sistema se queda colgado y acaba en error genérico. No ha habido despliegues esta semana. Los dos equipos del turno de mañana están completamente parados."*

---

### `stage1Impacto`
**Tercer mensaje** de la SM (aparece en rojo, estilo alerta). Debe ser **específico y concreto de este caso** — no genérico. Expresa el impacto en negocio: pedidos, clientes, euros, horas.

✅ *"Más de 1.500 pedidos diarios paralizados. Los pedidos urgentes del turno de mañana no pueden salir y el turno completo está inoperativo."*
✅ *"Cierre fiscal bloqueado con una diferencia de miles de euros sin justificar. Los auditores llevan días esperando y el balance anual está en el aire."*
❌ *"No pueden sacar los pedidos y hay mucho volumen acumulado."* — demasiado genérico

---

### `stage1`
Versión narrativa completa del contexto inicial. Puede ser más larga que `stage1Contexto` — es el texto que se guarda internamente y puede usarse en otros contextos de la app. En la práctica puede ser similar o igual al texto de los tres mensajes Slack combinados.

---

### `stage2`
Aquí se revela **~70% de la información** necesaria. El equipo técnico ya está investigando. Aparece como **dos comentarios consecutivos** en el issue de GitLab:
- El primer comentario recibe la **primera mitad** del texto
- El segundo comentario recibe la **segunda mitad**

La división se hace automáticamente buscando el límite de frase más cercano al punto medio del texto. Por tanto:
- Redacta `stage2` como **un único párrafo o dos párrafos bien conectados**
- Evita listas o bullets — no quedan bien al partirse por la mitad
- El corte natural debería ocurrir entre dos ideas distintas pero relacionadas
- La primera mitad puede aportar hallazgos técnicos; la segunda, contexto funcional u operativo

✅ *"Los técnicos acceden a los logs del servidor. Detectan errores repetidos en la capa de gestión de stock del tipo 'proceso en espera de recurso ocupado'. El bloqueo comenzó exactamente cuando el turno de mañana arrancó con sus dos equipos trabajando en paralelo sobre el mismo tipo de albaranes. Cuando se prueba con un solo operario activo, el sistema responde con normalidad. La configuración no ha cambiado. No hay errores en los despliegues anteriores."*

---

### `stage3`
La **pista clave**. Debe ser sutil: aportar el dato que permite identificar inequívocamente la causa raíz, pero sin nombrarla directamente. Aparece en Slack como un mensaje de un miembro del equipo precedido por 🔑.

Piensa en ella como el comentario de alguien que encontró *el detalle* que lo explica todo.

✅ *"En el log de base de datos hay dos procesos que llevan más de ocho minutos esperándose mutuamente: cada uno retiene un bloqueo sobre el recurso que el otro necesita para continuar."*
✅ *"Varios de los movimientos con destinos inconsistentes fueron generados durante un ajuste de inventario realizado hace un trimestre. Ese ajuste se ejecutó de forma manual sin seguir el procedimiento habitual del sistema."*
❌ *"Hay un deadlock."* — demasiado explícito, elimina todo el reto
❌ *"Puede que sea el despliegue."* — demasiado vago, no aporta nada

---

### `answers`
Cuatro opciones de respuesta. Todas deben ser **plausibles y razonadas** — no hay trampa obvia. El objetivo es que el equipo tenga que debatir.

Criterios:
- **Una claramente correcta** — aborda la causa raíz, no solo el síntoma
- **Una tentadora pero incompleta** — soluciona el síntoma pero no la causa
- **Una razonable pero equivocada** — parte de una hipótesis incorrecta
- **Una demasiado drástica o irrelevante** — existe pero no es la primera opción sensata

✅ Buena opción incorrecta: *"Reiniciar el servidor para liberar los bloqueos y operar con un operario por turno hasta localizar la causa"* — es una mitigación razonable pero no resuelve el problema de fondo.

---

### `correctAnswerIndex`
Índice **0-based** de la respuesta correcta en el array `answers`.
- `0` → A
- `1` → B
- `2` → C
- `3` → D

---

### `moraleja`
La lección que se extrae del caso. No se muestra durante la dinámica — se usa como material de reflexión posterior o en el debriefing. Debe conectar el caso concreto con un principio general de trabajo en equipo, comunicación técnico-funcional o gestión de operaciones.

---

### `points`
Puntos base del caso. Recomendación:
- **100 pts** — casos simples (1-2 ⭐)
- **150 pts** — casos medios (3 ⭐)
- **200 pts** — casos difíciles (4-5 ⭐)

Si un equipo adelanta a la resolución desde STAGE_2:
- Acierta → +30% sobre los puntos base
- Falla → -50% sobre los puntos base

---

## Cómo diseñar un buen caso — checklist

### El incidente
- [ ] ¿Está basado en un escenario real o muy realista del equipo de almacén / ERP / WMS?
- [ ] ¿El síntoma inicial (STAGE_1) es reconocible para el equipo funcional y el técnico por igual?
- [ ] ¿El impacto tiene consecuencias claras en negocio (pedidos, euros, clientes, compliance)?

### La progresión de información
- [ ] ¿Con solo STAGE_1 es imposible resolver el caso con certeza? (debe ser ambiguo)
- [ ] ¿STAGE_2 añade información nueva sin revelar la causa raíz directamente?
- [ ] ¿STAGE_3 es el dato que "cierra el círculo" pero requiere conocimiento del dominio para interpretarlo?
- [ ] ¿El equipo que llegue a STAGE_3 tiene suficiente información para elegir la respuesta correcta?

### Las opciones
- [ ] ¿Las cuatro opciones son plausibles? (nadie descarta ninguna al leerla)
- [ ] ¿La opción correcta requiere haber entendido la causa raíz, no solo el síntoma?
- [ ] ¿Hay al menos una opción que aborda el síntoma correctamente pero ignora la causa?
- [ ] ¿La moraleja conecta el caso con un aprendizaje transferible?

---

## Errores comunes al redactar casos

| Error | Ejemplo | Por qué es un problema |
|-------|---------|------------------------|
| Revelar la causa raíz en el título | *"Deadlock por concurrencia de procesos"* | Elimina el reto antes de empezar |
| STAGE_3 demasiado explícito | *"Es un deadlock."* | Quita el trabajo de interpretación al equipo |
| STAGE_3 demasiado vago | *"Algo raro pasó hace unas semanas."* | No aporta valor; el equipo se frustra |
| Opciones de respuesta con trampas obvias | Una opción absurda o graciosa | Los equipos la descartan sin analizar |
| stage2 con listas o bullets | `- Hallazgo 1\n- Hallazgo 2` | Se parte mal al dividirse entre los dos comentarios de GitLab |
| Impacto genérico en stage1Impacto | *"Hay muchos pedidos parados"* | No sitúa la urgencia ni el contexto del caso |

---

## Temáticas recomendadas

El caso tiene que resonar con el equipo. Temáticas que funcionan bien:

- **Concurrencia y bloqueos** — múltiples operarios actuando sobre el mismo recurso
- **Integraciones silenciosas** — mensajes perdidos entre ERP y WMS sin reintento
- **Datos de prueba vs. datos reales** — comportamiento diferente en producción
- **Limpieza de datos mal acotada** — pérdida de trazabilidad o vínculos entre documentos
- **Despliegues en viernes** — clásico
- **Procedimientos manuales fuera de estándar** — ajustes que generan deuda técnica
- **Valoración de inventario** — discrepancias entre vistas del sistema
- **Albaranes en estado inconsistente** — expedidos físicamente pero no en ERP
- **Stocks negativos** — validaciones que se "flexibilizan" con consecuencias
- **Cierre fiscal** — acumulación de pequeños problemas que afloran en el peor momento

---

## Template vacío para copiar

```json
{
  "title": "",
  "points": 150,

  "stage1Titulo": "",
  "stage1Contexto": "",
  "stage1Impacto": "",

  "stage1": "",
  "stage2": "",
  "stage3": "",

  "answers": [
    "",
    "",
    "",
    ""
  ],
  "correctAnswerIndex": 0,

  "moraleja": ""
}
```

---

## Cómo importar los casos a la app

1. Crea un fichero JSON con la estructura:
   ```json
   { "cases": [ { ...caso1 }, { ...caso2 }, ... ] }
   ```
2. En el panel de admin → pestaña **Casos** → botón **📥 Importar JSON**
3. Pega el contenido o sube el fichero
4. La app valida el formato y carga los casos en la sesión activa

> Se pueden importar varios casos a la vez. Los casos existentes **no se borran** con la importación — los nuevos se añaden al final.

---

## Contacto

Cualquier duda sobre el formato, la dinámica o el diseño de casos:
**Lucas Andreu** · lucas.andreu@factorlibre.com
