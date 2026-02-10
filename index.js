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
 * ⭐ THINGS YOU MUST CHANGE (إذا بدك)
 ***********************/
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> Paypal: Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> Binance ID: 993881216";

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

/***********************
 * REGISTER COMMANDS (Admin Only)
 ***********************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
{
  name: 'payment-methods',
  description: 'Toggle payment methods panel',
  defaultMemberPermissions: PermissionFlagsBits.Administrator
}
    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("paypal")
      .setDescription("Show PayPal")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("binance")
      .setDescription("Show Binance")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

    // Ticket Panel
    if (interaction.commandName === "ticketpanel") {
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

      const row = new ActionRowBuilder().addComponents(menu);
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // PayPal
    if (interaction.commandName === "paypal")
      return interaction.reply(PAYPAL_INFO);

    // Binance
    if (interaction.commandName === "binance")
      return interaction.reply(BINANCE_INFO);

    // Close
    if (interaction.commandName === "close") {
      if (!interaction.channel.name.startsWith("purchase") &&
          !interaction.channel.name.startsWith("seller") &&
          !interaction.channel.name.startsWith("report")) {
        return interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
      }
      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
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
      await createTicket(interaction, "Purchase", [
        `🛒 ${interaction.fields.getTextInputValue("product")}`,
        `💳 ${interaction.fields.getTextInputValue("payment")}`
      ]);
    }

    if (interaction.customId === "seller_modal") {
      await createTicket(interaction, "Seller", [
        interaction.fields.getTextInputValue("items"),
        interaction.fields.getTextInputValue("proof")
      ]);
    }
  }

  /* CLOSE BUTTON */
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

    if (!interaction.channel.name.startsWith("purchase") &&
        !interaction.channel.name.startsWith("seller") &&
        !interaction.channel.name.startsWith("report")) {
      return interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
    }

    await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
    closeTicket(interaction.channel, interaction.user);
  }
});

/***********************
 * CREATE TICKET
 ***********************/
async function createTicket(interaction, type, details) {
  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`.toLowerCase().replace(/ /g, "-"),
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

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [closeBtn] });
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
    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket Closed")
      .setDescription(`Closed by ${closer.tag}`)
      .setColor("Red");

    log.send({ embeds: [embed], files: [zip] });
  }

  setTimeout(() => channel.delete().catch(() => {}), 3000);
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);










