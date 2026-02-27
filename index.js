require("dotenv").config();
const fs = require("fs");
const archiver = require("archiver");
const ms = require("ms");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
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

/***********************
 * INVITE TRACKING
 ***********************/
const INVITE_FILE = "invites.json";
let inviteData = {};
let guildInvites = new Map();

if (!fs.existsSync(INVITE_FILE)) fs.writeFileSync(INVITE_FILE, "{}");

function loadInvites() {
  inviteData = JSON.parse(fs.readFileSync(INVITE_FILE));
}

function saveInvites() {
  fs.writeFileSync(INVITE_FILE, JSON.stringify(inviteData, null, 2));
}

/***********************
 * GIVEAWAY SETUP
 ***********************/
const DATA_FILE = "giveaways.json";
let giveaways = new Map();
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

function saveGiveaways() {
  const obj = Object.fromEntries(
    [...giveaways].map(([id, g]) => [id, { ...g, users: [...g.users] }])
  );
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}

function loadGiveaways() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  for (const id in data) {
    const g = data[id];
    g.users = new Set(g.users);
    giveaways.set(id, g);
    scheduleUpdate(id);
    const timeLeft = g.endTime - Date.now();
    if (timeLeft > 0) setTimeout(() => endGiveaway(id), timeLeft);
    else endGiveaway(id);
  }
}

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  loadInvites();
  loadGiveaways();

  // Cache invites
  const guild = await client.guilds.fetch(GUILD_ID);
  const invites = await guild.invites.fetch();
  guildInvites.set(
    guild.id,
    new Map(invites.map((i) => [i.code, i.uses]))
  );
});

/***********************
 * INVITE EVENTS
 ***********************/
client.on(Events.GuildMemberAdd, async (member) => {
  const cached = guildInvites.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch();
  guildInvites.set(
    member.guild.id,
    new Map(newInvites.map((i) => [i.code, i.uses]))
  );

  const used = newInvites.find((i) => cached.get(i.code) < i.uses);
  if (!used) return;

  const inviter = used.inviter;
  if (!inviter) return;

  if (!inviteData[inviter.id])
    inviteData[inviter.id] = { joins: 0, rejoin: 0, last: [] };

  if (inviteData[inviter.id].last.includes(member.id)) {
    inviteData[inviter.id].rejoin++;
  } else {
    inviteData[inviter.id].joins++;
  }

  inviteData[inviter.id].last.push(member.id);
  saveInvites();
});

client.on(Events.InviteCreate, async (invite) => {
  const invites = await invite.guild.invites.fetch();
  guildInvites.set(
    invite.guild.id,
    new Map(invites.map((i) => [i.code, i.uses]))
  );
});

client.on(Events.InviteDelete, async (invite) => {
  const invites = await invite.guild.invites.fetch();
  guildInvites.set(
    invite.guild.id,
    new Map(invites.map((i) => [i.code, i.uses]))
  );
});

/***********************
 * REGISTER COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("invites")
      .setDescription("Show invite stats")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target user")
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("resetinvites")
      .setDescription("Reset ALL invites")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Invite leaderboard")
      .toJSON(),

    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Open ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close ticket")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption((o) =>
        o.setName("amount").setDescription("Amount").setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("paypal")
      .setDescription("Show PayPal")
      .toJSON(),

    new SlashCommandBuilder()
      .setName("binance")
      .setDescription("Show Binance")
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
  console.log("✅ Commands registered");
}
/***********************
 * INTERACTIONS
 ***********************/
