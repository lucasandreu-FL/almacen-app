const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── Heartbeat: detectar conexiones muertas ────────────────────────────────────
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws._isAlive === false) { ws.terminate(); return; }
    ws._isAlive = false;
    ws.ping();
  });
}, 30000);

// ── Data persistence ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_PEOPLE = [
  { id: 'person-1', name: 'Lucas Andreu',  email: 'lucas.andreu@factorlibre.com',  password: 'lucas12345',   role: 'admin', createdAt: Date.now() },
  { id: 'person-2', name: 'Adriana Saiz',  email: 'adriana.saiz@factorlibre.com',  password: 'adriana12345', role: 'admin', createdAt: Date.now() },
  { id: 'person-3', name: 'Álvaro Gómez', email: 'alvaro.gomez@factorlibre.com',  password: 'alvaro12345',  role: 'admin', createdAt: Date.now() },
];

// users.people: [{ id, name, email, password, role:'admin'|'user', createdAt }]
// users.teams:  [{ id, teamName, memberIds:[], createdAt }]
const users    = { people: [], teams: [] };
const sessions = {};
const clients  = {}; // roomCode → Set<{ ws, role, personId, teamId }>
const waitingClients = new Set(); // clientes esperando sesión activa

// ── Persist ───────────────────────────────────────────────────────────────────
function saveData() {
  try {
    const data = {
      users,
      sessions: Object.fromEntries(
        Object.entries(sessions).map(([code, s]) => {
          // eslint-disable-next-line no-unused-vars
          const { timer, awaitingReconnect, ...rest } = s;
          return [code, rest]; // timer y awaitingReconnect son transitorios
        })
      )
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error guardando data.json:', err.message);
  }
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      users.people = [...DEFAULT_PEOPLE];
      saveData();
      console.log('data.json creado con personas por defecto');
      return;
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    // ── Migración formato antiguo (admins[]+teams[] con creds) → nuevo (people[]+teams[]) ──
    if (data.users?.admins && !data.users?.people) {
      console.log('[MIGRACIÓN] Formato antiguo detectado → convirtiendo a nuevo modelo');
      users.people = [
        ...(data.users.admins || []).map(a => ({
          id: a.id, name: a.name, email: a.email, password: a.password,
          role: 'admin', createdAt: a.createdAt || Date.now()
        })),
        ...(data.users.teams || []).map(t => ({
          id: t.id, name: t.teamName || t.name, email: t.email, password: t.password,
          role: 'user', createdAt: t.createdAt || Date.now()
        })),
      ];
      users.teams = []; // Los equipos antiguos tenían credenciales propias — no se migran automáticamente
      for (const [code, s] of Object.entries(data.sessions || {})) {
        sessions[code] = { ...s, timer: null, awaitingReconnect: new Set(), pausedByDisconnect: false };
      }
      saveData();
      console.log(`Migración completada: ${users.people.length} personas. Recrea los equipos desde el panel.`);
      return;
    }

    users.people = data.users?.people?.length ? data.users.people : [...DEFAULT_PEOPLE];
    users.teams  = data.users?.teams  || [];

    for (const [code, s] of Object.entries(data.sessions || {})) {
      sessions[code] = {
        ...s,
        timer: null,
        awaitingReconnect: new Set(),
        pausedByDisconnect: false // al reiniciar server se resetea — admin puede reanudar manualmente
      };
    }
    console.log(`Cargados: ${users.people.length} personas, ${users.teams.length} equipos, ${Object.keys(sessions).length} sesiones`);

    // Reiniciar timers de sesiones activas
    for (const code of Object.keys(sessions)) restartTimerAfterLoad(code);

  } catch (err) {
    console.error('Error cargando data.json:', err.message);
    users.people = [...DEFAULT_PEOPLE];
  }
}

// ── Helpers básicos ───────────────────────────────────────────────────────────
function generateCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}
function findPerson(email, password) {
  return users.people.find(p => p.email === email && p.password === password);
}
function getPersonTeam(personId) {
  return users.teams.find(t => t.memberIds?.includes(personId));
}
function getActiveSession() {
  return Object.values(sessions).find(s => s.status === 'RUNNING') || null;
}
function getPublicUsers() {
  return {
    people: users.people.map(p => ({ ...p, password: undefined })),
    teams: users.teams
  };
}

// ── Broadcast ─────────────────────────────────────────────────────────────────
function broadcast(sessionId, message, excludeWs = null) {
  if (!clients[sessionId]) return;
  const data = JSON.stringify(message);
  clients[sessionId].forEach(c => {
    if (c.ws !== excludeWs && c.ws.readyState === 1) {
      try { c.ws.send(data); } catch (e) { /* ignorar errores de envío individuales */ }
    }
  });
}
function broadcastAll(sessionId, message) { broadcast(sessionId, message); }

