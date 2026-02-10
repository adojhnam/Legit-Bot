/***********************
 *  BASIC SETUP
 ***********************/
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
  Events,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/***********************
 *  ⭐⭐ THINGS YOU MUST CHANGE ⭐⭐
 ***********************/

// ⭐ ID of the CATEGORY where tickets will be created
const TICKET_CATEGORY_ID = "1414954122918236171";

// ⭐ ID of the channel where ticket logs will be sent
const LOG_CHANNEL_ID = "1470080063792742410";

// ⭐ Guild (Server) ID
const GUILD_ID = "1412911390494036072";

/***********************
 *  BOT READY
 ***********************/
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

/***********************
 *  SLASH COMMANDS REGISTRATION
 ***********************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("ticketpanel") // 🔧 you can change command name
      .setDescription("Open ticket panel"),

    new SlashCommandBuilder()
      .setName("close") // 🔧 change if you want
      .setDescription("Close the current ticket"),

    new SlashCommandBuilder()
      .setName("payment") // 🔧 change if you want
      .setDescription("Show payment methods")
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash commands registered");
}

/***********************
 *  INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  /******** SLASH COMMANDS ********/
  if (interaction.isChatInputCommand()) {

    /* 🎫 TICKET PANEL */
    if (interaction.commandName === "ticketpanel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 Tickets") // 🔧 change title
        .setDescription("Choose the type of ticket you want to open") // 🔧 change text
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel(":buy: Purchase") // 🔧 button name
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_seller")
          .setLabel(":page_facing_up: Seller Application")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("ticket_report")
          .setLabel("🚨 Report Scammer")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    /* ❌ CLOSE TICKET */
    if (interaction.commandName === "close") {
      await interaction.reply("🔒 Closing ticket...");
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 3000);
    }

    /* 💳 PAYMENT METHODS */
    if (interaction.commandName === "payment") {
      const embed = new EmbedBuilder()
        .setTitle("💳 Payment Methods") // 🔧 edit freely
        .setDescription(
          "• :paypal: PayPal" +
          "• :binance: Crypto" +
          "• 🏦 Bank Transfer"
        )
        .setColor("Light Blue");

      return interaction.reply({ embeds: [embed] });
    }
  }

  /******** BUTTONS ********/
  if (interaction.isButton()) {

    /* ❌ CLOSE BUTTON */
    if (interaction.customId === "close_ticket") {
      await interaction.reply({ content: "🔒 Ticket will close in 5 seconds", ephemeral: true });
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }

    /* 🛒 PURCHASE */
    if (interaction.customId === "ticket_buy") {
      const modal = new ModalBuilder()
        .setCustomId("buy_modal")
        .setTitle("🛒 Purchase Ticket");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("product")
            .setLabel("What are you looking to buy ?") // 🔧
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("payment")
            .setLabel("What will you pay with ?") // 🔧
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    /* 💼 SELLER */
    if (interaction.customId === "ticket_seller") {
      const modal = new ModalBuilder()
        .setCustomId("seller_modal")
        .setTitle("💼 Seller Application");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("items")
            .setLabel("Items you are looking to sell ( with price )")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("proof")
            .setLabel("Proofs that you are trusted")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    /* 🚨 REPORT */
    if (interaction.customId === "ticket_report") {
      createTicket(interaction, `🚨-report-${interaction.user.username}`, "Scam Report");
    }
  }

  /******** MODALS ********/
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "buy_modal") {
      const product = interaction.fields.getTextInputValue("product");
      createTicket(
        interaction,
        `🛒-${product}-${interaction.user.username}`,
        "Purchase"
      );
    }

    if (interaction.customId === "seller_modal") {
      createTicket(
        interaction,
        `💼-seller-${interaction.user.username}`,
        "Seller Application"
      );
    }
  }
});

/***********************
 *  CREATE TICKET FUNCTION
 ***********************/
async function createTicket(interaction, name, type) {
  const channel = await interaction.guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] }
    ]
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("❌ Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `🎫 **${type} Ticket**\nUser: ${interaction.user}`,
    components: [closeRow]
  });

  const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    logChannel.send(
      `📑 **New Ticket**\nType: ${type}\nUser: ${interaction.user.tag}\nChannel: ${channel}`
    );
  }

  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

/***********************
 *  LOGIN
 ***********************/
client.login(process.env.TOKEN);



