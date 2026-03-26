require("dotenv").config();
const fs = require("fs");
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
} = require("discord.js");

/* ================= CONFIG ================= */
// غيرهم هون إذا بدك
const TOKEN = process.env.TOKEN;
const GUILD_ID = "1412911390494036072";
const TICKET_CATEGORY_ID = "1414954122918236171";
const STAFF_ROLE_ID = "1414301511579598858";
const ADMIN_ROLE_ID = "1414301511579598858";

// اختياري: إذا بدك لوق لفتح/إغلاق التذاكر حط آيدي روم هنا
const LOG_CHANNEL_ID = "";

const PAYPAL_INFO =
  "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO =
  "<:binance:1430875529539489932> **Binance ID:** 993881216";

const INVITES_FILE = "./invites.json";
const GIVEAWAYS_FILE = "./giveaways.json";

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ================= STORAGE ================= */
function load(file, def) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(def, null, 2), "utf8");
      return def;
    }
    const raw = fs.readFileSync(file, "utf8");
    return raw.trim() ? JSON.parse(raw) : def;
  } catch (err) {
    console.error(`Failed to load ${file}:`, err);
    return def;
  }
}

function save(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Failed to save ${file}:`, err);
  }
}

function normalizeInviteData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { users: {}, members: {} };
  }

  if (!raw.users && !raw.members) {
    return { users: raw, members: {} };
  }

  return {
    users: raw.users && typeof raw.users === "object" ? raw.users : {},
    members: raw.members && typeof raw.members === "object" ? raw.members : {},
  };
}

let inviteData = normalizeInviteData(load(INVITES_FILE, { users: {}, members: {} }));
let giveaways = load(GIVEAWAYS_FILE, {});

// كاش دعوات السيرفر
const inviteCache = new Map();

/* ================= HELPERS ================= */
function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;

  return (
    member.roles?.cache?.has(STAFF_ROLE_ID) ||
    member.roles?.cache?.has(ADMIN_ROLE_ID)
  );
}

function sanitizeChannelName(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "ticket"
  );
}

function getInviteUserRecord(userId) {
  if (!inviteData.users[userId]) {
    inviteData.users[userId] = { joins: 0, leaves: 0, current: 0 };
  }
  return inviteData.users[userId];
}

function paymentMethodsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_payments")
      .setLabel("Payment Methods")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

function giveawayJoinRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("join")
      .setLabel("Join")
      .setEmoji("🎉")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

function paypalEmbed() {
  return new EmbedBuilder()
    .setColor("#009cde")
    .setTitle("💰 PayPal")
    .setDescription(PAYPAL_INFO);
}

function binanceEmbed() {
  return new EmbedBuilder()
    .setColor("#f3ba2f")
    .setTitle("💰 Binance")
    .setDescription(BINANCE_INFO);
}

function paymentEmbed() {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("💳 Payment Methods")
    .setDescription(`${PAYPAL_INFO}\n\n${BINANCE_INFO}`);
}

function paypalFeesEmbed(amount) {
  const fee = amount * 0.0449 + 0.6;
  const after = amount - fee;
  const send = amount + fee;

  return new EmbedBuilder()
    .setColor("#009cde")
    .setTitle("💰 PayPal Fees")
    .addFields(
      { name: "Amount", value: `$${amount.toFixed(2)}`, inline: true },
      { name: "Fee", value: `$${fee.toFixed(2)}`, inline: true },
      { name: "After Fee", value: `$${after.toFixed(2)}`, inline: true },
      { name: "You Send", value: `$${send.toFixed(2)}`, inline: true }
    );
}

function ticketPanelEmbed() {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🎫 Ticket System")
    .setDescription(
      [
        "Choose the type of ticket you want to open:",
        "",
        "🛒 **Purchase** → open a buying ticket",
        "📦 **Seller** → apply as a seller",
        "🚨 **Report** → report scam/problem",
      ].join("\n")
    );
}

function ticketEmbed(type, lines, user) {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`🎫 ${type} Ticket`)
    .setDescription(lines.join("\n"))
    .addFields({ name: "Opened By", value: `${user}`, inline: true });
}

function giveawayEmbed(g, ended = false, winnersText = null) {
  const userCount = Array.isArray(g.users) ? g.users.length : 0;
  const winnersCount =
    typeof g.winners === "number" && g.winners > 0 ? g.winners : 1;
  const prizeText = typeof g.prize === "string" ? g.prize : "Unknown Prize";

  const parts = [
    `✨ Prize: **${prizeText}**`,
    `🏆 Winners: **${winnersCount}**`,
    `👥 Participants: **${userCount}**`,
  ];

  if (ended) {
    parts.push("⏹️ Status: **Ended**");
    if (winnersText) parts.push(`🎉 Winner(s): ${winnersText}`);
  } else {
    const endUnix = g.end
      ? Math.floor(g.end / 1000)
      : Math.floor(Date.now() / 1000);
    parts.push(`⏳ Ends: <t:${endUnix}:R>`);
  }

  return new EmbedBuilder()
    .setColor("#0d0d0d")
    .setTitle("🎉 DARK GIVEAWAY 🎉")
    .setDescription(parts.join("\n"));
}

function invitesEmbed(targetUser, stats) {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("📨 Invite Stats")
    .setDescription(`Stats for ${targetUser}`)
    .addFields(
      { name: "Joins", value: String(stats.joins || 0), inline: true },
      { name: "Leaves", value: String(stats.leaves || 0), inline: true },
      { name: "Current", value: String(stats.current || 0), inline: true }
    );
}

function leaderboardEmbed(guild, list) {
  const description = list.length
    ? list
        .map(
          ([userId, stats], index) =>
            `**${index + 1}.** <@${userId}> — ${stats.current || 0} current | ${stats.joins || 0} joins | ${stats.leaves || 0} leaves`
        )
        .join("\n")
    : "No invite data yet.";

  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`🏆 ${guild.name} Invite Leaderboard`)
    .setDescription(description);
}

async function safeLogTicket(guild, embed) {
  if (!LOG_CHANNEL_ID) return;
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel || !logChannel.isTextBased()) return;
  await logChannel.send({ embeds: [embed] }).catch(() => null);
}

function getTicketOwnerIdFromTopic(topic) {
  if (!topic || !topic.startsWith("ticket:")) return null;
  const parts = topic.split(":");
  return parts[1] || null;
}

function getTicketTypeFromTopic(topic) {
  if (!topic || !topic.startsWith("ticket:")) return null;
  const parts = topic.split(":");
  return parts[2] || "Ticket";
}

async function findOpenTicketForUser(guild, userId) {
  const channels = guild.channels.cache.filter(
    (c) =>
      c.parentId === TICKET_CATEGORY_ID &&
      c.type === ChannelType.GuildText &&
      c.topic &&
      c.topic.startsWith(`ticket:${userId}:`)
  );

  return channels.first() || null;
}

async function fetchGiveawayMessage(g) {
  if (!g?.channelId || !g?.messageId) return { channel: null, message: null };

  const channel = await client.channels.fetch(g.channelId).catch((err) => {
    console.error("Failed to fetch giveaway channel:", err);
    return null;
  });

  if (!channel || !channel.isTextBased()) {
    return { channel: null, message: null };
  }

  const message = await channel.messages.fetch(g.messageId).catch((err) => {
    console.error("Failed to fetch giveaway message:", err);
    return null;
  });

  return { channel, message };
}

function pickWinners(users, count) {
  const safeUsers = Array.isArray(users) ? [...users] : [];
  const winners = [];

  while (winners.length < Math.min(count, safeUsers.length)) {
    const index = Math.floor(Math.random() * safeUsers.length);
    winners.push(safeUsers[index]);
    safeUsers.splice(index, 1);
  }

  return winners;
}

function ensureGiveawayShape(giveawayId) {
  const g = giveaways[giveawayId];
  if (!g) return null;

  if (!Array.isArray(g.users)) g.users = [];
  if (typeof g.ended !== "boolean") g.ended = false;
  if (!Array.isArray(g.lastWinners)) g.lastWinners = [];
  if (!g.messageId) g.messageId = giveawayId;
  if (typeof g.winners !== "number" || g.winners < 1) g.winners = 1;
  if (typeof g.prize !== "string") g.prize = "Unknown Prize";

  return g;
}

/* ================= COMMANDS ================= */
async function register() {
  const cmds = [
    new SlashCommandBuilder()
      .setName("paypal")
      .setDescription("Show PayPal payment info"),

    new SlashCommandBuilder()
      .setName("binance")
      .setDescription("Show Binance payment info"),

    new SlashCommandBuilder()
      .setName("paymentmethods")
      .setDescription("Show all payment methods"),

    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption((o) =>
        o
          .setName("amount")
          .setDescription("Amount in USD")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Send the ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close the current ticket"),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Manage giveaways")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) =>
        s
          .setName("start")
          .setDescription("Start a giveaway")
          .addStringOption((o) =>
            o
              .setName("duration")
              .setDescription("Example: 10m, 1h, 1d")
              .setRequired(true)
          )
          .addIntegerOption((o) =>
            o
              .setName("winners")
              .setDescription("Number of winners")
              .setRequired(true)
          )
          .addStringOption((o) =>
            o
              .setName("prize")
              .setDescription("Giveaway prize")
              .setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("end")
          .setDescription("End a giveaway manually")
          .addStringOption((o) =>
            o
              .setName("id")
              .setDescription("Giveaway message ID")
              .setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("reroll")
          .setDescription("Reroll giveaway winners")
          .addStringOption((o) =>
            o
              .setName("id")
              .setDescription("Giveaway message ID")
              .setRequired(true)
          )
      ),

    new SlashCommandBuilder()
      .setName("invites")
      .setDescription("Show invite stats")
      .addUserOption((o) =>
        o
          .setName("user")
          .setDescription("User to check")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("invite")
      .setDescription("Invite commands")
      .addSubcommand((s) =>
        s
          .setName("leaderboard")
          .setDescription("Show invite leaderboard")
      ),

    new SlashCommandBuilder()
      .setName("reset")
      .setDescription("Reset invite data")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommandGroup((g) =>
        g
          .setName("invite")
          .setDescription("Invite reset commands")
          .addSubcommand((s) =>
            s
              .setName("user")
              .setDescription("Reset invite stats for one user")
              .addUserOption((o) =>
                o
                  .setName("target")
                  .setDescription("Target user")
                  .setRequired(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("leaderboard")
              .setDescription("Reset all invite leaderboard data")
          )
      ),
  ].map((x) => x.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: cmds,
  });
}

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`READY AS ${client.user.tag}`);

  await register();

  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      inviteCache.set(guild.id, invites);
    } catch (err) {
      console.error(`Failed to cache invites for guild ${guild.id}:`, err.message);
    }
  }

  for (const giveawayId of Object.keys(giveaways)) {
    const g = ensureGiveawayShape(giveawayId);
    if (!g || g.ended) continue;

    const remaining = g.end - Date.now();
    if (remaining <= 0) {
      endGiveaway(giveawayId).catch(console.error);
    } else {
      setTimeout(() => {
        endGiveaway(giveawayId).catch(console.error);
      }, remaining);
    }
  }
});

/* ================= INVITES ================= */
client.on(Events.InviteCreate, async (invite) => {
  try {
    const invites = await invite.guild.invites.fetch();
    inviteCache.set(invite.guild.id, invites);
  } catch {}
});

client.on(Events.InviteDelete, async (invite) => {
  try {
    const invites = await invite.guild.invites.fetch();
    inviteCache.set(invite.guild.id, invites);
  } catch {}
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const oldInvites = inviteCache.get(member.guild.id);
    const newInvites = await member.guild.invites.fetch();

    inviteCache.set(member.guild.id, newInvites);

    if (!oldInvites) return;

    const usedInvite = newInvites.find((inv) => {
      const oldUses = oldInvites.get(inv.code)?.uses || 0;
      return inv.uses > oldUses;
    });

    if (!usedInvite || !usedInvite.inviter) return;

    const inviterId = usedInvite.inviter.id;
    const stats = getInviteUserRecord(inviterId);
    stats.joins += 1;
    stats.current += 1;

    inviteData.members[member.id] = inviterId;
    save(INVITES_FILE, inviteData);
  } catch (err) {
    console.error("GuildMemberAdd invite tracking error:", err.message);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const inviterId = inviteData.members[member.id];
    if (!inviterId) return;

    const stats = getInviteUserRecord(inviterId);
    stats.leaves += 1;
    stats.current = Math.max(0, (stats.current || 0) - 1);

    delete inviteData.members[member.id];
    save(INVITES_FILE, inviteData);
  } catch (err) {
    console.error("GuildMemberRemove invite tracking error:", err.message);
  }
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === "paypal") {
        return i.reply({ embeds: [paypalEmbed()] });
      }

      if (i.commandName === "binance") {
        return i.reply({ embeds: [binanceEmbed()] });
      }

      if (i.commandName === "paymentmethods") {
        return i.reply({ embeds: [paymentEmbed()] });
      }

      if (i.commandName === "paypal-fees") {
        const amount = i.options.getNumber("amount");
        if (amount <= 0) {
          return i.reply({
            content: "Amount must be bigger than 0.",
            ephemeral: true,
          });
        }

        return i.reply({ embeds: [paypalFeesEmbed(amount)] });
      }

      if (i.commandName === "ticketpanel") {
        return i.reply({
          embeds: [ticketPanelEmbed()],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("buy")
                .setLabel("Purchase")
                .setEmoji("🛒")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("sell")
                .setLabel("Seller")
                .setEmoji("📦")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId("report")
                .setLabel("Report")
                .setEmoji("🚨")
                .setStyle(ButtonStyle.Danger)
            ),
          ],
        });
      }

      if (i.commandName === "close") {
        if (!i.channel || !i.channel.topic?.startsWith("ticket:")) {
          return i.reply({
            content: "This is not a ticket channel.",
            ephemeral: true,
          });
        }

        const ownerId = getTicketOwnerIdFromTopic(i.channel.topic);
        const canClose = isStaff(i.member) || ownerId === i.user.id;

        if (!canClose) {
          return i.reply({
            content: "You do not have permission to close this ticket.",
            ephemeral: true,
          });
        }

        await i.reply({ content: "Closing ticket in 5 seconds..." });
        await closeTicketChannel(i.channel, i.user, "Closed using /close");
        return;
      }

      if (i.commandName === "giveaway") {
        const sub = i.options.getSubcommand();

        if (sub === "start") {
          const durationText = i.options.getString("duration");
          const duration = ms(durationText);
          const winners = i.options.getInteger("winners");
          const prize = i.options.getString("prize");

          if (!duration || duration <= 0) {
            return i.reply({
              content: "Invalid duration. Example: 10m, 1h, 1d",
              ephemeral: true,
            });
          }

          if (winners <= 0) {
            return i.reply({
              content: "Winners must be at least 1.",
              ephemeral: true,
            });
          }

          const g = {
            prize,
            winners,
            end: Date.now() + duration,
            users: [],
            channelId: i.channelId,
            messageId: null,
            guildId: i.guildId,
            ended: false,
            lastWinners: [],
          };

          const msg = await i.reply({
            embeds: [giveawayEmbed(g)],
            components: [giveawayJoinRow(false)],
            fetchReply: true,
          });

          g.messageId = msg.id;
          giveaways[msg.id] = g;
          save(GIVEAWAYS_FILE, giveaways);

          setTimeout(() => {
            endGiveaway(msg.id).catch(console.error);
          }, duration);

          return;
        }

        if (sub === "end") {
          const id = i.options.getString("id").trim();

          console.log("Manual giveaway end requested for ID:", id);
          console.log("Stored giveaway IDs:", Object.keys(giveaways));

          const g = giveaways[id];
          if (!g) {
            return i.reply({
              content: "Giveaway not found.",
              ephemeral: true,
            });
          }

          const result = await endGiveaway(id);

          if (!result.ok) {
            return i.reply({
              content: `Failed to end giveaway: ${result.message}`,
              ephemeral: true,
            });
          }

          return i.reply({
            content: `Giveaway \`${id}\` ended successfully.`,
            ephemeral: true,
          });
        }

        if (sub === "reroll") {
          const id = i.options.getString("id").trim();
          const result = await rerollGiveaway(id);

          if (!result.ok) {
            return i.reply({
              content: result.message,
              ephemeral: true,
            });
          }

          return i.reply({
            content: `New winner(s): ${result.winnersText}`,
            ephemeral: false,
          });
        }
      }

      if (i.commandName === "invites") {
        const user = i.options.getUser("user") || i.user;
        const stats = inviteData.users[user.id] || {
          joins: 0,
          leaves: 0,
          current: 0,
        };

        return i.reply({ embeds: [invitesEmbed(user, stats)] });
      }

      if (i.commandName === "invite") {
        const sub = i.options.getSubcommand();

        if (sub === "leaderboard") {
          const list = Object.entries(inviteData.users).sort(
            (a, b) => (b[1].current || 0) - (a[1].current || 0)
          );

          return i.reply({
            embeds: [leaderboardEmbed(i.guild, list.slice(0, 15))],
          });
        }
      }

      if (i.commandName === "reset") {
        const group = i.options.getSubcommandGroup();
        const sub = i.options.getSubcommand();

        if (group === "invite" && sub === "user") {
          const target = i.options.getUser("target");
          delete inviteData.users[target.id];

          for (const memberId of Object.keys(inviteData.members)) {
            if (inviteData.members[memberId] === target.id) {
              delete inviteData.members[memberId];
            }
          }

          save(INVITES_FILE, inviteData);

          return i.reply({
            content: `Invite stats reset for ${target}.`,
            ephemeral: true,
          });
        }

        if (group === "invite" && sub === "leaderboard") {
          inviteData = { users: {}, members: {} };
          save(INVITES_FILE, inviteData);

          return i.reply({
            content: "All invite data has been reset.",
            ephemeral: true,
          });
        }
      }
    }

    if (i.isButton()) {
      if (i.customId === "buy") {
        const existing = await findOpenTicketForUser(i.guild, i.user.id);
        if (existing) {
          return i.reply({
            content: `You already have an open ticket: ${existing}`,
            ephemeral: true,
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("buym")
          .setTitle("Purchase Ticket");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("p")
              .setLabel("What do you want to buy?")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("pay")
              .setLabel("Payment Method")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return i.showModal(modal);
      }

      if (i.customId === "sell") {
        const existing = await findOpenTicketForUser(i.guild, i.user.id);
        if (existing) {
          return i.reply({
            content: `You already have an open ticket: ${existing}`,
            ephemeral: true,
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("sellm")
          .setTitle("Seller Application");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("items")
              .setLabel("Items / Services")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("proof")
              .setLabel("Proof / Vouches")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );

        return i.showModal(modal);
      }

      if (i.customId === "report") {
        const existing = await findOpenTicketForUser(i.guild, i.user.id);
        if (existing) {
          return i.reply({
            content: `You already have an open ticket: ${existing}`,
            ephemeral: true,
          });
        }

        return createTicket(i, "Report", ["🚨 Scam / Problem report"]);
      }

      if (i.customId === "ticket_payments") {
        return i.reply({
          embeds: [paymentEmbed()],
          ephemeral: true,
        });
      }

      if (i.customId === "ticket_close") {
        if (!i.channel || !i.channel.topic?.startsWith("ticket:")) {
          return i.reply({
            content: "This is not a ticket channel.",
            ephemeral: true,
          });
        }

        const ownerId = getTicketOwnerIdFromTopic(i.channel.topic);
        const canClose = isStaff(i.member) || ownerId === i.user.id;

        if (!canClose) {
          return i.reply({
            content: "You do not have permission to close this ticket.",
            ephemeral: true,
          });
        }

        await i.reply({ content: "Closing ticket in 5 seconds..." });
        await closeTicketChannel(i.channel, i.user, "Closed using button");
        return;
      }

      if (i.customId === "join") {
        const g = ensureGiveawayShape(i.message.id);

        if (!g) {
          return i.reply({
            content: "This giveaway was not found.",
            ephemeral: true,
          });
        }

        if (g.ended) {
          return i.reply({
            content: "This giveaway has already ended.",
            ephemeral: true,
          });
        }

        if (Date.now() >= g.end) {
          await endGiveaway(i.message.id);
          return i.reply({
            content: "This giveaway has already ended.",
            ephemeral: true,
          });
        }

        if (g.users.includes(i.user.id)) {
          return i.reply({
            content: "You have already joined.",
            ephemeral: true,
          });
        }

        g.users.push(i.user.id);
        save(GIVEAWAYS_FILE, giveaways);

        await i.message.edit({
          embeds: [giveawayEmbed(g)],
          components: [giveawayJoinRow(false)],
        });

        return i.reply({
          content: "You joined the giveaway 🎉",
          ephemeral: true,
        });
      }
    }

    if (i.isModalSubmit()) {
      if (i.customId === "buym") {
        return createTicket(i, "Purchase", [
          `🛒 **Product:** ${i.fields.getTextInputValue("p")}`,
          `💳 **Payment:** ${i.fields.getTextInputValue("pay")}`,
        ]);
      }

      if (i.customId === "sellm") {
        return createTicket(i, "Seller", [
          `📦 **Items / Services:**`,
          i.fields.getTextInputValue("items"),
          "",
          `✅ **Proof / Vouches:**`,
          i.fields.getTextInputValue("proof"),
        ]);
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);

    if (i.deferred || i.replied) {
      await i.followUp({
        content: "An error happened while processing this interaction.",
        ephemeral: true,
      }).catch(() => null);
    } else {
      await i.reply({
        content: "An error happened while processing this interaction.",
        ephemeral: true,
      }).catch(() => null);
    }
  }
});

/* ================= TICKET ================= */
async function createTicket(i, type, data) {
  const existing = await findOpenTicketForUser(i.guild, i.user.id);
  if (existing) {
    return i.reply({
      content: `You already have an open ticket: ${existing}`,
      ephemeral: true,
    });
  }

  const baseName =
    type === "Purchase"
      ? `purchase-${i.user.username}`
      : type === "Seller"
      ? `seller-${i.user.username}`
      : `report-${i.user.username}`;

  const channelName = sanitizeChannelName(baseName);

  const channel = await i.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    topic: `ticket:${i.user.id}:${type}`,
    permissionOverwrites: [
      {
        id: i.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: i.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      {
        id: ADMIN_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  await channel.send({
    content: `${i.user} <@&${STAFF_ROLE_ID}>`,
    embeds: [ticketEmbed(type, data, i.user)],
    components: [paymentMethodsRow()],
  });

  await safeLogTicket(
    i.guild,
    new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("🎫 Ticket Opened")
      .setDescription(
        `**User:** ${i.user}\n**Type:** ${type}\n**Channel:** ${channel}`
      )
  );

  return i.reply({
    content: `Your ticket has been created: ${channel}`,
    ephemeral: true,
  });
}

async function closeTicketChannel(channel, closedByUser, reason = "Closed") {
  await safeLogTicket(
    channel.guild,
    new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("🎫 Ticket Closed")
      .setDescription(
        `**Channel:** ${channel.name}\n**Closed By:** ${closedByUser}\n**Reason:** ${reason}\n**Type:** ${getTicketTypeFromTopic(channel.topic)}`
      )
  );

  setTimeout(async () => {
    await channel.delete().catch(() => null);
  }, 5000);
}

/* ================= GIVEAWAY ================= */
async function endGiveaway(id) {
  try {
    const g = giveaways[id];

    if (!g) {
      return { ok: false, message: "Giveaway data not found in memory." };
    }

    if (!Array.isArray(g.users)) g.users = [];
    if (typeof g.winners !== "number" || g.winners < 1) g.winners = 1;
    if (typeof g.prize !== "string") g.prize = "Unknown Prize";
    if (typeof g.ended !== "boolean") g.ended = false;
    if (!Array.isArray(g.lastWinners)) g.lastWinners = [];
    if (!g.messageId) g.messageId = id;

    if (g.ended) {
      return { ok: true, message: "Already ended." };
    }

    const { channel, message } = await fetchGiveawayMessage(g);

    const winners = pickWinners(g.users, g.winners);
    g.ended = true;
    g.lastWinners = winners;
    save(GIVEAWAYS_FILE, giveaways);

    const winnersText = winners.length
      ? winners.map((x) => `<@${x}>`).join(", ")
      : "No valid participants";

    if (message) {
      await message.edit({
        embeds: [giveawayEmbed(g, true, winnersText)],
        components: [giveawayJoinRow(true)],
      }).catch((err) => {
        console.error("Failed to edit giveaway message:", err);
      });
    }

    if (channel && channel.isTextBased()) {
      await channel.send(
        winners.length
          ? `🎉 Giveaway ended!\nPrize: **${g.prize}**\nWinner(s): ${winnersText}`
          : `⏹️ Giveaway ended!\nPrize: **${g.prize}**\nNo participants joined.`
      ).catch((err) => {
        console.error("Failed to send giveaway result message:", err);
      });
    }

    return { ok: true, message: "Ended successfully." };
  } catch (error) {
    console.error("endGiveaway error:", error);
    return { ok: false, message: error.message || "Unknown error." };
  }
}

async function rerollGiveaway(id) {
  try {
    const g = ensureGiveawayShape(id);
    if (!g) {
      return { ok: false, message: "Giveaway not found." };
    }

    if (!g.users.length) {
      return { ok: false, message: "No participants to reroll from." };
    }

    const winners = pickWinners(g.users, g.winners);
    g.lastWinners = winners;
    save(GIVEAWAYS_FILE, giveaways);

    const winnersText = winners.map((x) => `<@${x}>`).join(", ");
    const { channel, message } = await fetchGiveawayMessage(g);

    if (message) {
      await message.edit({
        embeds: [giveawayEmbed(g, true, winnersText)],
        components: [giveawayJoinRow(true)],
      }).catch((err) => {
        console.error("Failed to edit reroll message:", err);
      });
    }

    if (channel && channel.isTextBased()) {
      await channel.send(`🔄 Giveaway rerolled!\nNew winner(s): ${winnersText}`).catch((err) => {
        console.error("Failed to send reroll result:", err);
      });
    }

    return { ok: true, winnersText };
  } catch (error) {
    console.error("rerollGiveaway error:", error);
    return { ok: false, message: error.message || "Unknown error." };
  }
}

/* ================= SAFETY LOGS ================= */
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

/* ================= LOGIN ================= */
if (!TOKEN) {
  console.error("TOKEN is missing in .env");
  process.exit(1);
}

client.login(TOKEN);
