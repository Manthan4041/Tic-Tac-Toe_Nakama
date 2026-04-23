# Tic-Tac-Toe Multiplayer Deployment Guide

To host your multiplayer Tic-Tac-Toe game publicly, you'll need to deploy two separate parts: your **Frontend (React)** and your **Backend (Nakama + Database)**. 

Because Nakama handles real-time WebSocket connections and authoritative server logic, it requires a robust backend environment. The client, however, is simply a static website that runs in the user's browser.

Here is a step-by-step guide to deploying both for free (or very cheap) using **Render** (for the backend) and **Vercel** (for the frontend).

---

## Step 1: Prepare your code for GitHub
Both platforms will automatically pull your code from a GitHub repository. 
1. Create a free account on [GitHub](https://github.com/).
2. Push your entire `tic-tac-toe` project folder to a new, private GitHub repository.

## Step 2: Set up the Database (Render)
Nakama needs a database to save users and leaderboards. 
1. Create a free account on [Render](https://render.com/).
2. Click **New +** and select **PostgreSQL** (Nakama works perfectly with Postgres instead of CockroachDB).
3. Name it `tic-tac-toe-db`, select the Free tier, and click **Create Database**.
4. Once created, look for the **Internal Database URL** and copy it.

## Step 3: Deploy the Nakama Backend (Render)
1. In Render, click **New +** and select **Web Service**.
2. Connect your GitHub account and select your `tic-tac-toe` repository.
3. Scroll down and fill out the configuration:
   * **Root Directory:** `nakama` (This tells Render to only look at the backend code)
   * **Environment:** `Docker`
   * **Region:** Pick the one closest to you (same as your database)
4. Scroll down to **Environment Variables** and add the following:
   * Key: `DB_URL` | Value: Paste the **Internal Database URL** you copied from step 2.
5. You need to tell Nakama to use Postgres instead of CockroachDB. In your `nakama/local.yml` file, or via an environment variable, ensure the database driver is set to `postgres`. 
   * Add Environment Variable: Key: `NAKAMA_DATABASE_ADDRESS` | Value: Paste the **Internal Database URL** again.
6. Click **Create Web Service**. 
7. Once deployed, Render will give you a public URL (e.g., `https://tic-tac-toe-backend.onrender.com`). **Save this URL**.

## Step 4: Update your Frontend to point to the new server
Right now, your React app is hardcoded to connect to `localhost` (your personal computer). You need to point it to your new Render server.
1. Open `client/src/nakama.js`.
2. Find the connection config at the top:
```javascript
// Change this to point to your new Render URL
const NAKAMA_HOST = 'tic-tac-toe-backend.onrender.com'; // Do NOT include https://
const NAKAMA_PORT = '443'; // 443 is the default port for secure web traffic
const NAKAMA_USE_SSL = true; // Must be true for public servers
const NAKAMA_SERVER_KEY = 'defaultkey'; // Make sure this matches your server config
```
3. Commit and push this change to your GitHub repository.

## Step 5: Deploy the Frontend (Vercel)
Now we host the React app so players can open it in their browser.
1. Create a free account on [Vercel](https://vercel.com/).
2. Click **Add New...** -> **Project**.
3. Import your `tic-tac-toe` GitHub repository.
4. When configuring the project:
   * **Framework Preset:** Select `Vite` (or `Create React App`, depending on what you used).
   * **Root Directory:** Click Edit and select the `client` folder.
5. Click **Deploy**. 
6. Vercel will build your React app and give you a public URL (e.g., `https://tic-tac-toe.vercel.app`).

## You're Done!
You can now share your Vercel URL with anyone in the world. When they open it, their browser downloads the React app, which then securely connects to your Nakama server on Render to play real-time multiplayer games.
