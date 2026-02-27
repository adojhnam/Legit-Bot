// ======================================
// Legit Bot - FULL MERGED VERSION
// ======================================

require("dotenv").config();
const fs = require("fs");
const archiver = require("archiver");
const ms = require("ms");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});


// =====================
// CONFIG
// =====================
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";


// =====================
// GIVEAWAYS
// =====================
const DATA_FILE = "giveaways.json";
let giveaways = new Map();
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

function saveGiveaways() {
  const obj = Object.fromEntries(
    [...giveaways].map(([id, g]) => [id, { ...g, users: [...g.users] }])
  );
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}

function loadGiveaways() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  for (const id in data) {
    const g = data[id];
    g.users = new Set(g.users);
    giveaways.set(id, g);
    scheduleUpdate(id);
    const timeLeft = g.endTime - Date.now();
    if (timeLeft > 0) setTimeout(() => endGiveaway(id), timeLeft);
  }
}


// =====================
// INVITES + REJOIN (JSON)
// =====================
const INVITE_FILE = "invites.json";
let inviteData = {};

if (!fs.existsSync(INVITE_FILE)) fs.writeFileSync(INVITE_FILE, "{}");
inviteData = JSON.parse(fs.readFileSync(INVITE_FILE));

function saveInvites() {
  fs.writeFileSync(INVITE_FILE, JSON.stringify(inviteData, null, 2));
}


// cache
let inviteCache = new Map();

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const invites = await guild.invites.fetch();
  inviteCache.set(GUILD_ID, new Map(invites.map(i => [i.code, i.uses])));

  await registerCommands();
  loadGiveaways();
});


// detect join
client.on(Events.GuildMemberAdd, async member => {
  const guild = member.guild;

  const newInvites = await guild.invites.fetch();
  const oldInvites = inviteCache.get(guild.id);

  const used = newInvites.find(i => oldInvites.get(i.code) < i.uses);

  inviteCache.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));

  if (!inviteData[guild.id]) inviteData[guild.id] = {};
  const g = inviteData[guild.id];

  // rejoin
  if (g[member.id] && g[member.id].left) {
    g[member.id].rejoin++;
    g[member.id].left = false;
    saveInvites();
    return;
  }

  if (used && used.inviter) {
    const id = used.inviter.id;
    if (!g[id]) g[id] = { regular: 0, rejoin: 0, left: false };
    g[id].regular++;
    saveInvites();
  }
});


// detect leave
client.on(Events.GuildMemberRemove, member => {
  const guildId = member.guild.id;
  if (!inviteData[guildId]) inviteData[guildId] = {};
  if (!inviteData[guildId][member.id])
    inviteData[guildId][member.id] = { regular: 0, rejoin: 0 };

  inviteData[guildId][member.id].left = true;
  saveInvites();
});


// =====================
// COMMANDS
// =====================
async function registerCommands() {
  const commands = [

    new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
    new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

    new SlashCommandBuilder().setName("paypal"),
    new SlashCommandBuilder().setName("binance"),
    new SlashCommandBuilder().setName("payment-methods"),

    new SlashCommandBuilder()
      .setName("paypal-fees")
      .addNumberOption(o => o.setName("amount").setRequired(true)),

    new SlashCommandBuilder()
      .setName("giveaway")
      .addSubcommand(s =>
        s.setName("start")
          .addStringOption(o => o.setName("duration").setRequired(true))
          .addIntegerOption(o => o.setName("winners").setRequired(true))
          .addStringOption(o => o.setName("prize").setRequired(true)))
      .addSubcommand(s =>
        s.setName("reroll").addStringOption(o => o.setName("message_id").setRequired(true)))
      .addSubcommand(s =>
        s.setName("end").addStringOption(o => o.setName("message_id").setRequired(true))),

    new SlashCommandBuilder().setName("leaderboard"),

    new SlashCommandBuilder()
      .setName("invites")
      .addUserOption(o => o.setName("user").setRequired(true)),

    new SlashCommandBuilder().setName("reset-invites"),

  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
}


// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;

  // invites user
  if (interaction.commandName === "invites") {
    const user = interaction.options.getUser("user");
    const data = inviteData[guildId]?.[user.id] || { regular: 0, rejoin: 0 };

    return interaction.reply({
      content:
        `📊 **${user.tag}**\nRegular: ${data.regular}\nRejoin: ${data.rejoin}`,
      ephemeral: true
    });
  }

  // reset
  if (interaction.commandName === "reset-invites") {
    inviteData[guildId] = {};
    saveInvites();
    return interaction.reply({ content: "Done", ephemeral: true });
  }

  // leaderboard (بدون rejoin)
  if (interaction.commandName === "leaderboard") {
    const g = inviteData[guildId] || {};

    const sorted = Object.entries(g)
      .sort((a, b) => b[1].regular - a[1].regular);

    const desc = sorted
      .slice(0, 10)
      .map((x, i) => `${i + 1}. <@${x[0]}> - ${x[1].regular}`)
      .join("\n") || "No data";

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Leaderboard").setDescription(desc)]
    });
  }
});


// =====================
// GIVEAWAY SYSTEM
// =====================
function buildGiveawayEmbed(prize, winners, endTime, count) {
  return new EmbedBuilder()
    .setTitle("🎉 Giveaway")
    .setDescription(
      `Prize: **${prize}**
Winners: **${winners}**
Participants: **${count}**
Ends: <t:${Math.floor(endTime / 1000)}:R>`
    );
}

function scheduleUpdate(id) {
  setInterval(async () => {
    const g = giveaways.get(id);
    if (!g) return;
    const ch = await client.channels.fetch(g.channelId);
    const msg = await ch.messages.fetch(id);
    msg.edit({ embeds: [buildGiveawayEmbed(g.prize, g.winners, g.endTime, g.users.size)] });
  }, 60000);
}

async function endGiveaway(id) {
  const g = giveaways.get(id);
  if (!g) return;

  const channel = await client.channels.fetch(g.channelId);
  const msg = await channel.messages.fetch(id);

  if (!g.users.size)
    return msg.edit({ content: "No participants", embeds: [], components: [] });

  const arr = [...g.users];
  const win = arr[Math.floor(Math.random() * arr.length)];

  msg.edit({ content: `Winner: <@${win}>`, embeds: [], components: [] });
}


// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);








