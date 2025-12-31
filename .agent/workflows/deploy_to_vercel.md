---
description: Deploy the Ticket Game Application to Vercel
---
This workflow describes how to deploy the application to Vercel for production hosting.

## Prerequisites
- Ensure you are logged into Vercel in your terminal (`npx vercel login`).
- Ensure all latest code is committed (optional but recommended).

## Deployment Steps

1. Open your terminal in VS Code (`Ctrl` + `~`).

2. Navigate to the app directory:
   ```powershell
   cd c:\2035-HMS\TicketGame\app
   ```

3. Run the deployment command:
   ```powershell
   npx vercel deploy --prod
   ```

4. Follow the interactive prompts (usually you can press ENTER for all defaults):
   - **Set up and deploy?** -> Yes (ENTER)
   - **Scope?** -> (Your username) (ENTER)
   - **Link to existing project?** -> No (ENTER) (Unless you've done this before, then Yes)
   - **Project Name?** -> ticket-game (or whatever you named it) (ENTER)
   - **Directory?** -> ./ (ENTER)
   - **Modify settings?** -> No (ENTER)

5. Wait for the "Production" URL to appear.
   - Example output: `Production: https://ticket-game-example.vercel.app`
   - Use this URL on your mobile phone.

## Troubleshooting
- If the build fails, check if you have installed all dependencies with `npm install`.
- Ensure `.env` file exists with Supabase keys if running locally, but Vercel manages keys via 'Environment Variables' in the dashboard if needed (though our current setup bundles them).
