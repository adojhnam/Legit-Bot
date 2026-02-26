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
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/***********************
 * CONFIG
 ***********************/
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";
const ADMIN_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

/***********************
 * GIVEAWAY SETUP
 ***********************/
const DATA_FILE = "giveaways.json";
let giveaways = new Map();
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

function saveGiveaways() {
  const obj = Object.fromEntries([...giveaways].map(([id, g]) => [id, { ...g, users: [...g.users] }]));
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
    else endGiveaway(id);
  }
}

/***********************
 * INVITE SYSTEM
 ***********************/
const INVITE_FILE = "invites.json";
let invitesData = {};
let guildInvites = new Map();
if (!fs.existsSync(INVITE_FILE)) fs.writeFileSync(INVITE_FILE, "{}");
invitesData = JSON.parse(fs.readFileSync(INVITE_FILE));

function saveInvites() {
  fs.writeFileSync(INVITE_FILE, JSON.stringify(invitesData, null, 2));
}

const REWARD_ROLES = { 5: "PUT_ROLE_ID", 10: "PUT_ROLE_ID", 20: "PUT_ROLE_ID" };

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();

  const guild = client.guilds.cache.get(GUILD_ID);
  const invites = await guild.invites.fetch();
  guildInvites.set(guild.id, invites);

  loadGiveaways();
});

/***********************
 * REGISTER COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o => o
        .setName("amount")
        .setDescription("Amount to calculate")
        .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("paypal")
      .setDescription("Show PayPal info"),

    new SlashCommandBuilder()
      .setName("binance")
      .setDescription("Show Binance info"),

    new SlashCommandBuilder()
      .setName("payment-methods")
      .setDescription("Show all payment methods"),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway system")
      .addSubcommand(s => s
        .setName("start")
        .setDescription("Start a giveaway")
        .addStringOption(o => o
          .setName("duration")
          .setDescription("Duration (10m 1h 1d)")
          .setRequired(true)
        )
        .addIntegerOption(o => o
          .setName("winners")
          .setDescription("Number of winners")
          .setRequired(true)
        )
        .addStringOption(o => o
          .setName("prize")
          .setDescription("Prize for the giveaway")
          .setRequired(true)
        )
      )
      .addSubcommand(s => s
        .setName("reroll")
        .setDescription("Reroll a giveaway")
        .addStringOption(o => o
          .setName("message_id")
          .setDescription("Message ID of the giveaway")
          .setRequired(true)
        )
      )
      .addSubcommand(s => s
        .setName("end")
        .setDescription("End a giveaway")
        .addStringOption(o => o
          .setName("message_id")
          .setDescription("Message ID of the giveaway")
          .setRequired(true)
        )
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    // Invite commands
    new SlashCommandBuilder()
      .setName("invites")
      .setDescription("Check invite count")
      .addUserOption(o => o
        .setName("user")
        .setDescription("User to check")
      ),

    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Show top inviters"),

    new SlashCommandBuilder()
      .setName("invite-giveaway")
      .setDescription("Pick winner based on invites")
      .addIntegerOption(o => o
        .setName("invites")
        .setDescription("Required invites")
        .setRequired(true)
      )
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered");
}

/***********************
 * INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand()) {
    // -------------------- PAYPAL / BINANCE --------------------
    if (interaction.commandName === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = (amount * 0.0449) + 0.6;
      const after = amount - fee;
      const send = amount + fee;

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor("#009cde")
          .setTitle("PayPal Fee Calculator")
          .addFields(
            { name: "💰 Original Amount", value: `$${amount.toFixed(2)}`, inline: true },
            { name: "📊 Fee", value: `$${fee.toFixed(2)}`, inline: true },
            { name: "📉 After Fee", value: `$${after.toFixed(2)}`, inline: true },
            { name: "📤 You Send", value: `$${send.toFixed(2)}`, inline: true }
          )
          .setFooter({ text: "PayPal Calculator" })
        ]
      });
    }

    if (interaction.commandName === "paypal") return interaction.reply(PAYPAL_INFO);
    if (interaction.commandName === "binance") return interaction.reply(BINANCE_INFO);
    if (interaction.commandName === "payment-methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    // -------------------- INVITES --------------------
    if (interaction.commandName === "invites") {
      const user = interaction.options.getUser("user") || interaction.user;
      const data = invitesData[user.id] || { invites: 0 };
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor("Blue")
          .setTitle("Invite Counter")
          .setDescription(`👤 ${user}\n🎉 Invites: **${data.invites}**`)
        ]
      });
    }

    if (interaction.commandName === "leaderboard") {
      const sorted = Object.entries(invitesData)
        .sort((a, b) => b[1].invites - a[1].invites)
        .slice(0, 10);
      let text = "";
      sorted.forEach((x, i) => { text += `**${i+1}.** <@${x[0]}> — ${x[1].invites}\n`; });
      return interaction.reply({ content: text || "No data yet" });
    }

    if (interaction.commandName === "invite-giveaway") {
      const needed = interaction.options.getInteger("invites");
      const winners = Object.entries(invitesData).filter(x => x[1].invites >= needed);
      if (!winners.length) return interaction.reply("No winners");
      const winner = winners[Math.floor(Math.random() * winners.length)];
      return interaction.reply(`🎉 Winner: <@${winner[0]}>`);
    }
  }
});

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);


