# Auth Demo (Registration, Login, Roles, Email Verification)

Quick local demo using Node.js + Express. Features:
- Registration with role selection (Customer, Owner, Admin)
- Password hashing with bcryptjs
- Email verification (nodemailer ethereal preview)
- JWT-based login and role-based protected endpoint

Run locally:

```powershell
cd "c:\Users\MUSKAN COMPUTERS\Desktop\Project"
npm install
npm start
```

Open `http://localhost:3000/register.html` to create an account. After registering, you'll receive a preview link to open the verification email (ethereal) — click it or open the verification link. Then log in at `/login.html`.

React client (development):

1. Open a separate terminal and run the client dev server:

```powershell
cd "c:\Users\MUSKAN COMPUTERS\Desktop\Project\client"
npm install
npm run dev
```

2. The Vite dev server will host the React SPA (default port 5173). The SPA proxies requests to the backend when you run both servers locally.
