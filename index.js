// ======================================
// TICKETS + PAYMENTS + ADVANCED GIVEAWAY
// WITH ANIMATION & AUTO UPDATE
// discord.js v14
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
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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

// GIVEAWAY
const DATA_FILE = "giveaways.json";
let giveaways = new Map();

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

function save() {
  const obj = Object.fromEntries(
    [...giveaways].map(([id, g]) => [id, { ...g, users: [...g.users] }])
  );
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}

function load() {
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
 * READY
 ***********************/
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  load();
});

/***********************
 * COMMANDS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  // --------------------
  // SLASH COMMANDS
  // --------------------
  if (interaction.isChatInputCommand()) {

    // PayPal Fees
    if (interaction.commandName === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = (amount * 0.0449) + 0.6;
      const after = amount - fee;
      const send = amount + fee;

      const embed = new EmbedBuilder()
        .setColor("#009cde")
        .setTitle("PayPal Fee Calculator")
        .addFields(
          { name: "💰 Original Amount", value: `$${amount.toFixed(2)}`, inline: true },
          { name: "📊 Fee", value: `$${fee.toFixed(2)}`, inline: true },
          { name: "📉 After Fee", value: `$${after.toFixed(2)}`, inline: true },
          { name: "📤 You Send", value: `$${send.toFixed(2)}`, inline: true }
        )
        .setFooter({ text: "PayPal Calculator" });

      return interaction.reply({ embeds: [embed] });
    }

    // Ticket Panel
    if (interaction.commandName === "ticketpanel") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription("Choose ticket type")
        .setColor("Blue");

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_purchase")
          .setLabel("Purchase")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🛒"),
        new ButtonBuilder()
          .setCustomId("ticket_seller")
          .setLabel("Seller Application")
          .setStyle(ButtonStyle.Success)
          .setEmoji("📦"),
        new ButtonBuilder()
          .setCustomId("ticket_report")
          .setLabel("Report Scammer")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🚨")
      );

      return interaction.reply({ embeds: [embed], components: [buttons] });
    }

    // Payment Commands
    if (interaction.commandName === "paypal")
      return interaction.reply(PAYPAL_INFO);

    if (interaction.commandName === "binance")
      return interaction.reply(BINANCE_INFO);

    if (interaction.commandName === "payment-methods")
      return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    // Close Ticket
    if (interaction.commandName === "close") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
  }

  // --------------------
  // BUTTONS
  // --------------------
  if (interaction.isButton()) {

    if (interaction.customId === "ticket_purchase") {
      const modal = new ModalBuilder()
        .setCustomId("purchase_modal")
        .setTitle("Purchase");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("product")
            .setLabel("Product")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("payment")
            .setLabel("Payment method")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "ticket_seller") {
      const modal = new ModalBuilder()
        .setCustomId("seller_modal")
        .setTitle("Seller Application");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("items")
            .setLabel("Items & prices")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("proof")
            .setLabel("Why should we trust you?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "ticket_report") {
      return createTicket(interaction, "Report", ["🚨 Scam report"]);
    }

    if (interaction.customId === "payment_methods")
      return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    if (interaction.customId === "close_ticket") {
      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
  }

  // --------------------
  // MODAL SUBMIT
  // --------------------
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "purchase_modal") {
      return createTicket(interaction, "Purchase", [
        `🛒 **Product:** ${interaction.fields.getTextInputValue("product")}`,
        `💳 **Payment:** ${interaction.fields.getTextInputValue("payment")}`
      ]);
    }

    if (interaction.customId === "seller_modal") {
      return createTicket(interaction, "Seller", [
        interaction.fields.getTextInputValue("items"),
        interaction.fields.getTextInputValue("proof")
      ]);
    }
  }

    // GIVEAWAY
    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway system")

      .addSubcommand(s =>
        s.setName("start")
          .setDescription("Start giveaway")
          .addStringOption(o => o.setName("duration").setDescription("10m 1h").setRequired(true))
          .addIntegerOption(o => o.setName("winners").setDescription("Winners").setRequired(true))
          .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
      )

      .addSubcommand(s =>
        s.setName("reroll")
          .setDescription("Reroll")
          .addStringOption(o => o.setName("message_id").setRequired(true).setDescription("ID"))
      )

      .addSubcommand(s =>
        s.setName("end")
          .setDescription("End")
          .addStringOption(o => o.setName("message_id").setRequired(true).setDescription("ID"))
      )

      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });

  console.log("✅ Commands registered");
}

/***********************
 * INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand()) {

    // PAYPAL
    if (interaction.commandName === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = (amount * 0.0449) + 0.6;

      const embed = new EmbedBuilder()
        .setColor("#009cde")
        .setTitle("PayPal Fee Calculator")
        .addFields(
          { name: "Original", value: `$${amount.toFixed(2)}`, inline: true },
          { name: "Fee", value: `$${fee.toFixed(2)}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "paypal") return interaction.reply(PAYPAL_INFO);
    if (interaction.commandName === "binance") return interaction.reply(BINANCE_INFO);
    if (interaction.commandName === "payment-methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    // GIVEAWAY
    if (interaction.commandName === "giveaway") {
      const sub = interaction.options.getSubcommand();

      if (sub === "start") {

        const duration = interaction.options.getString("duration");
        const winners = interaction.options.getInteger("winners");
        const prize = interaction.options.getString("prize");

        const endTime = Date.now() + ms(duration);

        const embed = buildEmbed(prize, winners, endTime, 0);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("join_giveaway")
            .setLabel("Join Giveaway")
            .setStyle(ButtonStyle.Success)
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        giveaways.set(msg.id, {
          prize,
          winners,
          endTime,
          users: new Set(),
          channelId: msg.channel.id
        });

        save();
        scheduleUpdate(msg.id);

        setTimeout(() => endGiveaway(msg.id), ms(duration));
      }

      if (sub === "reroll") {
        return rerollGiveaway(interaction.options.getString("message_id"), interaction);
      }

      if (sub === "end") {
        await endGiveaway(interaction.options.getString("message_id"));
        return interaction.reply({ ephemeral: true, content: "Ended" });
      }
    }
  }

  // BUTTON
  if (interaction.isButton()) {

    if (interaction.customId === "join_giveaway") {
      const g = giveaways.get(interaction.message.id);

      if (!g) return interaction.reply({ ephemeral: true, content: "Ended" });

      if (g.users.has(interaction.user.id))
        return interaction.reply({ ephemeral: true, content: "Already joined" });

      g.users.add(interaction.user.id);

      const embed = buildEmbed(g.prize, g.winners, g.endTime, g.users.size);
      await interaction.message.edit({ embeds: [embed] });

      save();

      return interaction.reply({ ephemeral: true, content: "Joined" });
    }
  }
});

/***********************
 * EMBED + ANIMATION
 ***********************/
