
  # SmartPick Web Interface Design

  This is a code bundle for SmartPick Web Interface Design. The original project is available at https://www.figma.com/design/kvIj4tZ7DFaF15dglNw1j8/SmartPick-Web-Interface-Design.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  "# SmartPick-frontend" 

## Firebase Hosting Deploy

1. Create a production env file:
   Copy `.env.production.example` to `.env.production` and set:
   `VITE_API_BASE_URL=https://<your-backend-domain>/api`

2. Build:
   `npm run build`

3. Deploy:
   `npm run deploy:firebase`

Notes:
- This project uses React Router. `firebase.json` already includes SPA rewrites to `index.html`.
- Vite `/api` proxy works only in local dev. On Firebase, API URL must come from `VITE_API_BASE_URL`.
