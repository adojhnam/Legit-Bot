// ======================================
// Legit Bot - Optimized + Fixed
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

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

/***********************
 CONFIG
************************/
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

/***********************
 GIVEAWAYS
************************/
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
    const timeLeft = g.endTime - Date.now();
    if (timeLeft > 0) setTimeout(() => endGiveaway(id), timeLeft);
  }
}

/***********************
 READY
************************/
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  loadGiveaways();
});

/***********************
 COMMANDS
************************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
    new SlashCommandBuilder().setName("close").setDescription("Close ticket"),
    new SlashCommandBuilder().setName("paypal").setDescription("Show PayPal"),
    new SlashCommandBuilder().setName("binance").setDescription("Show Binance"),
    new SlashCommandBuilder().setName("payment-methods").setDescription("Methods"),
    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Fees")
      .addNumberOption(o => o.setName("amount").setRequired(true)),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Invite leaderboard"),
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
}

/***********************
 GLOBAL INTERACTION FIX
************************/
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {

      // ⭐ GLOBAL FIX
      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply();

      /******** PAYMENTS ********/
      if (interaction.commandName === "paypal")
        return interaction.editReply(PAYPAL_INFO);

      if (interaction.commandName === "binance")
        return interaction.editReply(BINANCE_INFO);

      if (interaction.commandName === "payment-methods")
        return interaction.editReply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

      if (interaction.commandName === "paypal-fees") {
        const amount = interaction.options.getNumber("amount");
        const fee = amount * 0.0449 + 0.6;
        return interaction.editReply(`Fee: ${fee.toFixed(2)}`);
      }

      /******** TICKET PANEL ********/
      if (interaction.commandName === "ticketpanel") {
        const embed = new EmbedBuilder()
          .setTitle("🎫 Ticket System")
          .setDescription("Choose ticket type");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_purchase")
            .setLabel("Purchase")
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      if (interaction.commandName === "close")
        return closeTicket(interaction.channel, interaction.user);

      /******** LEADERBOARD ********/
      if (interaction.commandName === "leaderboard") {
        const guild = await client.guilds.fetch(GUILD_ID);
        const invites = await guild.invites.fetch();

        const sorted = invites
          .map(i => ({ id: i.inviter?.id, uses: i.uses || 0 }))
          .filter(x => x.id)
          .sort((a, b) => b.uses - a.uses)
          .slice(0, 10);

        const desc = sorted
          .map((x, i) => `${i + 1}. <@${x.id}> - ${x.uses}`)
          .join("\n") || "No data";

        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle("Leaderboard").setDescription(desc)],
        });
      }
    }

    /******** BUTTONS ********/
    if (interaction.isButton()) {

      if (interaction.customId === "ticket_purchase")
        return createTicket(interaction, "Purchase", []);

      if (interaction.customId === "join_giveaway") {
        const g = giveaways.get(interaction.message.id);
        if (!g)
          return interaction.reply({ ephemeral: true, content: "Ended" });

        if (g.users.has(interaction.user.id))
          return interaction.reply({ ephemeral: true, content: "Already joined" });

        g.users.add(interaction.user.id);
        saveGiveaways();
        return interaction.reply({ ephemeral: true, content: "Joined" });
      }
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied)
      interaction.reply({ content: "Error", ephemeral: true });
  }
});

/***********************
 ANTI SPAM + LIMIT
************************/
const openTickets = new Map();

async function createTicket(interaction, type, details) {

  if (openTickets.has(interaction.user.id))
    return interaction.reply({ ephemeral: true, content: "You already have a ticket." });

  openTickets.set(interaction.user.id, true);

  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] },
      { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages"] },
    ],
  });

  await channel.send(`<@${interaction.user.id}>`);
  interaction.reply({ ephemeral: true, content: `Ticket: ${channel}` });
}

/***********************
 CLOSE TICKET
************************/
async function closeTicket(channel, closer) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });

    let text = "";
    messages.reverse().forEach(m => {
      text += `[${m.author.tag}] ${m.content}\n`;
    });

    const file = `ticket-${channel.id}.txt`;
    fs.writeFileSync(file, text);

    const log = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (log)
      log.send({
        embeds: [new EmbedBuilder().setTitle("Ticket closed").setDescription(closer.tag)],
        files: [file],
      });

    openTickets.delete(channel.topic);
    setTimeout(() => channel.delete().catch(() => {}), 3000);

  } catch (err) {
    console.error(err);
  }
}

/***********************/
client.login(process.env.TOKEN);
