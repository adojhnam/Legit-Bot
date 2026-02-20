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
 * CONFIG
 ***********************/
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";
const ADMIN_ROLE_ID = "1414301511579598858"; // نفس الادمن

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

let giveaways = new Map(); // لتخزين كل القيف أوايات مؤقتاً

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
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o =>
        o.setName("amount")
         .setDescription("Amount")
         .setRequired(true)
      ),

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

    // ===== Giveaway Commands =====
    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Start a giveaway")
      .addStringOption(opt => 
        opt.setName("duration")
           .setDescription("Duration e.g. 1h, 30m, 2d")
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
      .setDescription("End a giveaway early")
      .addStringOption(opt => 
        opt.setName("message_id")
           .setDescription("ID of the giveaway message")
           .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("giveaway_reroll")
      .setDescription("Reroll winners of a giveaway")
      .addStringOption(opt => 
        opt.setName("message_id")
           .setDescription("ID of the giveaway message")
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

  // ===== SLASH COMMANDS =====
  if (interaction.isChatInputCommand()) {

    // ===== PayPal Fees =====
    if (interaction.commandName === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = (amount * 0.0449) + 0.6;
      const after = amount - fee;
      const send = amount + fee;

      const embed = new EmbedBuilder()
        .setColor("#009cde")
        .setTitle("PayPal Fee Calculator")
        .addFields(
          { name: "<:paypal:1430875512221339680> Original Amount", value: `$${amount.toFixed(2)}`, inline: true },
          { name: "📊 Fee", value: `$${fee.toFixed(2)}`, inline: true },
          { name: "📉 After Fee", value: `$${after.toFixed(2)}`, inline: true },
          { name: "📤 You Send", value: `$${send.toFixed(2)}`, inline: true }
        )
        .setFooter({ text: "PayPal Calculator" });

      return interaction.reply({ embeds: [embed] });
    }

    // ===== Giveaway Start =====
    if (interaction.commandName === "giveaway") {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
        return interaction.reply({ content: "❌ Admins only.", ephemeral: true });

      const duration = interaction.options.getString("duration");
      const winnersCount = interaction.options.getInteger("winners");
      const prize = interaction.options.getString("prize");

      const giveawayEmbed = new EmbedBuilder()
        .setTitle(`🎁 Giveaway`)
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Duration:** ${duration}\n**React with 🎉 to enter!**`)
        .setColor("Blue")
        .addFields({ name: "Participants", value: "0", inline: true });

      const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_join")
          .setLabel("🎉 Enter")
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.reply({ embeds: [giveawayEmbed], components: [joinButton], fetchReply: true });
      const participants = new Set();
      giveaways.set(msg.id, { participants, winnersCount, prize, message: msg });

      // مؤقت انتهاء القيف أواي
      setTimeout(() => endGiveaway(msg.id), ms(duration));
    }

    // ===== Giveaway End =====
    if (interaction.commandName === "giveaway_end") {
      const messageId = interaction.options.getString("message_id");
      return endGiveaway(messageId, interaction);
    }

    // ===== Giveaway Reroll =====
    if (interaction.commandName === "giveaway_reroll") {
      const messageId = interaction.options.getString("message_id");
      return rerollGiveaway(messageId, interaction);
    }

   // ===== Ticket Panel / Payments / Close Ticket =====
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
      { label: "Purchase", value: "purchase", emoji: { id: "1438808044346675290" } },
      { label: "Seller Application", value: "seller", emoji: "📦" },
      { label: "Report Scammer", value: "report", emoji: "🚨" }
    );

  // إرسال القائمة
  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
}

// ===== Handle Select Menu =====
client.on("interactionCreate", async (selectInteraction) => {
  if (!selectInteraction.isStringSelectMenu()) return;

  if (selectInteraction.customId === "ticket_select") {
    const choice = selectInteraction.values[0];

    // هنا تعامل مع الاختيار (فتح تذكرة أو أي وظيفة)
    // مثال:
    await selectInteraction.followUp({ content: `You selected: ${choice}`, ephemeral: true });

    // إعادة إرسال نفس الـ menu بدون أن يظل متذكر الاختيار السابق
    const resetMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select ticket type")
      .addOptions(
        { label: "Purchase", value: "purchase", emoji: { id: "1438808044346675290" } },
        { label: "Seller Application", value: "seller", emoji: "📦" },
        { label: "Report Scammer", value: "report", emoji: "🚨" }
      );

    await selectInteraction.update({ components: [new ActionRowBuilder().addComponents(resetMenu)] });
  }
});

    if (interaction.commandName === "paypal") return interaction.reply(PAYPAL_INFO);
    if (interaction.commandName === "binance") return interaction.reply(BINANCE_INFO);
    if (interaction.commandName === "payment-methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);
    if (interaction.commandName === "close") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
  }

  // ===== Giveaway Join Button =====
  if (interaction.isButton() && interaction.customId === "giveaway_join") {
    for (const [msgId, g] of giveaways.entries()) {
      if (g.message.id === interaction.message.id) {
        g.participants.add(interaction.user.id);
        const embed = EmbedBuilder.from(g.message.embeds[0])
          .spliceFields(0, 1)
          .addFields({ name: "Participants", value: `${g.participants.size}`, inline: true });
        await g.message.edit({ embeds: [embed] });
        return interaction.reply({ content: "✅ You entered the giveaway!", ephemeral: true });
      }
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

  if (g.participants.size === 0) {
    const noEntryEmbed = EmbedBuilder.from(g.message.embeds[0])
      .setDescription(`**Prize:** ${g.prize}\n**No valid entries.**`)
      .setColor("Red");
    await g.message.edit({ embeds: [noEntryEmbed], components: [] });
    return interaction?.reply?.({ content: "✅ Giveaway ended.", ephemeral: true });
  }

  const entries = Array.from(g.participants);
  const winners = [];
  while (winners.length < Math.min(g.winnersCount, entries.length)) {
    const rand = entries[Math.floor(Math.random() * entries.length)];
    if (!winners.includes(rand)) winners.push(rand);
  }

  const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
  const finishedEmbed = EmbedBuilder.from(g.message.embeds[0])
    .setDescription(`**Prize:** ${g.prize}\n**Winners:** ${winnerMentions}`)
    .setColor("Green")
    .addFields({ name: "Total Participants", value: `${g.participants.size}`, inline: true });

  await g.message.edit({ embeds: [finishedEmbed], components: [] });
  return interaction?.reply?.({ content: "✅ Giveaway ended.", ephemeral: true });
}

async function rerollGiveaway(msgId, interaction) {
  const g = giveaways.get(msgId);
  if (!g) return interaction?.reply?.({ content: "❌ Giveaway not found.", ephemeral: true });

  if (g.participants.size === 0) return interaction.reply({ content: "❌ No participants to reroll.", ephemeral: true });

  const entries = Array.from(g.participants);
  const winners = [];
  while (winners.length < Math.min(g.winnersCount, entries.length)) {
    const rand = entries[Math.floor(Math.random() * entries.length)];
    if (!winners.includes(rand)) winners.push(rand);
  }

  const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
  const rerollEmbed = EmbedBuilder.from(g.message.embeds[0])
    .setDescription(`**Prize:** ${g.prize}\n**Winners (Reroll):** ${winnerMentions}`)
    .setColor("Yellow");

  await g.message.edit({ embeds: [rerollEmbed] });
  return interaction.reply({ content: "✅ Giveaway rerolled.", ephemeral: true });
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);



