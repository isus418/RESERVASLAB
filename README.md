# Reservas Lab

Aplicación web para reservar salas del laboratorio en bloques de 30 min, de **lunes a domingo, 08:00 a 22:00**, para **15 salas**, con vista personal de "mis reservas".

Hecha en HTML + CSS + JS puro (sin build step). Las reservas se guardan en **Firebase Realtime Database** y se sincronizan en tiempo real entre todos los usuarios.

---

## 1) Subir a GitHub Pages

1. Crea un repositorio en GitHub (público o privado, da igual para Pages).
2. Sube los 5 archivos de esta carpeta al repo: `index.html`, `styles.css`, `config.js`, `app.js`, `README.md`.
3. En el repo: **Settings → Pages → Source: Deploy from a branch → main / root → Save**.
4. Espera ~1 minuto. La URL será: `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`

> **Importante**: la app usa `import` ES modules. Tiene que servirse desde `https://` (GitHub Pages lo hace) o desde un servidor local. Abrir `index.html` con doble click **no funciona** (el navegador bloquea los módulos por CORS).

---

## 2) Configurar Firebase (para reservas compartidas)

Sin Firebase la app funciona en **modo local** (cada navegador ve sus propias reservas y un aviso "modo local" aparece arriba a la derecha). Para que todo el lab vea las mismas reservas, sigue estos pasos. Es gratis para este uso.

### 2.1 Crear proyecto

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta Google.
2. **Add project** → ponle un nombre (ej. `reservas-lab`) → desactiva Google Analytics → **Create**.

### 2.2 Crear la base de datos

1. En el menú izquierdo: **Build → Realtime Database** (NO "Firestore", es otra cosa).
2. **Create Database** → elige la región más cercana (ej. `us-central1` o `europe-west1`).
3. Cuando pregunte por reglas: elige **Start in test mode** por ahora (lo cambiamos en el paso 2.4).

### 2.3 Conectar la app web

1. En el menú izquierdo, ve a **Project settings** (engranaje arriba a la izquierda).
2. Baja hasta **Your apps** → click en el icono **`</>`** (Web).
3. Pon un nickname (ej. `reservas-lab-web`) → **Register app** → **Continue to console**.
4. Te muestra un objeto `firebaseConfig` con `apiKey`, `authDomain`, `databaseURL`, etc. Cópialo entero.
5. Abre `config.js` y **reemplaza** el bloque `FIREBASE_CONFIG` con el tuyo. Debe quedar algo así:

```js
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyABC...",
  authDomain: "reservas-lab.firebaseapp.com",
  databaseURL: "https://reservas-lab-default-rtdb.firebaseio.com",
  projectId: "reservas-lab",
  storageBucket: "reservas-lab.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

> Si el campo `databaseURL` no aparece en el objeto que te dio Firebase, sácalo de Realtime Database → la URL que ves arriba (algo como `https://reservas-lab-default-rtdb.firebaseio.com`).

### 2.4 Reglas de seguridad

Las reglas en "test mode" caducan en 30 días y dejan a cualquiera escribir en tu DB. Cámbialas. En **Realtime Database → Rules**, pega esto:

```json
{
  "rules": {
    "reservations": {
      ".read": true,
      "$date": {
        "$slot": {
          ".write": "!data.exists() || newData.val() === null",
          ".validate": "newData.hasChildren(['user','ts']) && newData.child('user').isString() && newData.child('user').val().length < 80 && newData.child('ts').isNumber()"
        }
      }
    }
  }
}
```

Qué hacen estas reglas:

- **Lectura abierta**: cualquiera con la URL puede ver el calendario. Es lo que quieres para un lab pequeño.
- **Una reserva no puede pisar otra**: solo se puede escribir un slot si está vacío (anti-colisión real, no solo del lado del cliente).
- **Solo se puede borrar** quien sea (cualquiera del lab puede liberar). Si quieres que solo el dueño pueda liberar, hace falta autenticación real (login con Google), no es lo que pediste.

> **Si quieres más seguridad** (que solo gente con cuenta Google del lab pueda escribir), hay que añadir Firebase Auth. Te lo puedo agregar después.

### 2.5 Restringir el dominio

En **Project settings → General → Your apps**, no hay restricción de dominio para Realtime Database por defecto, pero puedes restringir tu **API key** desde [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials):

1. Click en tu API key.
2. **Application restrictions → HTTP referrers**.
3. Agrega: `https://TU-USUARIO.github.io/*` y `http://localhost:*` (para pruebas).

Esto evita que alguien que vea tu API key (es pública en `config.js`) la use desde otro sitio.

---

## 3) Editar la lista del lab

Abre `config.js` y edita el array `LAB_USERS`:

```js
export const LAB_USERS = [
  "Isidora Saavedra",
  "Profe Fulano",
  "Mengana Ramírez",
  // ...
];
```

Si renombras las salas (ej. "Cultivo 1", "Microscopía"), edita `ROOMS` en el mismo archivo. **No cambies los `id`** (`S01`...`S15`) si ya hay reservas guardadas, porque las reservas existentes apuntan a esos IDs.

---

## 4) Probar localmente

Si quieres probar antes de subir a GitHub Pages, en la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

---

## 5) Características

- **Grid de 15 salas × 28 bloques de 30 min** (08:00–22:00).
- Navegación por días (← →, picker de fecha, botón "Hoy").
- **Tu nombre se recuerda** en el navegador para no tener que reseleccionarlo.
- **Modal de confirmación** antes de reservar/liberar.
- **Drawer "Mis reservas"**: agrupa tus bloques por día, separa próximas de pasadas, permite liberar desde ahí.
- **Bloques pasados** se muestran rayados y no se pueden reservar.
- **Anti-colisión**: si dos personas tocan el mismo bloque a la vez, solo gana la primera (lo garantiza la regla `!data.exists()` de Firebase).
- **Tiempo real**: si alguien reserva, ves el cambio sin recargar.

---

## 6) Limitaciones conocidas

- No hay autenticación real: cualquiera puede elegir cualquier nombre del menú. Si esto es un problema, pide login con Google y lo agregamos.
- No hay límite de reservas por persona ni por día. Se puede agregar fácil si lo necesitas.
- No hay reservas recurrentes (ej. "todos los martes a las 10"). También se puede agregar.
