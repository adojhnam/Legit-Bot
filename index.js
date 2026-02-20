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
const ADMIN_ROLE_ID = "1414301511579598858"; // نفس الادمن

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

/***********************
 * INVITE SYSTEM
 ***********************/
let invitesCache = new Map();
let inviteData = fs.existsSync("./invites.json")
  ? JSON.parse(fs.readFileSync("./invites.json"))
  : {};
const saveInvites = () =>
  fs.writeFileSync("./invites.json", JSON.stringify(inviteData, null, 2));

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const invites = await guild.invites.fetch();
  invitesCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
});

client.on("guildMemberAdd", async member => {
  const guild = member.guild;
  const newInvites = await guild.invites.fetch();
  const oldInvites = invitesCache.get(guild.id);
  if (!oldInvites) return;

  let usedInvite;
  newInvites.forEach(inv => {
    if ((oldInvites.get(inv.code) || 0) < inv.uses) usedInvite = inv;
  });

  invitesCache.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
  if (!usedInvite) return;

  const inviter = usedInvite.inviter.id;
  if (!inviteData[inviter])
    inviteData[inviter] = { real: 0, fake: 0, rejoin: 0, users: [] };

  const accountAge = Date.now() - member.user.createdTimestamp;
  const week = 7 * 86400000;

  if (inviteData[inviter].users.includes(member.id)) {
    inviteData[inviter].rejoin++;
  } else {
    if (accountAge < week) inviteData[inviter].fake++;
    else inviteData[inviter].real++;
    inviteData[inviter].users.push(member.id);
  }

  saveInvites();
});

client.on("guildMemberRemove", member => {
  for (const u in inviteData) {
    inviteData[u].users = inviteData[u].users.filter(x => x !== member.id);
  }
  saveInvites();
});

/***********************
 * GIVEAWAYS
 ***********************/
let giveaways = new Map();

/***********************
 * REGISTER COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [
    // INVITES
    new SlashCommandBuilder()
      .setName("invites")
      .setDescription("Invite system")
      .addSubcommand(s =>
        s.setName("user")
          .setDescription("Check user invites")
          .addUserOption(o =>
            o.setName("target")
              .setDescription("User to check")
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName("leaderboard")
          .setDescription("Top inviters")
      )
      .addSubcommand(s =>
        s.setName("reset")
          .setDescription("Reset invite data")
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // TICKET SYSTEM
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // PAYMENT
    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o =>
        o.setName("amount")
          .setDescription("Amount")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("paypal")
      .setDescription("Show PayPal"),

    new SlashCommandBuilder()
      .setName("binance")
      .setDescription("Show Binance"),

    new SlashCommandBuilder()
      .setName("payment-methods")
      .setDescription("Show all payment methods"),

    // GIVEAWAYS
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
  // ------------- SLASH COMMANDS -------------
  if (interaction.isChatInputCommand()) {
    const name = interaction.commandName;

    // --------- INVITES COMMAND ---------
    if (name === "invites") {
      const sub = interaction.options.getSubcommand();
      if (sub === "user") {
        const user = interaction.options.getUser("target");
        const data = inviteData[user.id] || { real: 0, fake: 0, rejoin: 0 };
        const embed = new EmbedBuilder()
          .setTitle(`📊 Invites for ${user.username}`)
          .addFields(
            { name: "✅ Real", value: `${data.real}`, inline: true },
            { name: "🤖 Fake", value: `${data.fake}`, inline: true },
            { name: "🔁 Rejoin", value: `${data.rejoin}`, inline: true },
            { name: "📦 Total", value: `${data.real + data.fake + data.rejoin}` }
          )
          .setColor("Blue");
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === "reset") {
        inviteData = {};
        saveInvites();
        return interaction.reply("✅ Invite counter reset.");
      }

      if (sub === "leaderboard") {
        const sorted = Object.entries(inviteData).sort((a, b) => b[1].real - a[1].real);
        if (!sorted.length) return interaction.reply("❌ No invites yet.");
        let page = 0;
        function getPage(p) {
          const slice = sorted.slice(p * 10, p * 10 + 10);
          let desc = "";
          slice.forEach(([id, data], i) => {
            const rank = p * 10 + i + 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
            desc += `${medal} <@${id}> — **${data.real}**\n`;
          });
          return new EmbedBuilder()
            .setTitle("🏆 Invite Leaderboard")
            .setDescription(desc)
            .setColor("Gold")
            .setFooter({ text: `Page ${p + 1}/${Math.ceil(sorted.length / 10)}` });
        }
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("prev_inv").setLabel("⬅️").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("next_inv").setLabel("➡️").setStyle(ButtonStyle.Secondary)
        );
        const msg = await interaction.reply({ embeds: [getPage(page)], components: [row], fetchReply: true });
        const collector = msg.createMessageComponentCollector({ time: 600000 });
        collector.on("collect", i => {
          if (i.user.id !== interaction.user.id)
            return i.reply({ content: "❌ Not yours.", ephemeral: true });
          if (i.customId === "prev_inv" && page > 0) page--;
          if (i.customId === "next_inv" && page < Math.ceil(sorted.length / 10) - 1) page++;
          i.update({ embeds: [getPage(page)] });
        });
      }
    }

    // --------- PAYMENT COMMANDS ---------
    if (name === "paypal") return interaction.reply(PAYPAL_INFO);
    if (name === "binance") return interaction.reply(BINANCE_INFO);
    if (name === "payment-methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);
    if (name === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = (amount * 0.0449) + 0.6;
      const after = amount - fee;
      const send = amount + fee;
      const embed = new EmbedBuilder()
        .setColor("#009cde")
        .setTitle("PayPal Fee Calculator")
        .addFields(
          { name: "Original Amount", value: `$${amount.toFixed(2)}`, inline: true },
          { name: "Fee", value: `$${fee.toFixed(2)}`, inline: true },
          { name: "After Fee", value: `$${after.toFixed(2)}`, inline: true },
          { name: "You Send", value: `$${send.toFixed(2)}`, inline: true }
        )
        .setFooter({ text: "PayPal Calculator" });
      return interaction.reply({ embeds: [embed] });
    }

    // --------- TICKET PANEL ---------
    if (name === "ticketpanel") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      const embed = new EmbedBuilder().setTitle("🎫 Ticket System").setDescription("Choose ticket type").setColor("Blue");
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_purchase").setLabel("Purchase").setStyle(ButtonStyle.Primary).setEmoji("🛒"),
        new ButtonBuilder().setCustomId("ticket_seller").setLabel("Seller Application").setStyle(ButtonStyle.Success).setEmoji("📦"),
        new ButtonBuilder().setCustomId("ticket_report").setLabel("Report Scammer").setStyle(ButtonStyle.Danger).setEmoji("🚨")
      );
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // --------- CLOSE TICKET ---------
    if (name === "close") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }

    // --------- GIVEAWAY COMMANDS ---------
    if (name === "giveaway") {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
        return interaction.reply({ content: "❌ Admins only.", ephemeral: true });

      const duration = interaction.options.getString("duration");
      const winnersCount = interaction.options.getInteger("winners");
      const prize = interaction.options.getString("prize");

      const embed = new EmbedBuilder()
        .setTitle("🎁 Giveaway")
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Duration:** ${duration}\n**React with 🎉 to enter!**`)
        .addFields({ name: "Participants", value: "0", inline: true })
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("giveaway_join").setLabel("🎉 Enter").setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      giveaways.set(msg.id, { participants: new Set(), winnersCount, prize, message: msg });

      setTimeout(() => endGiveaway(msg.id), ms(duration));
    }

    if (name === "giveaway_end") return endGiveaway(interaction.options.getString("message_id"), interaction);
    if (name === "giveaway_reroll") return rerollGiveaway(interaction.options.getString("message_id"), interaction);
  }

  // --------- BUTTONS & MODALS ---------
  handleButtonsAndModals(interaction);
});

/***********************
 * BUTTONS & MODALS HANDLER
 ***********************/