function getPublicSession(session) {
  return {
    ...session,
    awaitingReconnect: [...(session.awaitingReconnect || [])],
    cases: session.cases.map((c, i) => {
      const isPast = i < session.currentCaseIndex;
      const isResults = i === session.currentCaseIndex && session.currentStage === 'RESULTS';
      return { ...c, correctAnswerIndex: (isResults || isPast) ? c.correctAnswerIndex : undefined };
    })
  };
}
function getLeaderboard(session) {
  return [...session.teams]
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ position: i + 1, teamId: t.id, teamName: t.teamName, score: t.score }));
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function clearTimer(sid) {
  if (sessions[sid]?.timer) { clearInterval(sessions[sid].timer); sessions[sid].timer = null; }
}

function startTimer(sid, seconds, onExpire) {
  clearTimer(sid);
  const s = sessions[sid];
  s.timerEnd = Date.now() + seconds * 1000;
  s.paused = false;
  s.pausedRemaining = null;
  s.pausedByDisconnect = false;
  s.timer = setInterval(() => {
    if (s.paused) return;
    const remaining = Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 1000));
    broadcastAll(sid, { type: 'TIMER_TICK', remaining, timerEnd: s.timerEnd, paused: false });
    if (remaining <= 0) { clearTimer(sid); onExpire(); }
  }, 500);
}

function pauseTimer(sid, byDisconnect = false) {
  const s = sessions[sid];
  if (!s || s.paused) return;
  s.paused = true;
  s.pausedRemaining = Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 1000));
  if (byDisconnect) s.pausedByDisconnect = true;
  logEvent(sid, 'TIMER_PAUSED', { byDisconnect, remaining: s.pausedRemaining });
  broadcastAll(sid, { type: 'TIMER_PAUSED', remaining: s.pausedRemaining, paused: true, byDisconnect });
}

function resumeTimer(sid) {
  const s = sessions[sid];
  if (!s || !s.paused) return;
  s.paused = false;
  s.pausedByDisconnect = false;
  s.timerEnd = Date.now() + (s.pausedRemaining || 0) * 1000;
  logEvent(sid, 'TIMER_RESUMED', { remaining: s.pausedRemaining });
  broadcastAll(sid, { type: 'TIMER_RESUMED', remaining: s.pausedRemaining, paused: false });
  s.pausedRemaining = null;
}

// ── Timer restart tras reinicio del servidor ───────────────────────────────────
function restartTimerAfterLoad(sid) {
  const s = sessions[sid];
  if (!s || s.status !== 'RUNNING') return;
  const timerStages = ['STAGE_1','STAGE_1_DEBATE','STAGE_2','STAGE_2_DEBATE','STAGE_3','STAGE_3_DEBATE','STAGE_4'];
  if (!timerStages.includes(s.currentStage)) return;

  if (s.paused) {
    logEvent(sid, 'SERVER_RESTART', { action: 'already_paused', stage: s.currentStage });
    console.log(`[${sid}] Reinicio: sesión ya pausada en ${s.currentStage}`);
    return;
  }

  const remaining = s.timerEnd ? Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 1000)) : 0;

  if (remaining <= 0) {
    // Timer expiró mientras el servidor estaba caído → pausar, no auto-avanzar
    s.paused = true;
    s.pausedRemaining = 0;
    s.pausedByDisconnect = false;
    logEvent(sid, 'SERVER_RESTART', { action: 'timer_expired_paused', stage: s.currentStage });
    saveData();
    console.log(`[${sid}] Reinicio: timer expirado en ${s.currentStage} → sesión PAUSADA (admin debe saltar o reanudar)`);
  } else {
    // Tiempo válido restante → reanudar timer normalmente
    logEvent(sid, 'SERVER_RESTART', { action: 'timer_resumed', stage: s.currentStage, remaining });
    const expiry = getNextStageExpiry(sid, s.currentStage);
    if (expiry) {
      s.timer = setInterval(() => {
        if (s.paused) return;
        const rem = Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 1000));
        broadcastAll(sid, { type: 'TIMER_TICK', remaining: rem, timerEnd: s.timerEnd, paused: false });
        if (rem <= 0) { clearTimer(sid); expiry(); }
      }, 500);
    }
    console.log(`[${sid}] Reinicio: reanudando timer con ${remaining}s en ${s.currentStage}`);
  }
}

