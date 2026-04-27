# ENV_CONFIGURATION.md

## Purpose
Centralize configuration (ports, DB URL, secrets).

---

## Example .env

```
PORT=3000
MONGO_URI=mongodb://localhost:27018/triage
```

---

## Backend usage

Use dotenv:

```javascript
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);
```

---

## React usage

```
REACT_APP_API_URL=http://localhost:3000
```

---

## Notes

- Never hardcode ports
- Keep .env out of git

