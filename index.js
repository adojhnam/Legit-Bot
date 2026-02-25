// =============================
// ADVANCED DISCORD STORE BOT
// Fixed Major Issues + Persistent Giveaway + Better Tickets
// =============================

require("dotenv").config();
const fs = require("fs");
const archiver = require("archiver");
const ms = require("ms");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
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
  ],
});

// =============================
// CONFIG
// =============================
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";
const ADMIN_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

// =============================
// DATABASE (JSON FILES)
// =============================

if (!fs.existsSync("./data")) fs.mkdirSync("./data");

const GIVEAWAY_DB = "./data/giveaways.json";

if (!fs.existsSync(GIVEAWAY_DB)) fs.writeFileSync(GIVEAWAY_DB, "{}");

function loadGiveaways() {
  return JSON.parse(fs.readFileSync(GIVEAWAY_DB));
}

function saveGiveaways(data) {
  fs.writeFileSync(GIVEAWAY_DB, JSON.stringify(data, null, 2));
}

// =============================
// READY
// =============================
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();

  // Resume giveaways after restart
  const giveaways = loadGiveaways();

  for (const id in giveaways) {
    const g = giveaways[id];

    const timeLeft = g.endTime - Date.now();

    if (timeLeft <= 0) {
      endGiveaway(id);
    } else {
      setTimeout(() => endGiveaway(id), timeLeft);
    }
  }
});

// =============================
// COMMANDS
// =============================

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close ticket"),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Start giveaway")
      .addStringOption((o) =>
        o.setName("duration").setDescription("1h 30m 2d").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("winners").setDescription("Winners").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("prize").setDescription("Prize").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("reroll")
      .setDescription("Reroll giveaway")
      .addStringOption((o) =>
        o.setName("message_id").setRequired(true)
      ),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );
}

// =============================
// INTERACTIONS
// =============================

client.on(Events.InteractionCreate, async (interaction) => {

  // =============================
  // COMMANDS
  // =============================

  if (interaction.isChatInputCommand()) {

    // Ticket Panel
    if (interaction.commandName === "ticketpanel") {
      const embed = new EmbedBuilder()
        .setTitle("Ticket System")
        .setDescription("Choose ticket type");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("purchase")
          .setLabel("Purchase")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("report")
          .setLabel("Report")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // Close
    if (interaction.commandName === "close") {
      return closeTicket(interaction.channel, interaction.user);
    }

    // Giveaway
    if (interaction.commandName === "giveaway") {
      const duration = interaction.options.getString("duration");
      const winners = interaction.options.getInteger("winners");
      const prize = interaction.options.getString("prize");

      const embed = new EmbedBuilder()
        .setTitle("Giveaway")
        .setDescription(`Prize: ${prize}`)
        .addFields({ name: "Participants", value: "0" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("join")
          .setLabel("Enter")
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      const db = loadGiveaways();

      db[msg.id] = {
        prize,
        winners,
        participants: [],
        endTime: Date.now() + ms(duration),
        channelId: msg.channel.id,
      };

      saveGiveaways(db);

      setTimeout(() => endGiveaway(msg.id), ms(duration));
    }

    // Reroll
    if (interaction.commandName === "reroll") {
      const id = interaction.options.getString("message_id");
      rerollGiveaway(id, interaction);
    }
  }

  // =============================
  // BUTTONS
  // =============================

  if (interaction.isButton()) {

    if (interaction.customId === "purchase") {
      const modal = new ModalBuilder()
        .setCustomId("purchase_modal")
        .setTitle("Purchase");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("product")
            .setLabel("Product")
            .setStyle(TextInputStyle.Short)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "join") {
      const db = loadGiveaways();
      const g = db[interaction.message.id];

      if (!g) return;

      if (!g.participants.includes(interaction.user.id))
        g.participants.push(interaction.user.id);

      saveGiveaways(db);

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .spliceFields(0, 1)
        .addFields({ name: "Participants", value: `${g.participants.length}` });

      await interaction.message.edit({ embeds: [embed] });

      return interaction.reply({ content: "Joined!", ephemeral: true });
    }
  }

  // =============================
  // MODAL
  // =============================

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "purchase_modal") {
      createTicket(interaction, "Purchase", [
        interaction.fields.getTextInputValue("product"),
      ]);
    }
  }
});

// =============================
// CREATE TICKET + LIMIT
// =============================

async function createTicket(interaction, type, details) {

  const existing = interaction.guild.channels.cache.find(
    (c) =>
      c.name.includes(interaction.user.username.toLowerCase()) &&
      c.parentId === TICKET_CATEGORY_ID
  );

  if (existing)
    return interaction.reply({
      content: "You already have a ticket.",
      ephemeral: true,
    });

  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setTitle(type)
    .setDescription(details.join("\n"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [embed],
    components: [row],
  });

  interaction.reply({ content: `Ticket: ${channel}`, ephemeral: true });
}

// =============================
// CLOSE TICKET FULL TRANSCRIPT
// =============================

async function closeTicket(channel, user) {
  let lastId;
  let messages = [];

  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
    if (fetched.size === 0) break;

    messages = messages.concat(Array.from(fetched.values()));
    lastId = fetched.last().id;
  }

  messages.reverse();

  let text = "";

  for (const m of messages) {
    text += `[${m.author.tag}] ${m.content}\n`;
  }

  const file = `ticket-${channel.id}.txt`;
  fs.writeFileSync(file, text);

  const zip = `ticket-${channel.id}.zip`;
  const output = fs.createWriteStream(zip);
  const archive = archiver("zip");

  archive.pipe(output);
  archive.file(file, { name: file });

  await archive.finalize();

  const log = channel.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (log)
    log.send({
      content: `Closed by ${user.tag}`,
      files: [zip],
    });

  setTimeout(() => channel.delete(), 3000);
}

// =============================
// GIVEAWAY
// =============================

async function endGiveaway(id) {
  const db = loadGiveaways();
  const g = db[id];

  if (!g) return;

  const channel = await client.channels.fetch(g.channelId);
  const msg = await channel.messages.fetch(id);

  if (!g.participants.length) {
    await msg.edit({ content: "No participants", components: [] });
  } else {
    const winners = [];

    while (winners.length < Math.min(g.winners, g.participants.length)) {
      const rand =
        g.participants[Math.floor(Math.random() * g.participants.length)];

      if (!winners.includes(rand)) winners.push(rand);
    }

    await msg.edit({
      content: `Winners: ${winners.map((x) => `<@${x}>`).join(", ")}`,
      components: [],
    });
  }

  delete db[id];
  saveGiveaways(db);
}

async function rerollGiveaway(id, interaction) {
  const db = loadGiveaways();
  const g = db[id];

  if (!g)
    return interaction.reply({ content: "Not found", ephemeral: true });

  const winners = [];

  while (winners.length < Math.min(g.winners, g.participants.length)) {
    const rand = g.participants[Math.floor(Math.random() * g.participants.length)];

    if (!winners.includes(rand)) winners.push(rand);
  }

  interaction.reply({
    content: `New winners: ${winners.map((x) => `<@${x}>`).join(", ")}`,
  });
}

client.login(process.env.TOKEN);