client.on(Events.InteractionCreate, async (interaction) => {

  if (interaction.isChatInputCommand()) {

    // INVITES
    if (interaction.commandName === "invites") {
      const user = interaction.options.getUser("user") || interaction.user;
      const data = inviteData[user.id];

      if (!data)
        return interaction.reply({ content: "No invite data.", ephemeral: true });

      const total = data.joins + data.rejoin;

      const embed = new EmbedBuilder()
        .setColor("#00ff99")
        .setTitle("📨 Invite Stats")
        .addFields(
          { name: "Joins", value: `${data.joins}`, inline: true },
          { name: "Rejoins", value: `${data.rejoin}`, inline: true },
          { name: "Total", value: `${total}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // RESET INVITES (يصفّر الليدر بورد)
    if (interaction.commandName === "resetinvites") {
      inviteData = {};
      saveInvites();

      return interaction.reply("✅ All invites reset. Leaderboard is now 0.");
    }

    // LEADERBOARD (يعتمد على البيانات المخزنة فقط)
    if (interaction.commandName === "leaderboard") {

      const sorted = Object.entries(inviteData)
        .map(([id, d]) => ({
          id,
          total: d.joins + d.rejoin,
        }))
        .sort((a, b) => b.total - a.total);

      if (!sorted.length)
        return interaction.reply("No invite data yet.");

      const perPage = 10;
      let page = 0;

      function embed(page) {
        const start = page * perPage;
        const users = sorted.slice(start, start + perPage);

        return new EmbedBuilder()
          .setTitle("🏆 Invite Leaderboard")
          .setColor("#FFD700")
          .setDescription(
            users
              .map((u, i) =>
                `${start + i + 1}. <@${u.id}> — **${u.total}**`
              )
              .join("\n")
          )
          .setFooter({
            text: `Page ${page + 1}/${Math.ceil(sorted.length / perPage)}`,
          });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("lb_prev")
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("lb_next")
          .setLabel("➡️")
          .setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.reply({
        embeds: [embed(page)],
        components: [row],
        fetchReply: true,
      });

      const collector = msg.createMessageComponentCollector({
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id)
          return i.reply({ content: "Not for you.", ephemeral: true });

        if (i.customId === "lb_prev")
          page = page > 0 ? page - 1 : Math.ceil(sorted.length / perPage) - 1;

        if (i.customId === "lb_next")
          page = page < Math.ceil(sorted.length / perPage) - 1 ? page + 1 : 0;

        await i.update({ embeds: [embed(page)] });
      });
    }

    // PAYMENTS
    if (interaction.commandName === "paypal")
      return interaction.reply(PAYPAL_INFO);

    if (interaction.commandName === "binance")
      return interaction.reply(BINANCE_INFO);

    if (interaction.commandName === "paypal-fees") {
      const amount = interaction.options.getNumber("amount");
      const fee = amount * 0.0449 + 0.6;

      const embed = new EmbedBuilder()
        .setColor("#009cde")
        .setTitle("PayPal Fee")
        .addFields(
          { name: "Amount", value: `$${amount.toFixed(2)}` },
          { name: "Fee", value: `$${fee.toFixed(2)}` }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // TICKET PANEL
    if (interaction.commandName === "ticketpanel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription("Choose ticket type")
        .setColor("Blue");

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_purchase")
          .setLabel("Purchase")
          .setEmoji("🛒")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_seller")
          .setLabel("Seller")
          .setEmoji("📦")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("ticket_report")
          .setLabel("Report")
          .setEmoji("🚨")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [buttons] });
    }

    // CLOSE
    if (interaction.commandName === "close") {
      await interaction.reply({ content: "Closing...", ephemeral: true });
      return closeTicket(interaction.channel, interaction.user);
    }
  }

  /***********************
   * BUTTONS
   ***********************/
  if (interaction.isButton()) {

    if (interaction.customId === "ticket_purchase") {
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
            .setLabel("Payment")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "ticket_seller") {
      const modal = new ModalBuilder()
        .setCustomId("seller_modal")
        .setTitle("Seller");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("items")
            .setLabel("Items")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("proof")
            .setLabel("Why trust you?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "ticket_report")
      return createTicket(interaction, "Report", ["🚨 Scam"]);
  }

  /***********************
   * MODALS
   ***********************/
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "purchase_modal")
      return createTicket(interaction, "Purchase", [
        `🛒 ${interaction.fields.getTextInputValue("product")}`,
        `💳 ${interaction.fields.getTextInputValue("payment")}`,
      ]);

    if (interaction.customId === "seller_modal")
      return createTicket(interaction, "Seller", [
        interaction.fields.getTextInputValue("items"),
        interaction.fields.getTextInputValue("proof"),
      ]);
  }
});
/***********************
 * GIVEAWAY SYSTEM
 ***********************/
function buildGiveawayEmbed(prize, winners, endTime, count) {
  return new EmbedBuilder()
    .setColor("#0d0d0d")
    .setTitle("🎉 DARK GIVEAWAY 🎉")
    .setDescription(
`✨ Prize: **${prize}**
🏆 Winners: **${winners}**
👥 Participants: **${count}**
⏳ Ends: <t:${Math.floor(endTime / 1000)}:R>

🔥 Click the button below to enter!`
    );
}

function scheduleUpdate(id) {
  setInterval(async () => {
    const g = giveaways.get(id);
    if (!g) return;

    try {
      const channel = await client.channels.fetch(g.channelId);
      const msg = await channel.messages.fetch(id);

      const embed = buildGiveawayEmbed(
        g.prize,
        g.winners,
        g.endTime,
        g.users.size
      );

      msg.edit({ embeds: [embed] });
    } catch {}
  }, 60000);
}

/***********************
 * END GIVEAWAY
 ***********************/
async function endGiveaway(id) {
  const g = giveaways.get(id);
  if (!g) return;

  try {
    const channel = await client.channels.fetch(g.channelId);
    const msg = await channel.messages.fetch(id);

    if (!g.users.size) {
      await msg.edit({
        content: "No participants",
        embeds: [],
        components: [],
      });
      giveaways.delete(id);
      saveGiveaways();
      return;
    }

    const entries = [...g.users];
    const winners = [];

    while (winners.length < Math.min(g.winners, entries.length)) {
      const rand = entries[Math.floor(Math.random() * entries.length)];
      if (!winners.includes(rand)) winners.push(rand);
    }

    const text = winners.map((x) => `<@${x}>`).join(", ");

    await msg.edit({
      content: `🎉 Winners: ${text}`,
      embeds: [],
      components: [],
    });

    channel.send(`🎉 Congratulations ${text}! You won **${g.prize}**`);

    for (const id of winners) {
      const member = await channel.guild.members
        .fetch(id)
        .catch(() => null);

      if (member)
        member.send(
          `🎉 You won **${g.prize}** in ${channel.guild.name}!`
        ).catch(() => {});
    }

    giveaways.delete(id);
    saveGiveaways();

  } catch {}
}

/***********************
 * REROLL
 ***********************/
async function rerollGiveaway(id, interaction) {
  const g = giveaways.get(id);
  if (!g)
    return interaction.reply({
      ephemeral: true,
      content: "Giveaway not found.",
    });

  const entries = [...g.users];
  const winners = [];

  while (winners.length < Math.min(g.winners, entries.length)) {
    const rand = entries[Math.floor(Math.random() * entries.length)];
    if (!winners.includes(rand)) winners.push(rand);
  }

  return interaction.reply({
    content: `🎉 New winners: ${winners
      .map((x) => `<@${x}>`)
      .join(", ")}`,
  });
}

/***********************
 * GIVEAWAY BUTTON
 ***********************/
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "join_giveaway") {
    const g = giveaways.get(interaction.message.id);

    if (!g)
      return interaction.reply({
        ephemeral: true,
        content: "This giveaway ended.",
      });

    if (g.users.has(interaction.user.id))
      return interaction.reply({
        ephemeral: true,
        content: "Already joined.",
      });

    g.users.add(interaction.user.id);

    const embed = buildGiveawayEmbed(
      g.prize,
      g.winners,
      g.endTime,
      g.users.size
    );

    await interaction.message.edit({ embeds: [embed] });

    saveGiveaways();

    return interaction.reply({
      ephemeral: true,
      content: "Joined 🎉",
    });
  }
});

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);
