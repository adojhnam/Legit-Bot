require("dotenv").config();

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
  Events
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ========== /ticketpanel ========== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ticketpanel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Support Tickets")
      .setDescription("Choose the type of ticket you want to open")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_buy")
        .setLabel("🛒 Purchase")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("ticket_seller")
        .setLabel("💼 Seller Application")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("ticket_report")
        .setLabel("🚨 Report Scammer")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
});

/* ========== BUTTONS ========== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  /* PURCHASE */
  if (interaction.customId === "ticket_buy") {
    const modal = new ModalBuilder()
      .setCustomId("buy_modal")
      .setTitle("🛒 Purchase Request");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("product")
          .setLabel("Product name")
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

  /* SELLER */
  if (interaction.customId === "ticket_seller") {
    const modal = new ModalBuilder()
      .setCustomId("seller_modal")
      .setTitle("💼 Seller Application");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("items")
          .setLabel("Items & Prices")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("proof")
          .setLabel("Why are you trusted?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* REPORT */
  if (interaction.customId === "ticket_report") {
    const channel = await interaction.guild.channels.create({
      name: `🚨-report-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
});

/* ========== MODALS ========== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;

  /* PURCHASE MODAL */
  if (interaction.customId === "buy_modal") {
    const product = interaction.fields.getTextInputValue("product");
    const payment = interaction.fields.getTextInputValue("payment");

    const channel = await interaction.guild.channels.create({
      name: `🛒-${product}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    await channel.send(`🛒 **Product:** ${product}\n💳 **Payment:** ${payment}`);
    return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }

  /* SELLER MODAL */
  if (interaction.customId === "seller_modal") {
    const channel = await interaction.guild.channels.create({
      name: `💼-seller-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);
