require('dotenv').config();
const path = require('path');
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require('discord.js');
const { loadData, saveData } = require('./storage');

const AUTO_IMAGE_PATH = path.join(__dirname, 'assets', 'auto-image.png');

const {
  DISCORD_TOKEN,
  STAFF_ROLE_ID,
  VOUCHES_CHANNEL_ID,
  TICKET_CATEGORY_ID,
} = process.env;

// 🔧 FILL THIS IN: paste your "Customer" role ID here (Server Settings -> Roles ->
// right-click the role -> Copy Role ID). Anyone who gets sent a vouch request
// (via the ticket close button, /close with vouch on, or /vouch) is given this role.
// Leave it as-is (empty) to skip auto-role-assignment entirely.
const CUSTOMER_ROLE_ID = '1414705154996961320';

// 🔧 FILL THIS IN: paste your real payment account info for /info below.
// Leave any value as an empty string '' if you haven't set it up yet — the
// bot will politely say "no info set for this yet" instead of showing blank text.
const ACCOUNT_INFO = {
  Ado_Jhnam: {
    Binance: '993881216',
    PayPal: 'ahmdla9.ahmad@gmail.com',
  },
  Samix1977: {
    Binance: '1277606414',
    PayPal: '',
  },
};

// ---------- Basic config checks ----------
if (!DISCORD_TOKEN || !STAFF_ROLE_ID || !VOUCHES_CHANNEL_ID) {
  console.error(
    '❌ Missing required .env values. Make sure DISCORD_TOKEN, STAFF_ROLE_ID and VOUCHES_CHANNEL_ID are set.'
  );
  process.exit(1);
}

// ---------- Client setup ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, // needed to detect messages sent in server channels (for auto-image)
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent, // needed for /announce message_id: to read an existing message's text
  ],
  partials: [Partials.Channel, Partials.Message], // needed so DM channels/messages work
});

// Persistent storage (survives restarts) for the donation panel + auto-image channels
let data = loadData();
if (!data.giveaways) data.giveaways = {}; // safety net for older data.json files
if (!data.messageCounters) data.messageCounters = {}; // safety net for older data.json files

// In-memory timers for scheduled giveaway endings (message ID -> Timeout)
const giveawayTimers = new Map();

// ---------- Giveaway helpers ----------

// Parses strings like "30s", "10m", "2h", "1d" into milliseconds. Returns null if invalid.
function parseDuration(input) {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return amount * multipliers[unit];
}

// Returns the User objects (not GuildMembers) of everyone currently holding a role.
// Ensures the member cache is populated first so this works even on servers
// where not everyone is cached yet.
async function getRoleMemberUsers(guild, role) {
  await guild.members.fetch(); // populate cache
  const freshRole = guild.roles.cache.get(role.id) || role;
  return freshRole.members.map((member) => member.user);
}

// Small helper to pause between DMs so we don't trip Discord's spam detection.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Message counter helpers ----------

// 🔧 CUSTOMIZE ME: once you upload your logo, save it as
// assets/counter-logo.png and this will start using it automatically.
const COUNTER_LOGO_PATH = path.join(__dirname, 'assets', 'counter-logo.png');

// Builds the counter panel embed. Falls back gracefully (no image) if
// the logo file hasn't been added to assets/ yet, so this never crashes.
function buildCounterEmbed(count) {
  const embed = new EmbedBuilder()
    .setTitle('🧾 Total Vouches')
    .setDescription(`# ${count}`)
    .setColor(0x000000) // matches the logo's black background
    .setTimestamp();

  if (fs.existsSync(COUNTER_LOGO_PATH)) {
    // Shown as a large image (not a thumbnail) so the "LEGIT SHOP" wordmark stays readable.
    embed.setImage('attachment://counter-logo.png');
  }

  return embed;
}

// Sends the counter panel, attaching the logo file if it exists.
async function sendCounterPanel(channel, count) {
  const embed = buildCounterEmbed(count);
  const files = fs.existsSync(COUNTER_LOGO_PATH)
    ? [new AttachmentBuilder(COUNTER_LOGO_PATH, { name: 'counter-logo.png' })]
    : [];
  return channel.send({ embeds: [embed], files });
}

// Counts every message already in a channel's history (used when /counter
// enable is turned on, so it picks up past vouches instead of starting at 0).
// This can take a little while on channels with a lot of history.
async function countChannelHistory(channel) {
  let count = 0;
  let beforeId;

  while (true) {
    const options = { limit: 100 };
    if (beforeId) options.before = beforeId;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    count += batch.size;
    beforeId = batch.last().id;

    if (batch.size < 100) break;
  }

  return count;
}