function buildEmbed(prize, winners, endTime, count) {
  return new EmbedBuilder()
    .setColor("#0d0d0d")
    .setTitle("🎉 DARK GIVEAWAY 🎉")
    .setDescription(
`✨ Prize: **${prize}**
🏆 Winners: **${winners}**
👥 Participants: **${count}**
⏳ Ends: <t:${Math.floor(endTime/1000)}:R>

🔥 Click the button below to enter!`
    );
}

function scheduleUpdate(id) {
  setInterval(async () => {
    const g = giveaways.get(id);
    if (!g) return;

    try {
      const channel = await client.channels.fetch(g.channelId);
      const msg = await channel.messages.fetch(id);

      const embed = buildEmbed(g.prize, g.winners, g.endTime, g.users.size);
      msg.edit({ embeds: [embed] });

    } catch {}

  }, 60000);
}

/***********************
 * END
 ***********************/
async function endGiveaway(id) {
  const g = giveaways.get(id);
  if (!g) return;

  giveaways.delete(id);
  save();

  const channel = await client.channels.fetch(g.channelId);
  const msg = await channel.messages.fetch(id);

  if (!g.users.size)
    return msg.edit({ content: "No participants", embeds: [], components: [] });

  const entries = [...g.users];
  const winners = [];

  while (winners.length < Math.min(g.winners, entries.length)) {
    const rand = entries[Math.floor(Math.random() * entries.length)];
    if (!winners.includes(rand)) winners.push(rand);
  }

  const text = winners.map(x => `<@${x}>`).join(", ");

  await msg.edit({ content: `🎉 Winners: ${text}`, embeds: [], components: [] });

  channel.send(`🎉 Congratulations ${text}! You won **${g.prize}**`);

  for (const id of winners) {
    const member = await channel.guild.members.fetch(id).catch(()=>null);
    if (member) member.send(`🎉 You won **${g.prize}** in ${channel.guild.name}!`).catch(()=>{});
  }
}

/***********************
 * REROLL
 ***********************/
async function rerollGiveaway(id, interaction) {
  const g = giveaways.get(id);

  if (!g) return interaction.reply({ ephemeral: true, content: "Not found" });

  const entries = [...g.users];

  const winners = [];

  while (winners.length < Math.min(g.winners, entries.length)) {
    const rand = entries[Math.floor(Math.random() * entries.length)];
    if (!winners.includes(rand)) winners.push(rand);
  }

  interaction.reply({ content: `New winners: ${winners.map(x=>`<@${x}>`).join(", ")}` });
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);

