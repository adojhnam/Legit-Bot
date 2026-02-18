require("dotenv").config();
const fs = require("fs");
const archiver = require("archiver");
giveaways = new Map();
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
  StringSelectMenuBuilder
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
const STOCK_FILE = "stock.json";
let stock = fs.existsSync(STOCK_FILE) ? JSON.parse(fs.readFileSync(STOCK_FILE)) : {};
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

/***********************
 * REGISTER COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [

    // PAYPAL FEES
    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o =>
        o.setName("amount")
          .setDescription("Amount")
          .setRequired(true)
      ),

    // STOCK
    new SlashCommandBuilder()
      .setName("stock")
      .setDescription("Manage or view stock")
      .addStringOption(o =>
        o.setName("item")
          .setDescription("Item name")
          .setRequired(false)
      )
      .addStringOption(o =>
        o.setName("value")
          .setDescription("Stock amount")
          .setRequired(false)
      ),

    // TICKET SYSTEM
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("paypal")
      .setDescription("Show PayPal"),

    new SlashCommandBuilder()
      .setName("binance")
      .setDescription("Show Binance"),

    new SlashCommandBuilder()
      .setName("payment-methods")
      .setDescription("Show all payment methods")

  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Commands registered");
}

/***********************
 * INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  /* SLASH COMMANDS */
  if (interaction.isChatInputCommand()) {
    // GIVEAWAY
new SlashCommandBuilder()
  .setName("giveaway-start")
  .setDescription("Start giveaway")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o =>
    o.setName("duration")
      .setDescription("Example: 10m, 1h, 1d")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("winners")
      .setDescription("Number of winners")
      .setRequired(true)
  )
  .addStringOption(o =>
    o.setName("prize")
      .setDescription("Giveaway prize")
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("giveaway-reroll")
  .setDescription("Reroll giveaway")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o =>
    o.setName("messageid")
      .setDescription("Giveaway message ID")
      .setRequired(true)
  ),

// PAYPAL FEES
if (interaction.commandName === "paypal-fees") {
  const amount = interaction.options.getNumber("amount");

  const fee = (amount * 0.044) + 0.30;
  const after = amount - fee;
  const send = amount + fee;

  const embed = new EmbedBuilder()
    .setTitle("💰 PayPal Fees")
    .setColor("Blue")
    .addFields(
      { name: "Original Amount", value: `$${amount.toFixed(2)}`, inline: true },
      { name: "Fee", value: `$${fee.toFixed(2)}`, inline: true },
      { name: "After Fee", value: `$${after.toFixed(2)}`, inline: true },
      { name: "You Should Send", value: `$${send.toFixed(2)}`, inline: true }
    );

  return interaction.reply({ embeds: [embed] });
}
// STOCK SYSTEM
if (interaction.commandName === "stock") {

  const item = interaction.options.getString("item");
  const value = interaction.options.getString("value");

  // عرض الستوك
  if (!item) {
    const embed = new EmbedBuilder()
      .setTitle("📦 Store Stock")
      .setColor("Green")
      .setDescription(
`:1416701478592319649: Money
:1430875529539489932: Binance: ${stock.binance || "Out of Stock"}
:1430875512221339680: Paypal: ${stock.paypal || "Out of Stock"}

:1430838575070580777: BlocksMC
:1416700594428575865: Gold: ${stock.gold || "Out of Stock"}
:1416701001351692328: Redblock: ${stock.redblock || "Out of Stock"}
:1416701567649845289: Sky1Notch: ${stock.sky1notch || "Out of Stock"}

:1438857175811362946: Minecraft
:1416701747619037299: MFA Account: ${stock.mfa || "Out of Stock"}
:1438809585744871485: Redeem Code: ${stock.redeem || "Out of Stock"}

:1472135932500246568: Capes: ${stock.capes || "Out of Stock"}
:1460420556116721718: Elytra: ${stock.elytra || "Out of Stock"}

:1437039237995298888: Laby Coins: ${stock.laby || "Out of Stock"}
:1437039237995298888: Lunar Coins: ${stock.lunar || "Out of Stock"}
:1437039237995298888: Badlion Coins: ${stock.badlion || "Out of Stock"}`
      );

    return interaction.reply({ embeds: [embed] });
  }

  // تعديل الستوك (ادمن فقط)
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
    return interaction.reply({ content: "❌ Admin only.", ephemeral: true });

  if (value === "0") stock[item] = "Out of Stock";
  else stock[item] = value;

  fs.writeFileSync(STOCK_FILE, JSON.stringify(stock, null, 2));

  return interaction.reply(`✅ Updated ${item} stock.`);
}

    // Ticket Panel
    if (interaction.commandName === "ticketpanel") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription("Choose ticket type")
        .setColor("Blue");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select ticket type")
        .addOptions(
          {
            label: "Purchase",
            value: "purchase",
            emoji: { id: "1438808044346675290" }
          },
          {
            label: "Seller Application",
            value: "seller",
            emoji: "📦"
          },
          {
            label: "Report Scammer",
            value: "report",
            emoji: "🚨"
          }
        );

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    // Payment Commands (Public)
    if (interaction.commandName === "paypal")
      return interaction.reply(PAYPAL_INFO);

    if (interaction.commandName === "binance")
      return interaction.reply(BINANCE_INFO);

    if (interaction.commandName === "payment-methods")
      return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    // Close ticket
    if (interaction.commandName === "close") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
 // ================= GIVEAWAY =================

