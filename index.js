require("dotenv").config();
const fs = require("fs");
const archiver = require("archiver");

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

    /* 💳 PAYMENT COMMANDS (PUBLIC) */
    if (interaction.commandName === "paypal")
      return interaction.reply(PAYPAL_INFO);

    if (interaction.commandName === "binance")
      return interaction.reply(BINANCE_INFO);

    if (interaction.commandName === "payment-methods")
      return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    if (interaction.commandName === "close") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
  }

  /* باقي الكود (Select / Modal / Buttons) زي ما هو */
});

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);

















