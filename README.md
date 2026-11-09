# Ticket Bot — Setup Guide

## What this bot does

**Tickets:**
- `/panel` (admin only) posts a "🎫 Open Ticket" button in the channel you run it in.
- Customer clicks the button → a form (modal) pops up asking:
  1. What product do you want to buy?
  2. What will you pay with?
- On submit, a **private ticket channel** is created (visible only to the customer, your staff role, and the bot) showing their answers.
- Staff clicks **"Close Ticket"** → the channel closes, and the customer gets a DM thanking them and asking to rate/vouch.
- Whatever the customer replies with in that DM gets automatically posted into your vouches channel.

**Donation panel:**
- `/donationpanel` (admin only) posts a "💰 Collected Donations" embed in the channel you run it in.
- `/setdonations <value>` (admin only) edits that panel's number/text in place — you can type anything, e.g. `12$`, `$500`, `1.2k raised`.

**Auto-image:**
- `/autoimage enable` (admin only) makes the bot post a fixed image after every single message sent in that channel (or a channel you specify).
- `/autoimage disable` turns it back off for that channel.
- The image used is `assets/auto-image.png` — replace that file with any image to change it (same filename).

## Step 1 — Install Node.js
You need Node.js 18 or newer. Check with:
```
node -v
```
If you don't have it, download it from https://nodejs.org (LTS version).

## Step 2 — Install dependencies
Open a terminal in this folder and run:
```
npm install
```

## Step 3 — Get your bot's info from the Discord Developer Portal
Go to https://discord.com/developers/applications → select your bot application.

- **Token**: Bot tab → "Reset Token" (or copy if you saved it before)
- **Client ID**: General Information tab → "Application ID"

### Enable required intents
Still in the **Bot** tab, scroll to "Privileged Gateway Intents" and turn ON:
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**

(These are required for the DM vouch system to work.)

## Step 4 — Invite the bot to your server (if not already)
Go to OAuth2 → URL Generator:
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Manage Channels`, `Send Messages`, `Embed Links`, `Read Message History`, `View Channels`

Copy the generated URL, open it, and invite the bot to your server.

## Step 5 — Get the other IDs you need
Turn on Developer Mode in Discord: **User Settings → Advanced → Developer Mode**.

Then:
- **Server ID**: right-click your server icon → Copy Server ID
- **Staff role ID**: Server Settings → Roles → right-click your staff role → Copy Role ID
- **Vouches channel ID**: right-click your vouches channel → Copy Channel ID
- **(Optional) Ticket category ID**: right-click a category you want tickets grouped under → Copy Channel ID

## Step 6 — Configure your .env file
Rename `.env.example` to `.env` and fill in all the values you just collected:
```
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_server_id_here
STAFF_ROLE_ID=your_staff_role_id_here
VOUCHES_CHANNEL_ID=your_vouches_channel_id_here
TICKET_CATEGORY_ID=optional_category_id_here
```
⚠️ Never share this file or your token with anyone.

## Step 7 — Register the slash command
Run this once (and again anytime you change commands):
```
npm run deploy
```
You should see `✅ Slash commands registered!`

## Step 8 — Start the bot
```
npm start
```
You should see `✅ Logged in as YourBotName`.

## Step 9 — Try it out
1. In any channel, type `/panel` (you need Administrator permission to use it).
2. Click the "Open Ticket" button that gets posted.
3. Fill out the form → a new private ticket channel should appear.
4. Click "Close Ticket" as a staff member → you should get closed + the customer gets a DM.
5. Reply to that DM as the customer → check your vouches channel for the post.

## Keeping the bot online 24/7
Running `npm start` only keeps the bot online while your terminal/computer is running.
For 24/7 hosting, look into a host like Railway, Render, or a VPS — happy to walk you through deploying to one of those once you're ready.

## Notes / limitations
- Vouch tracking is stored in memory — if the bot restarts between closing a ticket and the customer replying, that pending vouch is lost. Let me know if you want this made permanent (I can add a small database for it).
- The bot identifies "the customer" in a ticket channel as whichever non-staff user has explicit channel access — so don't manually add extra people to ticket channels if you want vouch-tracking to stay accurate.
- The donation panel value and the list of auto-image-enabled channels ARE saved to disk (in `data.json`, created automatically) — these survive a bot restart.
- If you edit `deploy-commands.js` or add new commands in the future, remember to run `npm run deploy` again to register them with Discord.
