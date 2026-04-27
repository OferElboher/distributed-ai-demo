# PRODUCTION_SETUP.md

## Goal
Prepare app for production deployment.

---

## Backend

Use process manager:

```
npm install -g pm2
pm2 start src/app.js
```

---

## Frontend

Build:

```
npm run build
```

Serve via nginx or static server

---

## MongoDB

- Use default port 27017
- Enable authentication

---

## Reverse Proxy (nginx)

- Route /api → backend
- Serve frontend build

---

## Security

- Use .env
- Enable firewall
- Restrict Mongo access

---

## Monitoring

- pm2 logs
- systemctl status mongod

---

## Result

Single domain app:

- frontend + backend integrated