// Bumps a channel's live counter by 1. Deletes the old panel message and
// sends a fresh one, so the counter always stays the newest message in the
// channel instead of getting buried under new messages.
async function bumpMessageCounter(channelId) {
  const counter = data.messageCounters[channelId];
  if (!counter) return;

  counter.count += 1;

  try {
    const channel = await client.channels.fetch(channelId);

    const oldMessage = await channel.messages.fetch(counter.messageId).catch(() => null);
    if (oldMessage) await oldMessage.delete().catch(() => {});

    const newMessage = await sendCounterPanel(channel, counter.count);
    counter.messageId = newMessage.id;
    saveData(data);
  } catch (err) {
    console.error('Failed to update message counter:', err.message);
  }
}

// ---------- Ticket & vouch helpers ----------

// True if this guild member is allowed to run staff-only commands (has the
// staff role, or has the Administrator permission).
function isStaffMember(member) {
  return (
    member.roles.cache.has(STAFF_ROLE_ID) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

// Finds the customer's user ID for a ticket channel by looking at who has an
// explicit permission overwrite that isn't the staff role, the bot, or @everyone.
// Returns null if this doesn't look like a ticket channel.
function findTicketCustomerId(channel) {
  const overwrite = channel.permissionOverwrites.cache.find(
    (ow) =>
      ow.id !== STAFF_ROLE_ID &&
      ow.id !== client.user.id &&
      ow.id !== channel.guild.roles.everyone.id
  );
  return overwrite ? overwrite.id : null;
}

// DMs a user a "Leave a Vouch" prompt with a button. Clicking it opens a modal
// asking for Product, Payment Method, and Rating/Comment, which then gets
// posted to the vouches channel. Also gives them the Customer role (if
// CUSTOMER_ROLE_ID is filled in). Throws if the DM can't be sent (caller should catch).
async function sendVouchRequest(user, guild) {
  const embed = new EmbedBuilder()
    .setTitle('Leave a Vouch <a:Steve_Crouch:1437910633239806102>')
    .setDescription('Are we Legit <a:868474901927985232:1438809742351925350>? Click the button below to leave a vouch.')
    .setColor(0xffd700);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_vouch_modal')
      .setLabel('Vouch')
      .setEmoji({ id: '1452240265808183316', name: 'clapping', animated: true })
      .setStyle(ButtonStyle.Primary)
  );

  await user.send({ embeds: [embed], components: [row] });

  if (CUSTOMER_ROLE_ID && guild) {
    try {
      const member = await guild.members.fetch(user.id);
      await member.roles.add(CUSTOMER_ROLE_ID);
    } catch (err) {
      console.error('Could not assign Customer role:', err.message);
    }
  }
}

// ---------- Announce helper ----------
// Sends `content` (verbatim, plain text — no embed) as a DM to every target user,
// with a small subtext line at the end crediting who sent it.
// Waits ~1 second between each DM to avoid Discord's anti-spam rate limiting/flagging.
// Returns { sentCount, failedCount }.
async function sendAnnouncementDMs(content, targetUsers, senderId) {
  const fullMessage = `${content}\n\n-# Sent by <@${senderId}>`;
  let sentCount = 0;
  let failedCount = 0;

  for (const user of targetUsers) {
    if (user.bot) continue; // never DM bots
    try {
      await user.send({ content: fullMessage });
      sentCount++;
    } catch (err) {
      failedCount++;
    }
    await sleep(1000); // ~1s pause between each DM
  }

  return { sentCount, failedCount };
}
// Fisher-Yates shuffle, then take the first `count` entries as winners.
function pickWinners(entries, count) {
  const pool = [...entries];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function buildGiveawayEmbed(giveaway, { ended = false, winners = [] } = {}) {
  const embed = new EmbedBuilder()
    .setTitle(ended ? '🎉 GIVEAWAY ENDED 🎉' : '🎉 GIVEAWAY 🎉')
    .setColor(ended ? 0x000000 : 0xBCC6CC)
    .setFooter({ text: `Entries: ${giveaway.entries.length}` })
    .setTimestamp();

  if (ended) {
    const winnerText =
      winners.length > 0
        ? winners.map((id) => `<@${id}>`).join(', ')
        : 'No valid entries, no winner could be picked.';
    embed.setDescription(
      `# Prize: ${giveaway.prize}\n\n` +
        `## 🏆 Winners: ${winnerText}\n` +
        `## 👤 Hosted by: <@${giveaway.hostId}>\n\n` +
        `### This giveaway has ended. Thanks to everyone who entered!`
    );
  } else {
    const endUnix = Math.floor(giveaway.endTime / 1000);
    embed.setDescription(
      `# <a:Giveaway1:1454881610724937845> Prize: ${giveaway.prize}\n\n` +
        `## 🏆 Winners: ${giveaway.winnersCount}\n` +
        `## 👤 Hosted by: <@${giveaway.hostId}>\n` +
        `## ⏰ Ends: <t:${endUnix}:R>\n\n` +
        `### Click the button below to enter! <a:Giveaway1:1454881610724937845>`
    );
  }

  return embed;
}

async function endGiveaway(messageId) {
  const giveaway = data.giveaways[messageId];
  if (!giveaway || giveaway.ended) return;

  const timer = giveawayTimers.get(messageId);
  if (timer) {
    clearTimeout(timer);
    giveawayTimers.delete(messageId);
  }

  giveaway.ended = true;

  const winners = pickWinners(giveaway.entries, giveaway.winnersCount);
  giveaway.winners = winners;
  saveData(data);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(messageId);

    const endedEmbed = buildGiveawayEmbed(giveaway, { ended: true, winners });
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter_${messageId}`)
        .setLabel('Enter')
        .setEmoji({ id: '1454881610724937845', name: 'Giveaway1', animated: true })
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await message.edit({ embeds: [endedEmbed], components: [disabledRow] });

    if (winners.length > 0) {
      await channel.send(
        `<a:Giveaway1:1454881610724937845> Congratulations ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
      );
    } else {
      await channel.send(`😕 No one entered the giveaway for **${giveaway.prize}**, so no winner could be picked.`);
    }
  } catch (err) {
    console.error('Failed to finalize giveaway message:', err.message);
  }
}

