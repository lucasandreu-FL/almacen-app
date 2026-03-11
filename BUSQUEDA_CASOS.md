# Guía: Búsqueda de Casos para la Dinámica "El Almacén en Crisis"

> Este documento permite a cualquier miembro del equipo de almacén buscar de forma autónoma
> tareas reales de cliente que puedan convertirse en casos para la dinámica de teambuilding.
> **El objetivo final es importarlos en la app** usando la plantilla JSON (`casos_template.json`).

---

## Qué buscamos

Tareas **reales de cliente** que cumplan al menos 3 de estos criterios:

- Requirieron **coordinación activa entre técnico y funcional** (no se resolvió en solitario)
- El problema **no era obvio**: hubo varias hipótesis antes de dar con la causa raíz
- Generó **urgencia o impacto en el cliente** (almacén parado, no podía facturar, arranque bloqueado...)
- Alta complejidad técnica o de datos: múltiples sistemas, datos inconsistentes, bugs silenciosos
- Idealmente: puntos de historia altos (8+) o muchas horas imputadas en Odoo

**No buscamos** bugs triviales de configuración ni tareas resolubles por un solo perfil.

---

## Fuente 1: Slack — Canal `#af-almacen`

### Cómo buscar

En la barra de búsqueda de Slack usa los siguientes términos **dentro del canal `#af-almacen`** (`in:#af-almacen`):

```
expedite in:#af-almacen
almacen parado in:#af-almacen
stock negativo in:#af-almacen
discrepancia stock in:#af-almacen
no puede validar in:#af-almacen
timeout in:#af-almacen
revertir merge in:#af-almacen
valoracion inventario in:#af-almacen
SGA error in:#af-almacen
concurrencia in:#af-almacen
Factor5 Odoo in:#af-almacen
flujo tenso in:#af-almacen
```

### Qué mirar dentro de cada mensaje

Cuando encuentres un mensaje relevante:

1. **Abre el hilo completo** — la complejidad real está en los mensajes de respuesta
2. Busca cuántas personas distintas intervienen (técnico + funcional = buena señal)
3. Fíjate si hay **URLs a GitLab** — anótalas, son la tarea real
4. Observa si hay emojis de urgencia 🚨, menciones a `<!subteam^...>` (todo el equipo) o palabras como "crítico", "almacén parado", "expedite"

### Plantilla de solicitud de ayuda del canal

El canal usa esta plantilla que ayuda a identificar buenas tareas:

```
🛟 Solicitado por: [nombre]
📋 Qué tarea es: [URL GitLab]
💻 El código está en: [entorno/repo]
➡️ Por ahora: [lo que ya se sabe]
🔥 El problema que tengo es: [el bloqueo real]
```

---

## Fuente 2: GitLab — Búsqueda en proyectos de cliente

### Proyectos de cliente con historial de almacén relevante

Busca en los siguientes proyectos (accede con tu usuario de GitLab de FactorLibre):

| Proyecto | URL |
|----------|-----|
| Boxnox v11 | `git.factorlibre.com/odoo-11/boxnox` |
| Noon v16 | `git.factorlibre.com/odoo-16/noon` |
| Patitas and Co v16 | `git.factorlibre.com/odoo-16/patitas-and-co` |
| Fisura v16 | `git.factorlibre.com/odoo-16/fisura` |
| Weelko v16 | `git.factorlibre.com/odoo-16/weelko` |
| Safeguru v11 | `git.factorlibre.com/odoo-11/safeguru` |
| Holiday Golf v16 | `git.factorlibre.com/odoo-16/holiday-golf` |
| The New Society v16 | `git.factorlibre.com/odoo-16/the-new-society` |
| Padel Nuestro v16 | `git.factorlibre.com/odoo-16/padel-nuestro` |
| Bimani v16 | `git.factorlibre.com/odoo-16/bimani` |
| Scalpers v11 | `git.factorlibre.com/odoo-11/scalpers-v11` |
| fl-v16 (producto) | `git.factorlibre.com/odoo-16/fl-v16` |

### Qué filtros aplicar en GitLab

En la vista de Issues de cada proyecto:
- **Label:** `ALMACÉN` o `almacen`
- **Weight (puntos de historia):** filtra `>= 8`
- **Milestone:** cualquier sprint activo o pasado
- **Search:** prueba con `stock`, `SGA`, `picking`, `albarán`, `inventario`, `reserva`

### Indicadores de complejidad en una issue de GitLab

- Más de **10 comentarios** en la issue
- Aparecen **tanto técnicos como funcionales** en los comentarios
- La issue tiene **sub-tareas o issues relacionadas** (linked issues)
- Hay un **MR revertido** (merge → revert)
- Menciones a reuniones, calls, o "nos juntamos"
- Más de **1 semana** entre el primer comentario y el cierre

---

## Miembros del equipo de referencia

Si ves alguno de estos nombres en una conversación/issue, es tarea del equipo de almacén:

| Perfil | Nombre |
|--------|--------|
| **Funcional** | Sabrina Iborra, Nacho Morales (Ignacio Morales), Javier Sánchez, Luis Novalio, Rodrigo Bonilla, Nuria Delgado, Natalia Ruiz, Daniel Cagigas, Lucas Andreu |
| **Técnico** | Adrián Cifuentes, Óscar Indias, Adriana Saiz, Álvaro Gómez, Sergio Bustamante |