// ── Stage machine ─────────────────────────────────────────────────────────────
function getNextStageExpiry(sid, stage) {
  const map = {
    STAGE_1:       () => advanceToStage(sid, 'STAGE_1_DEBATE'),
    STAGE_1_DEBATE:() => advanceToStage(sid, 'STAGE_2'),
    STAGE_2:       () => advanceToStage(sid, 'STAGE_2_DEBATE'),
    STAGE_2_DEBATE:() => { sessions[sid].skipAvailable = false; advanceToStage(sid, 'STAGE_3'); },
    STAGE_3:       () => advanceToStage(sid, 'STAGE_3_DEBATE'),
    STAGE_3_DEBATE:() => advanceToStage(sid, 'STAGE_4'),
    STAGE_4:       () => resolveCase(sid),
    RESULTS:       () => {}
  };
  return map[stage];
}

function advanceToStage(sid, stage) {
  const s = sessions[sid];
  if (!s) return;
  logEvent(sid, 'STAGE_CHANGE', { newStage: stage });
  s.currentStage = stage;
  const cfg = s.config;
  const timeMap = {
    STAGE_1: cfg.stage1Time, STAGE_1_DEBATE: cfg.stage1DebateTime,
    STAGE_2: cfg.stage2Time, STAGE_2_DEBATE: cfg.stage2DebateTime,
    STAGE_3: cfg.stage3Time, STAGE_3_DEBATE: cfg.stage3DebateTime,
    STAGE_4: 120, RESULTS: cfg.resultsTime || 20
  };
  if (stage === 'STAGE_1') { s.skipTeamId = null; s.skipAvailable = false; s.answers = {}; }
  if (stage === 'STAGE_2_DEBATE') s.skipAvailable = true;

  broadcastAll(sid, { type: 'STAGE_CHANGE', stage, caseIndex: s.currentCaseIndex, session: getPublicSession(s) });
  const expiry = getNextStageExpiry(sid, stage);
  // Para STAGE_1, añadir los 5s de la cuenta atrás del cliente al timer para que al terminar quede el tiempo completo
  const timerSecs = timeMap[stage] + (stage === 'STAGE_1' ? 5 : 0);
  if (expiry && timeMap[stage]) startTimer(sid, timerSecs, expiry);
}

function resolveCase(sid) {
  const s = sessions[sid];
  if (!s) return;
  const cc = s.cases[s.currentCaseIndex];
  const correct = cc.correctAnswerIndex;
  const base = cc.points;
  const results = [];
  s.teams.forEach(team => {
    const ans = s.answers[team.id];
    const isSkipper = team.id === s.skipTeamId;
    const didAnswer = ans !== undefined;
    const isCorrect = didAnswer && ans.answerIndex === correct;
    let pts = 0;
    if (isCorrect) pts = isSkipper ? Math.round(base * 1.3) : base;
    else if (isSkipper) pts = -Math.round(base * 0.5);
    team.score += pts;
    team.history.push({ caseIndex: s.currentCaseIndex, caseTitle: cc.title, answerIndex: ans?.answerIndex, isCorrect, isSkipper, pointsEarned: pts });
    results.push({ teamId: team.id, teamName: team.teamName, answerIndex: ans?.answerIndex, isCorrect, isSkipper, pointsEarned: pts, totalScore: team.score, didAnswer, bonus: isSkipper && isCorrect, penalty: isSkipper && !isCorrect });
  });
  logEvent(sid, 'CASE_RESOLVED', {
    caseTitle: cc.title,
    correctAnswerIndex: correct,
    correctAnswerText: cc.answers[correct],
    correctAnswerLabel: String.fromCharCode(65 + correct),
    results: results.map(r => ({ teamName: r.teamName, answerIndex: r.answerIndex, answerLabel: r.answerIndex !== undefined ? String.fromCharCode(65 + r.answerIndex) : null, answerText: r.answerIndex !== undefined ? cc.answers[r.answerIndex] : null, isCorrect: r.isCorrect, isSkipper: r.isSkipper, pts: r.pointsEarned }))
  });
  s.currentStage = 'RESULTS';
  s.lastResults = results;
  saveData();
  broadcastAll(sid, { type: 'CASE_RESULTS', results, correctAnswerIndex: correct, correctAnswerText: cc.answers[correct], caseIndex: s.currentCaseIndex, leaderboard: getLeaderboard(s), eventLog: s.eventLog });
}

// ── Event log ─────────────────────────────────────────────────────────────────
function logEvent(sid, ev, detail = {}) {
  const s = sessions[sid]; if (!s) return;
  const entry = { ts: Date.now(), ev, ci: s.currentCaseIndex, stage: s.currentStage, ...detail };
  if (!s.eventLog) s.eventLog = [];
  s.eventLog.push(entry);
  if (s.eventLog.length > 500) s.eventLog.splice(0, s.eventLog.length - 500);
}

