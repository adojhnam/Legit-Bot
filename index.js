require("dotenv").config();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
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
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";

const VOUCH_CHANNEL_ID = "1414703045698256936"; // ✅ جاهز

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

const ratedUsers = new Set();

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

/***********************
 * COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o =>
        o.setName("amount").setDescription("Amount").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
}

/***********************
 * INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  /* ===== SELECT MENU ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const choice = interaction.values[0];

    let details;

    if (choice === "purchase") {
      details = [
        "🛒 Please provide:",
        "• Product",
        "• Quantity",
        "• Payment method"
      ];
    }

    if (choice === "seller") {
      details = [
        "📦 Seller Application:",
        "• What do you sell?",
        "• Prices",
        "• Proof"
      ];
    }

    if (choice === "report") {
      details = [
        "🚨 Report Scammer:",
        "• Scammer ID",
        "• Proof",
        "• Details"
      ];
    }

    await createTicket(interaction, choice, details);

    // ⭐ إعادة القائمة حتى يقدر يفتح تذكرة ثانية
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select ticket")
      .addOptions(
        { label: "Purchase", value: "purchase", emoji: { id: "1438808044346675290" } },
        { label: "Seller Application", value: "seller", emoji: "📦" },
        { label: "Report Scammer", value: "report", emoji: "🚨" }
      );

    return interaction.message.edit({
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ===== BUTTONS ===== */
  if (interaction.isButton()) {

    if (interaction.customId.startsWith("rate_")) {
      if (ratedUsers.has(interaction.user.id))
        return interaction.reply({ content: "You already rated.", ephemeral: true });

      const stars = interaction.customId.split("_")[1];
      ratedUsers.add(interaction.user.id);

      const vouchChannel = interaction.guild.channels.cache.get(VOUCH_CHANNEL_ID);
      if (!vouchChannel) return;

      const embed = new EmbedBuilder()
        .setTitle("⭐ New Customer Review")
        .setColor("Gold")
        .addFields(
          { name: "Customer", value: `<@${interaction.user.id}>` },
          { name: "Rating", value: "⭐".repeat(stars) }
        )
        .setTimestamp();

      vouchChannel.send({ embeds: [embed] });

      return interaction.reply({ content: "Thanks ❤️", ephemeral: true });
    }

    if (interaction.customId === "payment_methods") {
      return interaction.reply({
        content: `${PAYPAL_INFO}\n${BINANCE_INFO}`,
        ephemeral: true
      });
    }

    if (interaction.customId === "close_ticket") {
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      await interaction.reply({ content: "🔒 Closing...", ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rate_1").setLabel("⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rate_2").setLabel("⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rate_3").setLabel("⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rate_4").setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rate_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success)
      );

      const embed = new EmbedBuilder()
        .setTitle("⭐ Rate Your Experience")
        .setDescription("Or leave manual vouch in vouches channel.")
        .setColor("Blue");

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      const log = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (log) log.send(`Ticket closed by ${interaction.user.tag}`);

      setTimeout(() => interaction.channel.delete().catch(() => {}), 15000);
    }
  }

  /* ===== PAYPAL ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "paypal-fees") {
    const amount = interaction.options.getNumber("amount");

    const fee = (amount * 0.044) + 0.6; // ✅ التعديل
    const after = amount - fee;

    return interaction.reply(`Fee: $${fee.toFixed(2)} | After: $${after.toFixed(2)}`);
  }

  /* ===== PANEL ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket System")
      .setDescription("Choose ticket type")
      .setColor("Blue");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select ticket")
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

  await channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [embed],
    components: [buttons]
  });

  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);





