---

## Cómo evaluar si una tarea es buen caso

Hazte estas preguntas:

1. ¿Puede alguien **sin ser técnico experto** entender el problema si se lo explicas bien?
2. ¿Hay **una causa raíz clara** aunque no obvia?
3. ¿Las 4 opciones de respuesta serían todas plausibles para alguien que no conoce la solución?
4. ¿La respuesta incorrecta más tentadora tiene sentido intuitivamente pero falla en algo concreto?
5. ¿El caso pone en valor la **colaboración técnico-funcional** (ninguno lo resuelve solo)?

Si respondes sí a 4 o 5 → candidato excelente.

---

## Formato de entrega: plantilla JSON

Cuando tengas una tarea candidata confirmada, el caso debe seguir este formato exacto
para poder importarlo directamente en la app:

```json
{
  "cases": [
    {
      "title": "Título del caso (máx 60 caracteres, evocador)",
      "points": 100,
      "stage1": "Contexto inicial breve. Solo los síntomas visibles. NO la causa. El equipo debe poder debatir sin saber la respuesta. (2-4 frases)",
      "stage2": "Contexto ampliado. Añade ~70% de la información real. Pistas concretas pero sin revelar la causa raíz. (4-6 frases)",
      "stage3": "Pista clave sutil. Una observación específica que, bien interpretada, apunta directamente a la solución. (1-3 frases)",
      "answers": [
        "Opción A — plausible pero incorrecta",
        "Opción B — CORRECTA (la respuesta real)",
        "Opción C — plausible pero incorrecta",
        "Opción D — plausible pero incorrecta"
      ],
      "correctAnswerIndex": 1,
      "moraleja": "La lección que deja el caso. Una o dos frases que sintetizan el aprendizaje clave para el equipo."
    }
  ]
}
```

> **Nota importante sobre `correctAnswerIndex`:** es **0-based** (A=0, B=1, C=2, D=3).
> Si la respuesta correcta es la B, pon `1`.

### Criterios por campo

| Campo | Criterio de calidad |
|-------|---------------------|
| `title` | Evocador, sin spoiler, con tensión narrativa |
| `stage1` | Solo síntomas. Ambiguo a propósito. Invita al debate. |
| `stage2` | Añade hechos objetivos. Elimina algunas hipótesis pero no todas. |
| `stage3` | Una sola observación concreta. No dice la solución, pero el equipo debería poder deducirla. |
| `answers` | Las 4 opciones deben parecer razonables. La incorrecta más tentadora debe ser la que elige alguien que "casi lo entiende". |
| `points` | 100 para casos normales, 150 para los más complejos, 200 para los de Tier 1 |
| `moraleja` | Una o dos frases. La lección que deja el caso para el equipo. No se muestra durante la dinámica. |

---

## Flujo de trabajo sugerido

```
1. Buscar en Slack/GitLab usando las queries de arriba
2. Anotar candidatos con: título, URL GitLab, 2-3 frases de por qué es complejo
3. Compartir candidatos en #af-almacen para validación del equipo
4. Para cada candidato confirmado → redactar el JSON siguiendo la plantilla
5. Revisar con alguien del otro perfil (técnico revisa si el funcional lo redactó y viceversa)
6. Importar en la app: Admin → Casos → 📥 Importar JSON
```

---

## Casos ya identificados y reservados

> Los siguientes casos han sido ya asignados a la sesión principal y **no deben duplicarse**:

- Noon — Deadlock en reservas de stock (ShareLock PostgreSQL)
- fl-v16 #6031 — Selector de parámetros: merge revertido por impacto en Patitas
- The New Society — Albaranes eliminados entre 3 almacenes y stock descuadrado
- Scalpers v11 #4927 — Batchs de Venta en Firme sin poder asignar ubicaciones
- Patitas and Co #449 — SGA procesando unidades de más, stock negativo
- Safeguru #798 + #745 — Descuadre valoración inventario, no puede cerrar año fiscal
- fl-v16 #8238 — Desambiguación ATC y SGA (coexistencia mismo `_usage`)
- Boxnox #1017 — Discrepancia stock: expedido en Factor5, pendiente en Odoo
- Fisura #1041 + #984 — Etiqueta EDI Amazon, expedite el día del arranque
- fl-v16 #5945 — Concurrencias en SGA multi-operario
- Holiday Golf #709 — Timeout al validar albarán (flujo MTO+MTS)
- Noon #841 — Reposición en caliente bloqueante
- fl-v16 #8217 — Informe valoración FIFO incorrecto
- Compañía Fantástica #1790 — Diferencias entregado vs facturado
- fl-v16 #7823 — Cancelación pedidos intercompany Noon (routing dinámico)
- Fisura #990 — Stock a fecha anterior, ubicaciones mal configuradas
- Boxnox #1040 — Unidades en negativo pedidos ECI
- fl-v16 #6748 — Error "expected singleton" informe albarán (Bimani)
- Weelko #380 — Error en asignaciones con reserva
- MasMusculo — Arranque: flujo de rutas no funciona
- Nait Nait — FIFO + valoración por ubicación específica

---

*Generado para la dinámica "El Almacén en Crisis" — FactorLibre, marzo 2026*