// ── Disconnect helpers ────────────────────────────────────────────────────────
function disconnectKey(role, teamId, personId) {
  if (role === 'team')     return `team:${teamId}`;
  if (role === 'admin')    return `admin:${personId}`;
  return 'projector';
}
function isTimerStage(stage) {
  return ['STAGE_1','STAGE_1_DEBATE','STAGE_2','STAGE_2_DEBATE','STAGE_3','STAGE_3_DEBATE','STAGE_4','RESULTS'].includes(stage);
}
function clientName(role, teamId, personId, session) {
  if (role === 'team')     return session?.teams?.find(t => t.id === teamId)?.teamName || 'Equipo';
  if (role === 'admin')    return users.people.find(p => p.id === personId)?.name || 'Admin';
  return 'Proyector';
}

// ── WebSocket ──────────────────────────────────────────────────────────────────
wss.on('connection', ws => {
  ws._isAlive = true;
  ws.on('pong', () => { ws._isAlive = true; });
  ws.on('error', err => console.error('[WS] connection error:', err.message));

  let sid = null, clientRole = null, clientPersonId = null, clientTeamId = null;

  // Registra el cliente en la sesión y gestiona reconexión pendiente
  function joinSession(session, role, teamId, personId) {
    sid = session.roomCode;
    clientRole = role;
    clientTeamId = teamId;
    clientPersonId = personId;
    if (!clients[sid]) clients[sid] = new Set();
    clients[sid].add({ ws, role, teamId, personId });

    const key = disconnectKey(role, teamId, personId);
    const cname = clientName(role, teamId, personId, session);
    logEvent(sid, 'CLIENT_CONNECTED', { role, name: cname });
    if (session.awaitingReconnect?.has(key)) {
      session.awaitingReconnect.delete(key);
      const name = cname;
      broadcastAll(sid, { type: 'CLIENT_RECONNECTED', role, name, awaitingReconnect: [...session.awaitingReconnect] });
      // Si nadie más espera y la pausa fue por desconexión → reanudar
      if (session.awaitingReconnect.size === 0 && session.pausedByDisconnect) {
        resumeTimer(sid);
        saveData();
      }
    }
  }

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload } = msg;

    // ── Login unificado ──
    if (type === 'UNIFIED_LOGIN') {
      const { email, password } = payload;
      const person = findPerson(email, password);
      if (!person) { ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Credenciales incorrectas' })); return; }

      if (person.role === 'admin') {
        clientRole = 'admin';
        clientPersonId = person.id;
        ws.send(JSON.stringify({
          type: 'ADMIN_LOGIN_OK',
          admin: { id: person.id, name: person.name, email: person.email, role: 'admin' },
          sessions: Object.values(sessions).map(s => ({ roomCode: s.roomCode, status: s.status, casesCount: s.cases.length, teamsCount: s.teams.length, createdAt: s.createdAt })),
          users: getPublicUsers(),
          activeSessionCode: getActiveSession()?.roomCode || null
        }));
        return;
      }

      // role === 'user'
      const team = getPersonTeam(person.id);
      if (!team) {
        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'No estás asignado a ningún equipo. Contacta con el administrador.' }));
        return;
      }
      const session = payload.roomCode ? sessions[payload.roomCode] : getActiveSession();
      if (!session) {
        waitingClients.add({ ws, loginMsg: { type, payload } });
        ws.send(JSON.stringify({ type: 'WAITING', message: 'No hay ninguna sesión activa en este momento. El moderador iniciará la dinámica pronto.' }));
        return;
      }
      let sessionTeam = session.teams.find(t => t.id === team.id);
      if (!sessionTeam) {
        if (session.status === 'RUNNING') { ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'La sesión ya ha comenzado y tu equipo no está registrado en ella.' })); return; }
        sessionTeam = { id: team.id, teamName: team.teamName, score: 0, history: [], connected: true };
        session.teams.push(sessionTeam);
      } else {
        sessionTeam.connected = true;
      }
      joinSession(session, 'team', team.id, person.id);
      ws.send(JSON.stringify({
        type: 'TEAM_LOGIN_OK',
        team: { id: team.id, teamName: team.teamName, color: team.color || '#f5a623' },
        session: getPublicSession(session),
        leaderboard: getLeaderboard(session),
        paused: session.paused,
        timerEnd: session.timerEnd,
        pausedRemaining: session.pausedRemaining,
        awaitingReconnect: [...(session.awaitingReconnect || [])],
        lastResults: session.lastResults
      }));
      broadcastAll(sid, { type: 'TEAMS_UPDATED', teams: session.teams, leaderboard: getLeaderboard(session) });
      return;
    }

    // ── Proyector ──
    if (type === 'PROJECTOR_JOIN') {
      const session = payload.roomCode ? sessions[payload.roomCode] : getActiveSession();
      if (!session) {
        waitingClients.add({ ws, loginMsg: { type, payload } });
        ws.send(JSON.stringify({ type: 'WAITING', message: 'No hay ninguna sesión activa. Espera a que el administrador la inicie.' }));
        return;
      }
      joinSession(session, 'projector', null, null);
      ws.send(JSON.stringify({
        type: 'PROJECTOR_JOIN_OK',
        session: getPublicSession(session),
        leaderboard: getLeaderboard(session),
        paused: session.paused,
        timerEnd: session.timerEnd,
        pausedRemaining: session.pausedRemaining,
        awaitingReconnect: [...(session.awaitingReconnect || [])],
        lastResults: session.lastResults
      }));
      return;
    }

    // ── Admin: unirse a sesión existente ──
    if (type === 'ADMIN_JOIN_SESSION' && clientRole === 'admin') {
      const session = sessions[payload.roomCode];
      if (!session) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Sala no encontrada' })); return; }
      joinSession(session, 'admin', null, clientPersonId);
      ws.send(JSON.stringify({ type: 'SESSION_STATE', session, leaderboard: getLeaderboard(session), timerEnd: session.timerEnd, paused: session.paused, pausedRemaining: session.pausedRemaining, awaitingReconnect: [...(session.awaitingReconnect||[])] }));
      return;
    }

    // ── Admin: crear sesión ──
    if (type === 'ADMIN_CREATE_SESSION' && clientRole === 'admin') {
      const active = getActiveSession();
      if (active) { ws.send(JSON.stringify({ type: 'ERROR', message: `Ya hay una sesión activa (${active.roomCode}). Finalízala primero.` })); return; }
      const code = generateCode();
      sessions[code] = {
        roomCode: code, status: 'LOBBY', cases: [], teams: [], answers: {},
        config: { stage1Time:60, stage1DebateTime:120, stage2Time:90, stage2DebateTime:300, stage3Time:60, stage3DebateTime:180, resultsTime:20 },
        currentCaseIndex:0, currentStage:'LOBBY', skipTeamId:null, skipAvailable:false,
        timer:null, timerEnd:null, paused:false, pausedRemaining:null, pausedByDisconnect:false,
        lastResults:null, awaitingReconnect: new Set(), eventLog: [], createdAt: Date.now()
      };
      joinSession(sessions[code], 'admin', null, clientPersonId);
      saveData();
      ws.send(JSON.stringify({ type: 'SESSION_CREATED', roomCode: code, session: sessions[code] }));
      return;
    }

    // ── Admin: gestión de personas ──
    if (type === 'ADMIN_CREATE_PERSON' && clientRole === 'admin') {
      const { name, email, password, role } = payload;
      if (!name || !email || !password) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Nombre, email y contraseña son obligatorios' })); return; }
      if (users.people.find(p => p.email === email)) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Email ya registrado' })); return; }
      users.people.push({ id: crypto.randomUUID(), name, email, password, role: role || 'user', createdAt: Date.now() });
      saveData();
      ws.send(JSON.stringify({ type: 'USERS_UPDATED', users: getPublicUsers() }));
      return;
    }

    if (type === 'ADMIN_UPDATE_PERSON' && clientRole === 'admin') {
      const { id, ...fields } = payload;
      const idx = users.people.findIndex(p => p.id === id);
      if (idx < 0) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Persona no encontrada' })); return; }
      if (fields.password === '') delete fields.password;
      Object.assign(users.people[idx], fields);
      saveData();
      ws.send(JSON.stringify({ type: 'USERS_UPDATED', users: getPublicUsers() }));
      return;
    }

    if (type === 'ADMIN_DELETE_PERSON' && clientRole === 'admin') {
      const { id } = payload;
      const team = getPersonTeam(id);
      if (team) { ws.send(JSON.stringify({ type: 'ERROR', message: `Pertenece al equipo "${team.teamName}". Quítala del equipo antes de eliminarla.` })); return; }
      users.people = users.people.filter(p => p.id !== id);
      saveData();
      ws.send(JSON.stringify({ type: 'USERS_UPDATED', users: getPublicUsers() }));
      return;
    }

    // ── Admin: gestión de equipos ──
    if (type === 'ADMIN_CREATE_TEAM' && clientRole === 'admin') {
      const { teamName, memberIds } = payload;
      if (!teamName) { ws.send(JSON.stringify({ type: 'ERROR', message: 'El nombre del equipo es obligatorio' })); return; }
      if (!memberIds?.length) { ws.send(JSON.stringify({ type: 'ERROR', message: 'El equipo necesita al menos un miembro' })); return; }
      for (const pid of memberIds) {
        const existing = getPersonTeam(pid);
        if (existing) { ws.send(JSON.stringify({ type: 'ERROR', message: `${users.people.find(p=>p.id===pid)?.name||pid} ya pertenece a "${existing.teamName}"` })); return; }
      }
      const { color } = payload;
      users.teams.push({ id: crypto.randomUUID(), teamName, memberIds, color: color || '#f5a623', createdAt: Date.now() });
      saveData();
      ws.send(JSON.stringify({ type: 'USERS_UPDATED', users: getPublicUsers() }));
      return;
    }

    if (type === 'ADMIN_UPDATE_TEAM' && clientRole === 'admin') {
      const { id, teamName, memberIds } = payload;
      const idx = users.teams.findIndex(t => t.id === id);
      if (idx < 0) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Equipo no encontrado' })); return; }
      if (memberIds) {
        for (const pid of memberIds) {
          const existing = getPersonTeam(pid);
          if (existing && existing.id !== id) { ws.send(JSON.stringify({ type: 'ERROR', message: `${users.people.find(p=>p.id===pid)?.name||pid} ya pertenece a "${existing.teamName}"` })); return; }
        }
        users.teams[idx].memberIds = memberIds;
      }
      if (teamName) users.teams[idx].teamName = teamName;
      if (payload.color) users.teams[idx].color = payload.color;
      saveData();
      ws.send(JSON.stringify({ type: 'USERS_UPDATED', users: getPublicUsers() }));
      return;
    }

    if (type === 'ADMIN_DELETE_TEAM' && clientRole === 'admin') {
      users.teams = users.teams.filter(t => t.id !== payload.id);
      saveData();
      ws.send(JSON.stringify({ type: 'USERS_UPDATED', users: getPublicUsers() }));
      return;
    }

    // ── Admin: terminar sesión (no requiere estar dentro de ella) ──
    if (type === 'ADMIN_KILL_SESSION' && clientRole === 'admin') {
      const { roomCode } = payload;
      const target = sessions[roomCode];
      if (!target) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Sesión no encontrada' })); return; }
      clearTimer(roomCode);
      broadcast(roomCode, { type: 'SESSION_KILLED', roomCode });
      delete sessions[roomCode];
      if (clients[roomCode]) { clients[roomCode].clear(); delete clients[roomCode]; }
      saveData();
      ws.send(JSON.stringify({
        type: 'SESSIONS_UPDATED',
        sessions: Object.values(sessions).map(s => ({ roomCode: s.roomCode, status: s.status, casesCount: s.cases.length, teamsCount: s.teams.length, createdAt: s.createdAt }))
      }));
      return;
    }

    // ── A partir de aquí se requiere sesión activa ──
    if (!sid || !sessions[sid]) return;
    const session = sessions[sid];

    if (type === 'ADMIN_SAVE_CASE' && clientRole === 'admin') {
      const { caseData } = payload;
      if (caseData.id) {
        const idx = session.cases.findIndex(c => c.id === caseData.id);
        if (idx === session.currentCaseIndex && session.status === 'RUNNING') { ws.send(JSON.stringify({ type: 'ERROR', message: 'No se puede editar el caso activo' })); return; }
        if (idx >= 0) session.cases[idx] = caseData; else session.cases.push({ ...caseData, id: crypto.randomUUID() });
      } else {
        session.cases.push({ ...caseData, id: crypto.randomUUID() });
      }
      saveData();
      ws.send(JSON.stringify({ type: 'CASES_UPDATED', cases: session.cases }));
      return;
    }

    if (type === 'ADMIN_IMPORT_CASES' && clientRole === 'admin') {
      const { cases } = payload;
      if (!Array.isArray(cases)) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Formato inválido: se espera un array "cases"' })); return; }
      let imported = 0, skipped = 0;
      for (const c of cases) {
        const valid = c.title && c.stage1 && c.stage2 && c.stage3
          && Array.isArray(c.answers) && c.answers.length === 4
          && c.correctAnswerIndex !== undefined && c.correctAnswerIndex >= 0 && c.correctAnswerIndex <= 3;
        if (!valid) { skipped++; continue; }
        session.cases.push({
          id: crypto.randomUUID(),
          title: String(c.title),
          points: Number(c.points) || 100,
          stage1: String(c.stage1),
          stage2: String(c.stage2),
          stage3: String(c.stage3),
          answers: c.answers.map(String),
          correctAnswerIndex: Number(c.correctAnswerIndex),
          ...(c.moraleja ? { moraleja: String(c.moraleja) } : {})
        });
        imported++;
      }
      saveData();
      ws.send(JSON.stringify({ type: 'CASES_UPDATED', cases: session.cases, importResult: { imported, skipped } }));
      return;
    }

    if (type === 'ADMIN_DELETE_CASE' && clientRole === 'admin') {
      const idx = session.cases.findIndex(c => c.id === payload.caseId);
      if (idx < 0) return;
      if (idx === session.currentCaseIndex && session.status === 'RUNNING') { ws.send(JSON.stringify({ type: 'ERROR', message: 'Caso activo' })); return; }
      session.cases.splice(idx, 1);
      saveData();
      ws.send(JSON.stringify({ type: 'CASES_UPDATED', cases: session.cases }));
      return;
    }

    if (type === 'ADMIN_UPDATE_CONFIG' && clientRole === 'admin') {
      Object.assign(session.config, payload.config);
      saveData();
      ws.send(JSON.stringify({ type: 'CONFIG_UPDATED', config: session.config }));
      return;
    }

    if (type === 'ADMIN_START_SESSION' && clientRole === 'admin') {
      if (!session.cases.length) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Añade al menos un caso' })); return; }
      if (!session.teams.length) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Ningún equipo conectado todavía' })); return; }
      const running = Object.values(sessions).find(s => s.status === 'RUNNING' && s.roomCode !== session.roomCode);
      if (running) { ws.send(JSON.stringify({ type: 'ERROR', message: `Ya hay una sesión en curso (${running.roomCode})` })); return; }
      session.status = 'RUNNING';
      session.currentCaseIndex = 0;
      logEvent(sid, 'SESSION_STARTED', { teamsCount: session.teams.length, casesCount: session.cases.length });
      saveData();
      broadcastAll(sid, { type: 'SESSION_STARTED', session: getPublicSession(session) });
      // Notificar a clientes en espera
      waitingClients.forEach(c => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: 'SESSION_AVAILABLE' })); });
      waitingClients.clear();
      advanceToStage(sid, 'STAGE_1');
      return;
    }

    if (type === 'ADMIN_FORCE_STAGE' && clientRole === 'admin') {
      clearTimer(sid);
      session.paused = false; session.pausedByDisconnect = false;
      advanceToStage(sid, payload.stage);
      return;
    }

    if (type === 'ADMIN_NEXT_CASE' && clientRole === 'admin') {
      clearTimer(sid);
      session.paused = false; session.pausedByDisconnect = false;
      if (session.currentCaseIndex < session.cases.length - 1) {
        session.currentCaseIndex++;
        session.skipTeamId = null; session.skipAvailable = false; session.answers = {};
        logEvent(sid, 'NEXT_CASE', { newCaseIndex: session.currentCaseIndex, caseTitle: session.cases[session.currentCaseIndex]?.title });
        saveData();
        advanceToStage(sid, 'STAGE_1');
      } else {
        logEvent(sid, 'SESSION_FINISHED', { leaderboard: getLeaderboard(session).map(e => ({ teamName: e.teamName, score: e.score })) });
        session.status = 'FINISHED';
        saveData();
        broadcastAll(sid, { type: 'SESSION_FINISHED', leaderboard: getLeaderboard(session) });
      }
      return;
    }

    if (type === 'ADMIN_TOGGLE_PAUSE' && clientRole === 'admin') {
      if (session.paused) {
        // Admin fuerza reanudación aunque haya desconectados
        session.awaitingReconnect = new Set();
        resumeTimer(sid);
      } else {
        pauseTimer(sid, false);
      }
      return;
    }

    if (type === 'TEAM_SKIP' && clientRole === 'team') {
      if (!session.skipAvailable || session.skipTeamId) return;
      session.skipTeamId = clientTeamId;
      session.skipAvailable = false;
      const tname = session.teams.find(t => t.id === clientTeamId)?.teamName;
      logEvent(sid, 'TEAM_SKIP', { teamId: clientTeamId, teamName: tname });
      broadcastAll(sid, { type: 'TEAM_SKIPPED', teamId: clientTeamId, teamName: tname, timestamp: payload.timestamp });
      clearTimer(sid);
      advanceToStage(sid, 'STAGE_4');
      return;
    }

    if (type === 'TEAM_ANSWER' && clientRole === 'team') {
      if (session.currentStage !== 'STAGE_4') return;
      if (session.answers[clientTeamId] !== undefined) return;
      session.answers[clientTeamId] = { answerIndex: payload.answerIndex, timestamp: payload.timestamp };
      const cc = session.cases[session.currentCaseIndex];
      const tname = session.teams.find(t => t.id === clientTeamId)?.teamName;
      logEvent(sid, 'TEAM_ANSWER', {
        teamId: clientTeamId, teamName: tname,
        answerIndex: payload.answerIndex,
        answerText: cc?.answers?.[payload.answerIndex],
        answerLabel: String.fromCharCode(65 + payload.answerIndex),
        correctAnswerIndex: cc?.correctAnswerIndex,
        correctAnswerLabel: String.fromCharCode(65 + cc?.correctAnswerIndex),
        isSkipper: clientTeamId === session.skipTeamId
      });
      broadcastAll(sid, { type: 'TEAM_ANSWERED', teamId: clientTeamId, totalAnswered: Object.keys(session.answers).length, totalTeams: session.teams.length });
      if (Object.keys(session.answers).length >= session.teams.length) { clearTimer(sid); resolveCase(sid); }
      return;
    }

    if (type === 'PING') { ws._isAlive = true; ws.send(JSON.stringify({ type: 'PONG' })); return; }

    if (type === 'GET_STATE') {
      const remaining = session.paused
        ? session.pausedRemaining
        : (session.timerEnd ? Math.max(0, Math.ceil((session.timerEnd - Date.now()) / 1000)) : null);
      ws.send(JSON.stringify({ type: 'STATE_SYNC', session: getPublicSession(session), leaderboard: getLeaderboard(session), timerEnd: session.timerEnd, remaining, paused: session.paused, awaitingReconnect: [...(session.awaitingReconnect||[])] }));
      return;
    }
  });

  ws.on('close', () => {
    // Limpiar de waitingClients si estaba esperando
    waitingClients.forEach(c => { if (c.ws === ws) waitingClients.delete(c); });

    if (!sid || !clients[sid]) return;
    clients[sid].forEach(c => { if (c.ws === ws) clients[sid].delete(c); });

    const session = sessions[sid];
    if (!session) return;

    // Comprobar si queda alguna otra conexión del mismo cliente
    const stillConnected = [...clients[sid]].some(c => {
      if (clientRole === 'team')     return c.teamId === clientTeamId;
      if (clientRole === 'admin')    return c.role === 'admin';
      if (clientRole === 'projector')return c.role === 'projector';
      return false;
    });
    if (stillConnected) return;

    // Marcar equipo como desconectado
    if (clientRole === 'team') {
      const t = session.teams.find(t => t.id === clientTeamId);
      if (t) t.connected = false;
      broadcastAll(sid, { type: 'TEAMS_UPDATED', teams: session.teams, leaderboard: getLeaderboard(session) });
    }

    // Auto-pausa si hay timer activo
    if (session.status === 'RUNNING' && isTimerStage(session.currentStage)) {
      const key = disconnectKey(clientRole, clientTeamId, clientPersonId);
      session.awaitingReconnect = session.awaitingReconnect || new Set();
      session.awaitingReconnect.add(key);
      const name = clientName(clientRole, clientTeamId, clientPersonId, session);
      const reason = ws._closeReason || 'ws_close';
      logEvent(sid, 'CLIENT_DISCONNECTED', { role: clientRole, name, reason });
      if (!session.paused) pauseTimer(sid, true);
      saveData();
      broadcastAll(sid, { type: 'CLIENT_DISCONNECTED', role: clientRole, name, awaitingReconnect: [...session.awaitingReconnect] });
    }
  });
});