async function handleButtonsAndModals(interaction) {
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Ticket buttons
    if (id === "ticket_purchase") {
      const modal = new ModalBuilder().setCustomId("purchase_modal").setTitle("Purchase Ticket");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("product").setLabel("Product").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("payment").setLabel("Payment method").setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (id === "ticket_seller") {
      const modal = new ModalBuilder().setCustomId("seller_modal").setTitle("Seller Application");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("items").setLabel("Items & Prices").setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("proof").setLabel("Why should we trust you?").setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (id === "ticket_report") return createTicket(interaction, "Report", ["🚨 Scam report"]);
    if (id === "payment_methods") return interaction.reply(`${PAYPAL_INFO}\n${BINANCE_INFO}`);
    if (id === "close_ticket") return closeTicket(interaction.channel, interaction.user);

    // Giveaway Join
    if (id === "giveaway_join") {
      const g = giveaways.get(interaction.message.id);
      if (!g) return;
      g.participants.add(interaction.user.id);
      const embed = EmbedBuilder.from(g.message.embeds[0])
        .spliceFields(0, 1)
        .addFields({ name: "Participants", value: `${g.participants.size}`, inline: true });
      await g.message.edit({ embeds: [embed] });
      return interaction.reply({ content: "✅ You entered the giveaway!", ephemeral: true });
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "purchase_modal") {
      return createTicket(interaction, "Purchase", [
        `🛒 Product: ${interaction.fields.getTextInputValue("product")}`,
        `💳 Payment: ${interaction.fields.getTextInputValue("payment")}`
      ]);
    }

    if (interaction.customId === "seller_modal") {
      return createTicket(interaction, "Seller", [
        interaction.fields.getTextInputValue("items"),
        interaction.fields.getTextInputValue("proof")
      ]);
    }
  }
}

/***********************
 * CREATE & CLOSE TICKET
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

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("payment_methods").setLabel("Payment Methods").setEmoji("💳").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("close_ticket").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@${interaction.user.id