function scheduleGiveawayEnd(messageId) {
  const giveaway = data.giveaways[messageId];
  if (!giveaway || giveaway.ended) return;

  const remaining = giveaway.endTime - Date.now();
  const timer = setTimeout(() => {
    endGiveaway(messageId).catch((err) => console.error('Giveaway auto-end error:', err.message));
  }, Math.max(remaining, 0));

  giveawayTimers.set(messageId, timer);
}

// ---------- Ready ----------
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Resume any giveaways that were still running when the bot last stopped.
  for (const messageId of Object.keys(data.giveaways)) {
    const giveaway = data.giveaways[messageId];
    if (!giveaway.ended) {
      scheduleGiveawayEnd(messageId);
    }
  }
});

// ---------- Interaction handling ----------
client.on('interactionCreate', async (interaction) => {
  try {
    // ----- Slash command: /panel -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      const embed = new EmbedBuilder()
        .setTitle('🎫 Open a Ticket')
        .setDescription(
          'Click the button below to open a ticket.\nYou will be asked what product you want to buy and how you plan to pay.'
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('Open Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ content: 'Ticket panel posted ✅', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return;
    }

    // ----- Slash command: /donationpanel -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'donationpanel') {
      const embed = new EmbedBuilder()
        .setTitle('💸 Collected Donations')
        .setDescription('# 0')
        .setColor(0x2ecc71)
        .setTimestamp();

      const panelMessage = await interaction.channel.send({ embeds: [embed] });

      data.donationPanel = {
        channelId: interaction.channel.id,
        messageId: panelMessage.id,
        value: '0',
      };
      saveData(data);

      await interaction.reply({
        content: '✅ Donation panel posted <a:1376671734870179980:1438807905443778560> Use `/setdonations` to update it.',
        ephemeral: true,
      });
      return;
    }

    // ----- Slash command: /setdonations -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'setdonations') {
      const newValue = interaction.options.getString('value', true);

      if (!data.donationPanel) {
        await interaction.reply({
          content: '❌ No donation panel exists yet. Run `/donationpanel` first.',
          ephemeral: true,
        });
        return;
      }

      const { channelId, messageId } = data.donationPanel;

      try {
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
          .setDescription(`# ${newValue}\n **Thank you <:cute:1455104071206965442>**`)
          .setTimestamp();

        await message.edit({ embeds: [updatedEmbed] });

        data.donationPanel.value = newValue;
        saveData(data);

        await interaction.reply({
          content: `✅ Donation panel updated to **${newValue}**`,
          ephemeral: true,
        });
      } catch (err) {
        console.error('Failed to update donation panel:', err.message);
        await interaction.reply({
          content:
            '❌ Could not find the donation panel message (it may have been deleted). Run `/donationpanel` again to make a new one.',
          ephemeral: true,
        });
      }
      return;
    }

    // ----- Slash command: /autoimage enable | disable -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'autoimage') {
      const sub = interaction.options.getSubcommand();
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (sub === 'enable') {
        if (!data.autoImageChannels.includes(targetChannel.id)) {
          data.autoImageChannels.push(targetChannel.id);
          saveData(data);
        }
        await interaction.reply({
          content: `✅ Auto-image enabled in ${targetChannel}. I'll post the image after every message sent there.`,
          ephemeral: true,
        });
        return;
      }

      if (sub === 'disable') {
        data.autoImageChannels = data.autoImageChannels.filter(
          (id) => id !== targetChannel.id
        );
        saveData(data);
        await interaction.reply({
          content: `✅ Auto-image disabled in ${targetChannel}.`,
          ephemeral: true,
        });
        return;
      }
    }

    // ----- Slash command: /counter enable | disable -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'counter') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (sub === 'enable') {
        if (data.messageCounters[targetChannel.id]) {
          await interaction.reply({
            content: `❌ A counter is already running in ${targetChannel}.`,
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: `⏳ Counting existing messages in ${targetChannel}, one moment...`,
          ephemeral: true,
        });

        const existingCount = await countChannelHistory(targetChannel);
        const counterMessage = await sendCounterPanel(targetChannel, existingCount);

        data.messageCounters[targetChannel.id] = {
          messageId: counterMessage.id,
          count: existingCount,
        };
        saveData(data);

        await interaction.editReply({
          content: `✅ Counter started in ${targetChannel}, starting from **${existingCount}** existing messages.`,
        });
        return;
      }

      if (sub === 'disable') {
        if (!data.messageCounters[targetChannel.id]) {
          await interaction.reply({
            content: `❌ There's no counter running in ${targetChannel}.`,
            ephemeral: true,
          });
          return;
        }

        delete data.messageCounters[targetChannel.id];
        saveData(data);

        await interaction.reply({
          content: `✅ Counter stopped in ${targetChannel} (the last count stays visible).`,
          ephemeral: true,
        });
        return;
      }
    }

    // ----- Slash command: /giveaway start -----
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'giveaway' &&
      interaction.options.getSubcommand() === 'start'
    ) {
      const prize = interaction.options.getString('prize', true);
      const durationInput = interaction.options.getString('duration', true);
      const winnersCount = interaction.options.getInteger('winners', true);
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      const durationMs = parseDuration(durationInput);
      if (!durationMs) {
        await interaction.reply({
          content: '❌ Invalid duration. Use a number + s/m/h/d, e.g. `30s`, `10m`, `2h`, `1d`.',
          ephemeral: true,
        });
        return;
      }

      if (winnersCount < 1) {
        await interaction.reply({
          content: '❌ Winners must be at least 1.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({ content: '✅ Giveaway started!', ephemeral: true });

      const endTime = Date.now() + durationMs;

      const placeholderEmbed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription('Setting up...')
        .setColor(0xBCC6CC);

      const giveawayMessage = await targetChannel.send({ embeds: [placeholderEmbed] });

      const giveaway = {
        prize,
        winnersCount,
        hostId: interaction.user.id,
        channelId: targetChannel.id,
        endTime,
        entries: [],
        ended: false,
        winners: [],
      };

      data.giveaways[giveawayMessage.id] = giveaway;
      saveData(data);

      const enterRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_${giveawayMessage.id}`)
          .setLabel('Enter')
          .setEmoji({ id: '1454881610724937845', name: 'Giveaway1', animated: true })
          .setStyle(ButtonStyle.Primary)
      );

      await giveawayMessage.edit({
        embeds: [buildGiveawayEmbed(giveaway)],
        components: [enterRow],
      });

      scheduleGiveawayEnd(giveawayMessage.id);
      return;
    }

    // ----- Slash command: /giveaway end -----
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'giveaway' &&
      interaction.options.getSubcommand() === 'end'
    ) {
      const messageId = interaction.options.getString('message_id', true);
      const giveaway = data.giveaways[messageId];

      if (!giveaway) {
        await interaction.reply({ content: '❌ No giveaway found with that message ID.', ephemeral: true });
        return;
      }
      if (giveaway.ended) {
        await interaction.reply({ content: '❌ That giveaway has already ended.', ephemeral: true });
        return;
      }

      await endGiveaway(messageId);
      await interaction.reply({ content: '✅ Giveaway ended early.', ephemeral: true });
      return;
    }

    // ----- Slash command: /giveaway reroll -----
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'giveaway' &&
      interaction.options.getSubcommand() === 'reroll'
    ) {
      const messageId = interaction.options.getString('message_id', true);
      const giveaway = data.giveaways[messageId];

      if (!giveaway) {
        await interaction.reply({ content: '❌ No giveaway found with that message ID.', ephemeral: true });
        return;
      }
      if (!giveaway.ended) {
        await interaction.reply({
          content: '❌ That giveaway hasn\'t ended yet — use `/giveaway end` first.',
          ephemeral: true,
        });
        return;
      }

      const newWinners = pickWinners(giveaway.entries, giveaway.winnersCount);
      giveaway.winners = newWinners;
      saveData(data);

      try {
        const channel = await client.channels.fetch(giveaway.channelId);
        if (newWinners.length > 0) {
          await channel.send(
            `🔄 New winner(s) for **${giveaway.prize}**: ${newWinners.map((id) => `<@${id}>`).join(', ')}!`
          );
        } else {
          await channel.send(`🔄 Reroll for **${giveaway.prize}** — no valid entries to pick from.`);
        }
      } catch (err) {
        console.error('Failed to send reroll announcement:', err.message);
      }

      await interaction.reply({ content: '✅ Rerolled!', ephemeral: true });
      return;
    }

    // ----- Button: Enter Giveaway -----
    if (interaction.isButton() && interaction.customId.startsWith('giveaway_enter_')) {
      const messageId = interaction.customId.replace('giveaway_enter_', '');
      const giveaway = data.giveaways[messageId];

      if (!giveaway || giveaway.ended) {
        await interaction.reply({ content: '❌ This giveaway has ended.', ephemeral: true });
        return;
      }

      if (giveaway.entries.includes(interaction.user.id)) {
        await interaction.reply({ content: '✅ You\'re already entered in this giveaway!', ephemeral: true });
        return;
      }

      giveaway.entries.push(interaction.user.id);
      saveData(data);

      await interaction.reply({ content: '🎉 You\'re entered! Good luck!', ephemeral: true });

      try {
        await interaction.message.edit({ embeds: [buildGiveawayEmbed(giveaway)] });
      } catch (err) {
        console.error('Failed to update giveaway entry count:', err.message);
      }
      return;
    }

    // ----- Slash command: /announce -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'announce') {
      const targetUser = interaction.options.getUser('user');
      const targetRole = interaction.options.getRole('role');
      const messageId = interaction.options.getString('message_id');

      if (!targetUser && !targetRole) {
        await interaction.reply({
          content: '❌ You need to pick either a `user` or a `role` to send this to.',
          ephemeral: true,
        });
        return;
      }
      if (targetUser && targetRole) {
        await interaction.reply({
          content: '❌ Pick only one: a `user` OR a `role`, not both.',
          ephemeral: true,
        });
        return;
      }

      // ----- Path 1: message_id given -> copy that message's text directly, no form -----
      if (messageId) {
        await interaction.deferReply({ ephemeral: true });

        let sourceMessage;
        try {
          sourceMessage = await interaction.channel.messages.fetch(messageId);
        } catch (err) {
          await interaction.editReply({
            content: '❌ Could not find a message with that ID in this channel.',
          });
          return;
        }

        if (!sourceMessage.content) {
          await interaction.editReply({
            content: '❌ That message has no text content to copy (it may be embed/attachment only).',
          });
          return;
        }

        const targetUsers = targetUser
          ? [targetUser]
          : [...(await getRoleMemberUsers(interaction.guild, targetRole))];

        const { sentCount, failedCount } = await sendAnnouncementDMs(
          sourceMessage.content,
          targetUsers,
          interaction.user.id
        );

        await interaction.editReply({
          content: `✅ Announcement sent to **${sentCount}** user(s).${
            failedCount > 0 ? ` ⚠️ Failed to DM **${failedCount}** (likely DMs closed).` : ''
          }`,
        });
        return;
      }

      // ----- Path 2: no message_id -> pop up a form to type the message -----
      const targetType = targetUser ? 'user' : 'role';
      const targetId = targetUser ? targetUser.id : targetRole.id;

      const modal = new ModalBuilder()
        .setCustomId(`announce_modal:${targetType}:${targetId}`)
        .setTitle('Write your announcement');

      const messageInput = new TextInputBuilder()
        .setCustomId('announce_message_input')
        .setLabel('Message (exact text, lines & emojis kept as-is)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(3900); // leaves room for the "Sent by" line under Discord's 4000 char DM limit

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

      await interaction.showModal(modal);
      return;
    }

    // ----- Modal submit: /announce message form -----
    if (interaction.isModalSubmit() && interaction.customId.startsWith('announce_modal:')) {
      await interaction.deferReply({ ephemeral: true });

      const [, targetType, targetId] = interaction.customId.split(':');
      const content = interaction.fields.getTextInputValue('announce_message_input');

      let targetUsers;
      if (targetType === 'user') {
        try {
          targetUsers = [await client.users.fetch(targetId)];
        } catch (err) {
          await interaction.editReply({ content: '❌ Could not find that user anymore.' });
          return;
        }
      } else {
        const role = await interaction.guild.roles.fetch(targetId).catch(() => null);
        if (!role) {
          await interaction.editReply({ content: '❌ Could not find that role anymore.' });
          return;
        }
        targetUsers = [...(await getRoleMemberUsers(interaction.guild, role))];
      }

      const { sentCount, failedCount } = await sendAnnouncementDMs(
        content,
        targetUsers,
        interaction.user.id
      );

      await interaction.editReply({
        content: `✅ Announcement sent to **${sentCount}** user(s).${
          failedCount > 0 ? ` ⚠️ Failed to DM **${failedCount}** (likely DMs closed).` : ''
        }`,
      });
      return;
    }

    // ----- Slash command: /come -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'come') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      const customerId = findTicketCustomerId(interaction.channel);
      if (!customerId) {
        await interaction.reply({
          content: '❌ This command can only be used inside a ticket channel.',
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString('reason');

      try {
        const customerUser = await client.users.fetch(customerId);
        const embed = new EmbedBuilder()
          .setTitle('📣 Please come back to your ticket')
          .setDescription(
            `<@${interaction.user.id}> is asking you to come back to ${interaction.channel} in **${interaction.guild.name}**.` +
              (reason ? `\n\n**Reason:** ${reason}` : '')
          )
          .setColor(0x5865f2);

        await customerUser.send({ embeds: [embed] });
        await interaction.reply({
          content: `✅ Asked ${customerUser} to come back to the ticket.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error('Could not DM customer for /come:', err.message);
        await interaction.reply({
          content: '❌ Could not DM that user (they may have DMs closed).',
          ephemeral: true,
        });
      }
      return;
    }

    // ----- Slash command: /close -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'close') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      const customerId = findTicketCustomerId(interaction.channel);
      if (!customerId) {
        await interaction.reply({
          content: '❌ This command can only be used inside a ticket channel.',
          ephemeral: true,
        });
        return;
      }

      const withVouch = interaction.options.getBoolean('vouch') ?? true;
      const channel = interaction.channel;

      await interaction.reply('🔒 Closing this ticket in 5 seconds...');

      // Only DM the customer when a vouch is actually being requested — if
      // vouch is off, close silently with no DM at all.
      if (withVouch) {
        try {
          const customerUser = await client.users.fetch(customerId);
          await sendVouchRequest(customerUser, interaction.guild);
        } catch (err) {
          console.error('Could not DM customer on /close:', err.message);
        }
      }

      setTimeout(() => {
        channel.delete().catch((err) =>
          console.error('Failed to delete ticket channel:', err.message)
        );
      }, 5000);
      return;
    }

    // ----- Slash command: /vouch -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'vouch') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser('user', true);

      try {
        await sendVouchRequest(targetUser, interaction.guild);
        await interaction.reply({
          content: `✅ Sent a vouch request to ${targetUser}.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error('Could not DM user for /vouch:', err.message);
        await interaction.reply({
          content: '❌ Could not DM that user (they may have DMs closed).',
          ephemeral: true,
        });
      }
      return;
    }

    // ----- Button: Leave a Vouch -> show modal -----
    if (interaction.isButton() && interaction.customId === 'open_vouch_modal') {
      const modal = new ModalBuilder().setCustomId('vouch_modal').setTitle('Leave a Vouch');

      const productInput = new TextInputBuilder()
        .setCustomId('vouch_product_input')
        .setLabel('Product / Service')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('what did you buy/sell')
        .setRequired(true)
        .setMaxLength(200);

      const paymentInput = new TextInputBuilder()
        .setCustomId('vouch_payment_input')
        .setLabel('Payment Method')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('what did you pay with?')
        .setRequired(true)
        .setMaxLength(200);

      const ratingInput = new TextInputBuilder()
        .setCustomId('vouch_rating_input')
        .setLabel('Rating / Comment')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Legit and Fast')
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(productInput),
        new ActionRowBuilder().addComponents(paymentInput),
        new ActionRowBuilder().addComponents(ratingInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // ----- Modal submit: vouch -----
    if (interaction.isModalSubmit() && interaction.customId === 'vouch_modal') {
      await interaction.deferReply({ ephemeral: true });

      const product = interaction.fields.getTextInputValue('vouch_product_input');
      const payment = interaction.fields.getTextInputValue('vouch_payment_input');
      const rating = interaction.fields.getTextInputValue('vouch_rating_input');

      const vouchesChannel = await client.channels.fetch(VOUCHES_CHANNEL_ID).catch(() => null);
      if (!vouchesChannel) {
        console.error('Could not find the vouches channel. Check VOUCHES_CHANNEL_ID.');
        await interaction.editReply({ content: '❌ Something went wrong on our end. Please try again later.' });
        return;
      }

      const vouchEmbed = new EmbedBuilder()
        .setTitle('New Vouch')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: 'Customer', value: `<@${interaction.user.id}>` },
          { name: 'Product', value: product },
          { name: 'Payment Method', value: payment },
          { name: 'Rating / Comment', value: rating }
        )
        .setColor(0xffd700)
        .setTimestamp();

      await vouchesChannel.send({ embeds: [vouchEmbed] });

      await interaction.editReply({
        content:
          '<a:1210517188121858058:1438856413626630184> Done, thank you for your feedback <:cute:1455104071206965442>!',
      });
      return;
    }

    // ----- Slash command: /add -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'add') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      if (!findTicketCustomerId(interaction.channel)) {
        await interaction.reply({
          content: '❌ This command can only be used inside a ticket channel.',
          ephemeral: true,
        });
        return;
      }

      const userToAdd = interaction.options.getUser('user', true);

      try {
        await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        await interaction.reply(`✅ ${userToAdd} has been added to the ticket by ${interaction.user}.`);
      } catch (err) {
        console.error('Failed to add user to ticket:', err.message);
        await interaction.reply({ content: '❌ Something went wrong adding that user.', ephemeral: true });
      }
      return;
    }

    // ----- Slash command: /rename -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'rename') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      if (!findTicketCustomerId(interaction.channel)) {
        await interaction.reply({
          content: '❌ This command can only be used inside a ticket channel.',
          ephemeral: true,
        });
        return;
      }

      const rawName = interaction.options.getString('name', true);
      const cleanName = rawName.toLowerCase().replace(/\s+/g, '-').slice(0, 90);

      try {
        await interaction.channel.setName(cleanName);
        await interaction.reply({ content: `✅ Ticket renamed to **${cleanName}**.`, ephemeral: true });
      } catch (err) {
        console.error('Failed to rename ticket:', err.message);
        await interaction.reply({ content: '❌ Something went wrong renaming this ticket.', ephemeral: true });
      }
      return;
    }

    // ----- Slash command: /info -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'info') {
      if (!isStaffMember(interaction.member)) {
        await interaction.reply({ content: '❌ Only staff can use this command.', ephemeral: true });
        return;
      }

      const account = interaction.options.getString('account', true);
      const method = interaction.options.getString('method', true);
      const value = ACCOUNT_INFO[account]?.[method];

      if (!value) {
        await interaction.reply({
          content: `❌ No info has been set for **${account} / ${method}** yet.`,
          ephemeral: true,
        });
        return;
      }

      let block;
      if (method === 'Binance') {
        block = `<:Binance:1430875529539489932> Binance\nUser : ${account}\nID : ${value}`;
      } else if (method === 'PayPal') {
        block = `<:Paypal:1430875512221339680> Paypal\nUser : ${account}\nEmail : ${value}`;
      } else {
        block = `${method}\nUser : ${account}\n${value}`;
      }

      // Public reply — visible to everyone in the channel.
      await interaction.reply({ content: block });
      return;
    }

    // ----- Slash command: /donatepanel -----
    if (interaction.isChatInputCommand() && interaction.commandName === 'donatepanel') {
      const embed = new EmbedBuilder()
        .setTitle('💝 Donate Here')
        .setDescription(
          'Click the button below to open a donation ticket.'
        )
        .setColor(0xe91e63);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_donation_ticket')
          .setLabel('Donate')
          .setEmoji('💝')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ content: 'Donation panel posted ✅', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return;
    }

    // ----- Button: Open Donation Ticket -> show modal -----
    if (interaction.isButton() && interaction.customId === 'open_donation_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('donation_ticket_modal')
        .setTitle('Open a Donation Ticket');

      const amountInput = new TextInputBuilder()
        .setCustomId('amount_input')
        .setLabel('What would you like to Donate?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('put the item name here')
        .setRequired(true)
        .setMaxLength(200);

      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

      await interaction.showModal(modal);
      return;
    }

    // ----- Modal submit: create donation ticket channel -----
    if (interaction.isModalSubmit() && interaction.customId === 'donation_ticket_modal') {
      await interaction.deferReply({ ephemeral: true });

      const amount = interaction.fields.getTextInputValue('amount_input');
      const guild = interaction.guild;
      const member = interaction.member;

      const channelOptions = {
        name: `donation-${member.user.username}`.toLowerCase().slice(0, 90),
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      };

      if (TICKET_CATEGORY_ID) {
        channelOptions.parent = TICKET_CATEGORY_ID;
      }

      const ticketChannel = await guild.channels.create(channelOptions);

      const infoEmbed = new EmbedBuilder()
        .setTitle('💝 New Donation Ticket')
        .setColor(0xe91e63)
        .addFields(
          { name: 'Donator', value: `<@${member.id}>`, inline: true },
          { name: 'Amount', value: `${amount}` }
        )
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_donation_ticket')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `<@${member.id}> <@&${STAFF_ROLE_ID}>`,
        embeds: [infoEmbed],
        components: [closeRow],
      });

      await interaction.editReply({
        content: `✅ Your donation ticket has been created: ${ticketChannel}`,
      });
      return;
    }

    // ----- Button: Open Ticket -> show modal -----
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Open a Ticket');

      const productInput = new TextInputBuilder()
        .setCustomId('product_input')
        .setLabel('What product do you want to buy?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Put the product name...')
        .setRequired(true)
        .setMaxLength(500);

      const paymentInput = new TextInputBuilder()
        .setCustomId('payment_input')
        .setLabel('What will you pay with?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Money / Gold / Redblocks / Sky1Notchs...')
        .setRequired(true)
        .setMaxLength(200);

      modal.addComponents(
        new ActionRowBuilder().addComponents(productInput),
        new ActionRowBuilder().addComponents(paymentInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // ----- Modal submit: create ticket channel -----
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
      await interaction.deferReply({ ephemeral: true });

      const product = interaction.fields.getTextInputValue('product_input');
      const payment = interaction.fields.getTextInputValue('payment_input');
      const guild = interaction.guild;
      const member = interaction.member;

      const channelOptions = {
        name: `ticket-${member.user.username}`.toLowerCase().slice(0, 90),
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      };

      if (TICKET_CATEGORY_ID) {
        channelOptions.parent = TICKET_CATEGORY_ID;
      }

      const ticketChannel = await guild.channels.create(channelOptions);

      const infoEmbed = new EmbedBuilder()
        .setTitle('🎫 New Ticket')
        .setColor(0x57f287)
        .addFields(
          { name: 'Customer', value: `<@${member.id}>`, inline: true },
          { name: 'Product', value: `${product}` },
          { name: 'Payment Method', value: `${payment}` }
        )
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `<@${member.id}> <@&${STAFF_ROLE_ID}>`,
        embeds: [infoEmbed],
        components: [closeRow],
      });

      await interaction.editReply({
        content: `✅ Your ticket has been created: ${ticketChannel}`,
      });
      return;
    }

    // ----- Button: Close Ticket -----
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      const isStaff =
        interaction.member.roles.cache.has(STAFF_ROLE_ID) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isStaff) {
        await interaction.reply({
          content: '❌ Only staff can close this ticket.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply('🔒 Closing this ticket in 5 seconds...');

      const channel = interaction.channel;
      const customerId = findTicketCustomerId(channel);

      if (customerId) {
        try {
          const customerUser = await client.users.fetch(customerId);
          await sendVouchRequest(customerUser, interaction.guild);
        } catch (err) {
          console.error('Could not DM customer (they may have DMs closed):', err.message);
        }
      }

      setTimeout(() => {
        channel.delete().catch((err) =>
          console.error('Failed to delete ticket channel:', err.message)
        );
      }, 5000);
      return;
    }

    // ----- Button: Close Donation Ticket -----
    if (interaction.isButton() && interaction.customId === 'close_donation_ticket') {
      const isStaff =
        interaction.member.roles.cache.has(STAFF_ROLE_ID) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isStaff) {
        await interaction.reply({
          content: '❌ Only staff can close this ticket.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply('🔒 Closing this ticket in 5 seconds...');

      const channel = interaction.channel;
      const customerId = findTicketCustomerId(channel);

      if (customerId) {
        try {
          const customerUser = await client.users.fetch(customerId);

          const dmEmbed = new EmbedBuilder()
            .setTitle('Your donation ticket has been closed')
            .setDescription('**Thank you for your donation <:cute:1455104071206965442>**')
            .setColor(0xe91e63);

          await customerUser.send({ embeds: [dmEmbed] });
        } catch (err) {
          console.error('Could not DM customer (they may have DMs closed):', err.message);
        }
      }

      setTimeout(() => {
        channel.delete().catch((err) =>
          console.error('Failed to delete donation ticket channel:', err.message)
        );
      }, 5000);
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '⚠️ Something went wrong, please try again.', ephemeral: true })
        .catch(() => {});
    }
  }
});

// ---------- Message handling (auto-image + message counter) ----------
client.on('messageCreate', async (message) => {
  // ----- Message counter: counts every message, including the bot's own -----
  // (so vouch embeds posted by the bot into a counted channel are included).
  // Recognizes the counter panel's own re-posts by their embed title (not by
  // ID/timing, which can race against the gateway event) so it never counts itself.
  const activeCounter = data.messageCounters[message.channel.id];
  const isCounterPanelItself =
    message.author.id === client.user.id && message.embeds[0]?.title === '🧾 Total Vouches';

  if (message.guild && activeCounter && !isCounterPanelItself) {
    bumpMessageCounter(message.channel.id).catch((err) =>
      console.error('Message counter error:', err.message)
    );
  }

  if (message.author.bot) return;

  // ----- Auto-image: post the image after every message in enabled channels -----
  if (message.guild && data.autoImageChannels.includes(message.channel.id)) {
    try {
      const attachment = new AttachmentBuilder(AUTO_IMAGE_PATH);
      await message.channel.send({ files: [attachment] });
    } catch (err) {
      console.error('Failed to send auto-image:', err.message);
    }
  }

});

client.login(DISCORD_TOKEN);