// ── Error handlers ────────────────────────────────────────────────────────────
process.on('uncaughtException', err => {
  console.error('[CRASH EVITADO] uncaughtException:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH EVITADO] unhandledRejection:', reason);
});

// ── Init + rutas ──────────────────────────────────────────────────────────────
loadData();

// Beacon: cierre de pestaña/navegador detectado por el cliente
app.post('/api/beacon-disconnect', express.text({ type: '*/*' }), (req, res) => {
  try {
    const { sessionCode, role, teamId, personId } = JSON.parse(req.body || '{}');
    if (!sessionCode || !clients[sessionCode]) return res.sendStatus(204);
    // Encontrar la WS de este cliente y terminarla para disparar ws.on('close')
    clients[sessionCode].forEach(c => {
      const roleMatch = role === 'team'     ? c.teamId === teamId
                      : role === 'admin'    ? c.role === 'admin'
                      : role === 'projector'? c.role === 'projector'
                      : false;
      if (roleMatch) { c.ws._closeReason = 'beacon'; c.ws.terminate(); }
    });
  } catch(e) { /* ignorar */ }
  res.sendStatus(204);
});

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/api/sessions/public', (_, res) => {
  res.json(Object.values(sessions)
    .filter(s => s.status !== 'FINISHED')
    .map(s => ({ roomCode: s.roomCode, status: s.status })));
});
app.get('/{*splat}', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🏭 Almacén en Crisis → http://localhost:${PORT}`));
