# FRONTEND_BACKEND_INTEGRATION.md

## Goal
Connect React frontend to Node backend API.

---

## Step 1 — API call example

```javascript
fetch("http://localhost:3000/health")
  .then(res => res.json())
```

---

## Step 2 — Use env variable

```javascript
fetch(`${process.env.REACT_APP_API_URL}/health`)
```

---

## Step 3 — Handle CORS (backend)

Install:

```
npm install cors
```

Use:

```javascript
const cors = require('cors');
app.use(cors());
```

---

## Step 4 — Verify

- Open browser
- Check Network tab
- Ensure 200 response

---

## Common Issues

- CORS blocked
- Wrong port
- Backend not running

