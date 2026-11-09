require('dotenv').config();
const { REST, Routes, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    '❌ Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in your .env file. Fill those in first.'
  );
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post the ticket panel in this channel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('donatepanel')
    .setDescription('Post the donation ticket panel in this channel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('donationpanel')
    .setDescription('Post the "Collected Donations" panel in this channel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('setdonations')
    .setDescription('Update the donation panel value (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('value')
        .setDescription('The value to show, e.g. "12$" or "$500" or "1.2k"')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('autoimage')
    .setDescription('Turn on/off auto-posting an image after every message in a channel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable auto-image in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to enable it in (defaults to current channel)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable auto-image in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to disable it in (defaults to current channel)')
            .setRequired(false)
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('counter')
    .setDescription('Live message counter for a channel (staff only)')
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Start counting messages in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to count in (defaults to current channel)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Stop counting messages in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to stop counting in (defaults to current channel)')
            .setRequired(false)
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption((option) =>
          option.setName('prize').setDescription('What is being given away').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('duration')
            .setDescription('How long it runs, e.g. 30s, 10m, 2h, 1d')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('winners')
            .setDescription('How many winners to pick')
            .setRequired(true)
            .setMinValue(1)
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to post it in (defaults to current channel)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('The giveaway message ID (right-click the giveaway message -> Copy Message ID)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Pick new winner(s) for an ended giveaway')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('The giveaway message ID (right-click the giveaway message -> Copy Message ID)')
            .setRequired(true)
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('DM a message to a user or everyone with a role (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option.setName('user').setDescription('Send to this specific user').setRequired(false)
    )
    .addRoleOption((option) =>
      option.setName('role').setDescription('Send to everyone with this role').setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('message_id')
        .setDescription('Copy the exact text of an existing message in this channel instead of typing new text')
        .setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('come')
    .setDescription('DM the ticket customer asking them to come back (staff only, use inside a ticket)')
    .addStringOption((option) =>
      option.setName('reason').setDescription('Why they should come back (optional)').setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close this ticket, with an option to request a vouch (staff only, use inside a ticket)')
    .addBooleanOption((option) =>
      option
        .setName('vouch')
        .setDescription('Ask the customer for a vouch after closing? (default: yes)')
        .setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Send a vouch request DM to a user (staff only)')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to ask for a vouch').setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to this ticket (staff only, use inside a ticket)')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to add').setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename this ticket channel (staff only, use inside a ticket)')
    .addStringOption((option) =>
      option.setName('name').setDescription('The new channel name').setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Show payment account info (staff only to run, visible to everyone)')
    .addStringOption((option) =>
      option
        .setName('account')
        .setDescription('Which account')
        .setRequired(true)
        .addChoices(
          { name: 'Ado_Jhnam', value: 'Ado_Jhnam' },
          { name: 'Samix1977', value: 'Samix1977' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('method')
        .setDescription('Which payment method')
        .setRequired(true)
        .addChoices(
          { name: 'Binance', value: 'Binance' },
          { name: 'PayPal', value: 'PayPal' }
        )
    )
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('⏳ Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log('✅ Slash commands registered! (/panel is now available in your server)');
  } catch (error) {
    console.error(error);
  }
})();
