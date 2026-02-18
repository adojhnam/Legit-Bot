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
 * CONFIG & VARIABLES
 ***********************/
const STOCK_FILE = "stock.json";
let stock = fs.existsSync(STOCK_FILE) ? JSON.parse(fs.readFileSync(STOCK_FILE)) : {};

const GIVEAWAY_FILE = "giveaways.json";
let giveaways = fs.existsSync(GIVEAWAY_FILE)
  ? JSON.parse(fs.readFileSync(GIVEAWAY_FILE))
  : {};

const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

/***********************
 * READY EVENT
 ***********************/
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
  setInterval(checkGiveaways, 5000); // فحص القيف اواي كل 5 ثواني
});

/***********************
 * REGISTER SLASH COMMANDS
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

    // TICKETS
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
      .setDescription("Show all payment methods"),

    // GIVEAWAY
    new SlashCommandBuilder()
      .setName("giveaway-start")
      .setDescription("Start a giveaway")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o =>
        o.setName("duration")
          .setDescription("10m, 1h, 1d")
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
      )
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log("✅ Commands registered");
}

/***********************
 * INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {
  // ================= PAYPAL FEES =================
  if (interaction.isChatInputCommand() && interaction.commandName === "paypal-fees") {
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

  // ================= STOCK SYSTEM =================
  if (interaction.isChatInputCommand() && interaction.commandName === "stock") {
    const item = interaction.options.getString("item");
    const value = interaction.options.getString("value");

    // عرض الستوك
    if (!item) {
      const embed = new EmbedBuilder()
        .setTitle("📦 Store Stock")
        .setColor("Green")
        .setDescription(
          `🟢 Money: ${stock.money || "Out of Stock"}\n🟠 Binance: ${stock.binance || "Out of Stock"}\n🔵 Paypal: ${stock.paypal || "Out of Stock"}\n✨ Gold: ${stock.gold || "Out of Stock"}\n🟥 Redblock: ${stock.redblock || "Out of Stock"}\n🟩 Minecraft: ${stock.minecraft || "Out of Stock"}\n💜 Elytra: ${stock.elytra || "Out of Stock"}\n🎟️ Redeem Code: ${stock.redeem || "Out of Stock"}\n🧥 Capes: ${stock.capes || "Out of Stock"}`
        );
      return interaction.reply({ embeds: [embed] });
    }

    // تعديل الستوك (ادمن فقط)
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });

    stock[item] = value === "0" ? "Out of Stock" : value;
    fs.writeFileSync(STOCK_FILE, JSON.stringify(stock, null, 2));
    return interaction.reply(`✅ Updated ${item} stock.`);
  }

  // ================= TICKET PANEL =================
  if (interaction.isChatInputCommand() && interaction.commandName === "ticketpanel") {
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
        { label: "Purchase", value: "purchase", emoji: { id: "1438808044346675290" } },
        { label: "Seller Application", value: "seller", emoji: "📦" },
        { label: "Report Scammer", value: "report", emoji: "🚨" }
      );

    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ================= PAYMENT INFO =================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "paypal") return interaction.reply(PAYPAL_INFO);
    if (interaction.commandName === "binance") return interaction.reply(BINANCE_INFO);
    if (interaction.commandName === "payment-methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);
  }

  // ================= CLOSE TICKET =================
  if (interaction.isChatInputCommand() && interaction.commandName === "close") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
    return closeTicket(interaction.channel, interaction.user);
  }

  // ================= GIVEAWAY =================
  if (interaction.isChatInputCommand() && interaction.commandName === "giveaway-start") {
    const duration = interaction.options.getString("duration");
    const winners = interaction.options.getInteger("winners");
    const prize = interaction.options.getString("prize");
    const time = ms(duration);
    if (!time) return interaction.reply({ content: "❌ Invalid time", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("🎉 GIVEAWAY 🎉")
      .setDescription(`Prize: **${prize}**\nWinners: **${winners}**\nEnds in: **${duration}**`)
      .setColor("Purple");

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join_giveaway")
        .setLabel("Join")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎉")
    );

    const msg = await interaction.reply({ embeds: [embed], components: [button], fetchReply: true });
    giveaways[msg.id] = { prize, winners, users: [], end: Date.now() + time, channel: interaction.channel.id };
    fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(giveaways, null, 2));
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "giveaway-reroll") {
    const messageId = interaction.options.getString("messageid");
    const data = giveaways[messageId];
    if (!data) return interaction.reply({ content: "❌ Giveaway not found", ephemeral: true });
    const random = data.users[Math.floor(Math.random() * data.users.length)];
    return interaction.reply(`🎉 New winner: <@${random}>`);
  }

  // JOIN BUTTON
  if (interaction.isButton() && interaction.customId === "join_giveaway") {
    const data = giveaways[interaction.message.id];
    if (!data) return;
    if (interaction.user.bot) return interaction.reply({ content: "Bots cannot join.", ephemeral: true });
    if (data.users.includes(interaction.user.id)) return interaction.reply({ content: "You already joined!", ephemeral: true });

    data.users.push(interaction.user.id);
    fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(giveaways, null, 2));
    interaction.reply({ content: "✅ You joined the giveaway!", ephemeral: true });
  }
});

/***********************
 * FUNCTIONS
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

  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [buttons] });
  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

async function closeTicket(channel, closer) {
  const messages = await channel.messages.fetch({ limit: 100 });
  let text = "";
  messages.reverse().forEach(m => { text += `[${m.author.tag}] ${m.content}\n`; });

  const file = `ticket-${channel.id}.txt`;
  fs.writeFileSync(file, text);

  const zip = `ticket-${channel.id}.zip`;
  const output = fs.createWriteStream(zip);
  const archive = archiver("zip");
  archive.pipe(output);
  archive.file(file, { name: file });
  await archive.finalize();

  const log = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) log.send({ embeds: [new EmbedBuilder().setTitle("🎫 Ticket Closed").setDescription(`Closed by ${closer.tag}`).setColor("Red")], files: [zip] });

  setTimeout(() => channel.delete().catch(() => {}), 3000);
}

// ================= CHECK GIVEAWAYS =================
function checkGiveaways() {
  const now = Date.now();
  for (const [id, g] of Object.entries(giveaways)) {
    if (g.end <= now && !g.ended) {
      const channel = client.channels.cache.get(g.channel);
      if (!channel) continue;
      channel.messages.fetch(id).then(msg => {
        const winners = [];
        for (let i = 0; i < g.winners; i++) {
          if (g.users.length === 0) break;
          const random = g.users[Math.floor(Math.random() * g.users.length)];
          winners.push(`<@${random}>`);
        }
        channel.send(`🎉 Winners: ${winners.join(", ")} | Prize: ${g.prize}`);
      });
      g.ended = true;
    }
  }
  fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(giveaways, null, 2));
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);



















