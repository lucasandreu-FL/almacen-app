# Instrucciones para Claude Code — GÜERJAUS TBT

## Quién eres y qué estás haciendo

Eres el desarrollador principal de **GÜERJAUS TBT**, una app web de dinámica de teambuilding para el equipo de almacén de FactorLibre. Tienes acceso completo al código fuente en esta carpeta.

Antes de hacer cualquier cosa, lee siempre:
1. `CONTEXT.md` — arquitectura, decisiones de diseño y estado del proyecto
2. `server.js` — lógica de backend y WebSockets
3. `public/index.html` — toda la UI en un único fichero

---

## Tu stack de trabajo

- **Backend**: Node.js + Express + WebSockets (`ws`) → `server.js`
- **Frontend**: HTML + CSS + JS vanilla en un único fichero → `public/index.html`
- **Sin frameworks, sin build step, sin TypeScript**
- **Sin base de datos**: estado en memoria durante la sesión

---

## Cómo trabajar

### Antes de cada cambio
1. Lee los ficheros relevantes para entender el estado actual
2. Planifica el cambio sin tocar nada todavía
3. Confirma el plan si hay dudas de alcance

### Al hacer cambios
- Modifica directamente `server.js` y/o `public/index.html`
- Un cambio a la vez, verificando que no rompe lo anterior
- Si el cambio es en `server.js`, avisa para reiniciar el servidor local
- Si el cambio es solo en `public/index.html`, basta con recargar el navegador

### Después de cada cambio
- Describe exactamente qué has cambiado y en qué fichero
- Indica si hay que reiniciar el servidor o solo recargar el navegador
- Si hay algo que probar, explica exactamente cómo hacerlo

---

## Cómo publicar a producción

Cuando se te pida publicar, desplegar o subir cambios, ejecuta esto en orden:

```bash
cd ~/almacen-app
git add .
git commit -m "DESCRIPCIÓN_DEL_CAMBIO"
git push
```

Sustituye `DESCRIPCIÓN_DEL_CAMBIO` por un mensaje descriptivo en español de lo que se ha hecho.

Railway detecta el push automáticamente y redespliega en ~1 minuto. No hace falta hacer nada más.

### Mensajes de commit buenos
```
añadir exportación de resultados en PDF
corregir bug de timer al pausar en STAGE_3
mejorar vista proyector en pantalla grande
precarga de los 10 casos del documento Word
añadir persistencia básica con fichero JSON
```

---

## Cómo reiniciar el servidor local

```bash
# Matar lo que esté en el puerto 3000
fuser -k 3000/tcp

# Arrancar de nuevo
cd ~/almacen-app && node server.js
```

Si nodemon está corriendo en otra terminal, el reinicio es automático al guardar.

---

## Reglas que nunca debes romper

1. **No cambies la arquitectura** sin preguntar — el frontend es vanilla JS en un único fichero, no introduzcas frameworks ni build steps
2. **No fragmentes el HTML** — todo sigue en `public/index.html`
3. **No instales dependencias nuevas** sin confirmación explícita
4. **No toques** el sistema de WebSockets (mensajes, tipos, estructura) sin confirmar el cambio completo primero
5. **Mantén compatibilidad** con el flujo de etapas existente: STAGE_1 → STAGE_1_DEBATE → STAGE_2 → STAGE_2_DEBATE → STAGE_3 → STAGE_3_DEBATE → STAGE_4 → RESULTS
6. **No elimines** la mecánica de adelantar (skip) ni el sistema de puntuación (+30%/-50%)
7. **Haz git push** siempre que se te pida publicar — no es necesario entrar en Railway manualmente

---

## Flujo de desarrollo + despliegue en una sola orden

Si se te pide "haz X y publícalo", el flujo completo es:

```bash
# 1. Hacer el cambio en los ficheros
# 2. Probar localmente si es posible
# 3. Publicar
git add .
git commit -m "descripción del cambio"
git push
```

---

## Referencia rápida de la app

| Concepto | Detalle |
|----------|---------|
| Puerto local | 3000 |
| Arrancar | `node server.js` |
| Fichero principal backend | `server.js` |
| Fichero principal frontend | `public/index.html` |
| Estado global frontend | objeto `S` en `index.html` |
| Credenciales admin por defecto | admin@factorlibre.com / admin123 |
| Los equipos los crea | el admin desde el panel |
| Contexto completo del proyecto | `CONTEXT.md` |

Para el detalle completo de la arquitectura, mensajes WebSocket, estructura de datos y decisiones de diseño → leer `CONTEXT.md`.
