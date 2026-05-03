// =========================================================
// CONFIG.JS — edita este archivo para personalizar la app
// =========================================================

// 1) USUARIOS DEL LABORATORIO
//    Cualquiera de la lista podrá identificarse en el menú.
//    Edita esta lista cuando entre/salga gente del lab.
export const LAB_USERS = [
  "Isidora Saavedra",
  "Ejemplo 1",
  "Ejemplo 2",
  "Ejemplo 3",
  "Ejemplo 4"
];

// 2) SALAS — 15 salas. Si quieres renombrarlas (e.g. "Cultivo 1",
//    "Microscopía", etc.) cambia los nombres aquí.
export const ROOMS = [
  { id: "S01", name: "Sala 1" },
  { id: "S02", name: "Sala 2" },
  { id: "S03", name: "Sala 3" },
  { id: "S04", name: "Sala 4" },
  { id: "S05", name: "Sala 5" },
  { id: "S06", name: "Sala 6" },
  { id: "S07", name: "Sala 7" },
  { id: "S08", name: "Sala 8" },
  { id: "S09", name: "Sala 9" },
  { id: "S10", name: "Sala 10" },
  { id: "S11", name: "Sala 11" },
  { id: "S12", name: "Sala 12" },
  { id: "S13", name: "Sala 13" },
  { id: "S14", name: "Sala 14" },
  { id: "S15", name: "Sala 15" }
];

// 3) HORARIO — bloques de 30 min de 08:00 a 22:00 todos los días
export const SCHEDULE = {
  startHour: 8,   // 08:00
  endHour: 22,    // último slot termina a las 22:00 -> último inicio 21:30
  slotMinutes: 30
};

// 4) FIREBASE — pega aquí tu config de Firebase Realtime Database
//    Si dejas el placeholder, la app funciona en MODO LOCAL (solo este navegador)
//    y se mostrará un aviso. Ver INSTRUCCIONES.md para configurarlo.
export const FIREBASE_CONFIG = {
  apiKey: "REEMPLAZAR",
  authDomain: "REEMPLAZAR.firebaseapp.com",
  databaseURL: "https://REEMPLAZAR-default-rtdb.firebaseio.com",
  projectId: "REEMPLAZAR",
  storageBucket: "REEMPLAZAR.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId: "REEMPLAZAR"
};