if (interaction.commandName === "giveaway-start") {

  const duration = interaction.options.getString("duration");
  const winners = interaction.options.getInteger("winners");
  const prize = interaction.options.getString("prize");

  const ms = require("ms");

  const time = ms(duration);
  if (!time) return interaction.reply({ content: "Invalid time", ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle("🎉 GIVEAWAY 🎉")
    .setDescription(
      `Prize: **${prize}**\nWinners: **${winners}**\nEnds in: **${duration}**`
    )
    .setColor("Purple");

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("join_giveaway")
      .setLabel("Join")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🎉")
  );

  const msg = await interaction.reply({
    embeds: [embed],
    components: [button],
    fetchReply: true
  });

  giveaways.set(msg.id, {
    prize,
    winners,
    users: [],
    end: Date.now() + time,
    channel: interaction.channel.id
  });

  setTimeout(async () => {
    const data = giveaways.get(msg.id);
    if (!data) return;

    if (data.users.length === 0) {
      interaction.channel.send("No participants.");
      return;
    }

    const winnersList = [];

    for (let i = 0; i < data.winners; i++) {
      const random = data.users[Math.floor(Math.random() * data.users.length)];
      winnersList.push(`<@${random}>`);
    }

    interaction.channel.send(`🎉 Winners: ${winnersList.join(", ")} | Prize: ${data.prize}`);
  }, time);
}


// JOIN BUTTON
if (interaction.isButton() && interaction.customId === "join_giveaway") {

  const data = giveaways.get(interaction.message.id);
  if (!data) return;

  if (interaction.user.bot)
    return interaction.reply({ content: "Bots cannot join.", ephemeral: true });

  if (data.users.includes(interaction.user.id))
    return interaction.reply({ content: "You already joined!", ephemeral: true });

  data.users.push(interaction.user.id);

  interaction.reply({ content: "You joined the giveaway!", ephemeral: true });
}


// REROLL
if (interaction.commandName === "giveaway-reroll") {

  const messageId = interaction.options.getString("messageid");
  const data = giveaways.get(messageId);

  if (!data)
    return interaction.reply({ content: "Giveaway not found", ephemeral: true });

  const random = data.users[Math.floor(Math.random() * data.users.length)];

  interaction.reply(`🎉 New winner: <@${random}>`);
}
 }

  /* SELECT MENU */
  if (interaction.isStringSelectMenu()) {
    const choice = interaction.values[0];

    if (choice === "purchase") {
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

    if (choice === "seller") {
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

    if (choice === "report") {
      return createTicket(interaction, "Report", ["🚨 Scam report"]);
    }
  }

  /* MODALS */
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

  /* BUTTONS */
  if (interaction.isButton()) {

    if (interaction.customId === "payment_methods") {
      return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);
    }

    if (interaction.customId === "close_ticket") {
      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
  }
});

/***********************
 * CREATE TICKET
 ***********************/
async function createTicket(interaction, type, details) {
  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] },
      { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages"] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${type}`)
    .setDescription(details.join("\n\n"))
    .setColor("Green");

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("payment_methods")
      .setLabel("Payment Methods")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [embed],
    components: [buttons]
  });

  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

/***********************
 * CLOSE + LOG
 ***********************/
async function closeTicket(channel, closer) {
  const messages = await channel.messages.fetch({ limit: 100 });
  let text = "";

  messages.reverse().forEach(m => {
    text += `[${m.author.tag}] ${m.content}\n`;
  });

  const file = `ticket-${channel.id}.txt`;
  fs.writeFileSync(file, text);

  const zip = `ticket-${channel.id}.zip`;
  const output = fs.createWriteStream(zip);
  const archive = archiver("zip");

  archive.pipe(output);
  archive.file(file, { name: file });
  await archive.finalize();

  const log = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) {
    log.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎫 Ticket Closed")
          .setDescription(`Closed by ${closer.tag}`)
          .setColor("Red")
      ],
      files: [zip]
    });
  }

  setTimeout(() => channel.delete().catch(() => {}), 3000);
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);



















