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

let giveaways = new Map();

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
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
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o =>
        o.setName("amount")
          .setDescription("Amount")
          .setRequired(true)
      ),

    new SlashCommandBuilder().setName("paypal").setDescription("Show PayPal"),
    new SlashCommandBuilder().setName("binance").setDescription("Show Binance"),
    new SlashCommandBuilder().setName("payment-methods").setDescription("Show all payment methods"),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Start a giveaway")
      .addStringOption(opt =>
        opt.setName("duration")
          .setDescription("1h, 30m, 2d")
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName("winners")
          .setDescription("Number of winners")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName("prize")
          .setDescription("Prize description")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("giveaway_end")
      .setDescription("End giveaway")
      .addStringOption(opt =>
        opt.setName("message_id")
          .setDescription("Message ID")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("giveaway_reroll")
      .setDescription("Reroll giveaway")
      .addStringOption(opt =>
        opt.setName("message_id")
          .setDescription("Message ID")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

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

    // PAYPAL FEES
    if (interaction.commandName === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = (amount * 0.0449) + 0.6;
      const after = amount - fee;
      const send = amount + fee;

      const embed = new EmbedBuilder()
        .setColor("#009cde")
        .setTitle("PayPal Fee Calculator")
        .addFields(
          { name: "Original", value: `$${amount.toFixed(2)}`, inline: true },
          { name: "Fee", value: `$${fee.toFixed(2)}`, inline: true },
          { name: "After Fee", value: `$${after.toFixed(2)}`, inline: true },
          { name: "You Send", value: `$${send.toFixed(2)}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "paypal") return interaction.reply(PAYPAL_INFO);
    if (interaction.commandName === "binance") return interaction.reply(BINANCE_INFO);
    if (interaction.commandName === "payment-methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);

    if (interaction.commandName === "ticketpanel") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription("Choose ticket type")
        .setColor("Blue");

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_purchase").setLabel("Purchase").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_seller").setLabel("Seller Application").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [buttons] });
    }

    if (interaction.commandName === "giveaway") {

      const duration = interaction.options.getString("duration");
      const winnersCount = interaction.options.getInteger("winners");
      const prize = interaction.options.getString("prize");

      const embed = new EmbedBuilder()
        .setTitle("🎁 Giveaway")
        .setDescription(`Prize: ${prize}\nWinners: ${winnersCount}\nDuration: ${duration}`)
        .addFields({ name: "Participants", value: "0", inline: true })
        .setColor("Blue");

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_join")
          .setLabel("🎉 Enter")
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [button], fetchReply: true });

      giveaways.set(msg.id, {
        participants: new Set(),
        winnersCount,
        prize,
        message: msg
      });

      setTimeout(() => endGiveaway(msg.id), ms(duration));
    }

    if (interaction.commandName === "giveaway_end") {
      const id = interaction.options.getString("message_id");
      return endGiveaway(id, interaction);
    }

    if (interaction.commandName === "giveaway_reroll") {
      const id = interaction.options.getString("message_id");
      return rerollGiveaway(id, interaction);
    }
  }

  if (interaction.isButton()) {

    if (interaction.customId === "giveaway_join") {

      const g = giveaways.get(interaction.message.id);
      if (!g) return interaction.reply({ content: "❌ Giveaway expired.", ephemeral: true });

      if (g.participants.has(interaction.user.id))
        return interaction.reply({ content: "❌ You already joined.", ephemeral: true });

      g.participants.add(interaction.user.id);

      const embed = EmbedBuilder.from(g.message.embeds[0])
        .spliceFields(0, 1)
        .addFields({ name: "Participants", value: `${g.participants.size}`, inline: true });

      await g.message.edit({ embeds: [embed] });

      return interaction.reply({ content: "✅ You entered!", ephemeral: true });
    }
  }
});

/***********************
 * GIVEAWAY FUNCTIONS
 ***********************/
async function endGiveaway(msgId, interaction) {

  const g = giveaways.get(msgId);
  if (!g) return interaction?.reply?.({ content: "❌ Giveaway not found.", ephemeral: true });

  giveaways.delete(msgId);

  const entries = Array.from(g.participants);

  if (!entries.length) {
    await g.message.edit({ content: "❌ No participants.", embeds: [], components: [] });
    return;
  }

  const winners = [];
  while (winners.length < Math.min(g.winnersCount, entries.length)) {
    const rand = entries[Math.floor(Math.random() * entries.length)];
    if (!winners.includes(rand)) winners.push(rand);
  }

  await g.message.edit({
    content: `🎉 Winners: ${winners.map(id => `<@${id}>`).join(", ")}`,
    embeds: [],
    components: []
  });

  interaction?.reply?.({ content: "✅ Giveaway ended.", ephemeral: true });
}

async function rerollGiveaway(msgId, interaction) {

  const g = giveaways.get(msgId);
  if (!g) return interaction.reply({ content: "❌ Giveaway not active.", ephemeral: true });

  const entries = Array.from(g.participants);
  if (!entries.length) return interaction.reply({ content: "❌ No participants.", ephemeral: true });

  const winner = entries[Math.floor(Math.random() * entries.length)];

  await g.message.edit({
    content: `🎉 New Winner: <@${winner}>`,
    embeds: [],
    components: []
  });

  return interaction.reply({ content: "✅ Rerolled.", ephemeral: true });
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);
