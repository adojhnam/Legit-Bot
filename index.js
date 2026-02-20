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

/***********************
 * INVITE SYSTEM
 ***********************/
let invitesCache = new Map();
let inviteData = fs.existsSync("./invites.json")
  ? JSON.parse(fs.readFileSync("./invites.json"))
  : {};

const saveInvites = () => fs.writeFileSync("./invites.json", JSON.stringify(inviteData, null, 2));

/***********************
 * READY - CACHE INVITES
 ***********************/
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const invites = await guild.invites.fetch();
  invitesCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
  registerCommands();
});

/***********************
 * TRACK JOIN
 ***********************/
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
  if (!inviteData[inviter]) inviteData[inviter] = { real: 0, fake: 0, rejoin: 0, users: [] };

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

/***********************
 * TRACK LEAVE
 ***********************/
client.on("guildMemberRemove", member => {
  for (const u in inviteData) {
    inviteData[u].users = inviteData[u].users.filter(x => x !== member.id);
  }
  saveInvites();
});

/***********************
 * INVITE COMMAND
 ***********************/
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "invites") {
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
          let medal = "";
          if (rank === 1) medal = "🥇";
          if (rank === 2) medal = "🥈";
          if (rank === 3) medal = "🥉";
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
        if (i.user.id !== interaction.user.id) return i.reply({ content: "❌ Not yours.", ephemeral: true });
        if (i.customId === "prev_inv" && page > 0) page--;
        if (i.customId === "next_inv" && page < Math.ceil(sorted.length / 10) - 1) page++;
        i.update({ embeds: [getPage(page)] });
      });
    }
  }
});

/***********************
 * GIVEAWAY MAP
 ***********************/
let giveaways = new Map();

/***********************
 * REGISTER COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("invites")
      .setDescription("Invite system")
      .addSubcommand(s =>
        s.setName("user")
          .setDescription("Check user invites")
          .addUserOption(o => o.setName("target").setDescription("User to check").setRequired(true))
      )
      .addSubcommand(s => s.setName("leaderboard").setDescription("Leaderboard"))
      .addSubcommand(s => s.setName("reset").setDescription("Reset data"))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName("close").setDescription("Close ticket").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Calculate PayPal fees")
      .addNumberOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),
    new SlashCommandBuilder().setName("paypal").setDescription("Show PayPal"),
    new SlashCommandBuilder().setName("binance").setDescription("Show Binance"),
    new SlashCommandBuilder().setName("payment-methods").setDescription("Show all payment methods"),

    // Giveaway
    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Start a giveaway")
      .addStringOption(opt => opt.setName("duration").setDescription("Duration e.g. 1h, 30m, 2d").setRequired(true))
      .addIntegerOption(opt => opt.setName("winners").setDescription("Number of winners").setRequired(true))
      .addStringOption(opt => opt.setName("prize").setDescription("Prize description").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("giveaway_end")
      .setDescription("End a giveaway early")
      .addStringOption(opt => opt.setName("message_id").setDescription("ID of the giveaway message").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("giveaway_reroll")
      .setDescription("Reroll winners of a giveaway")
      .addStringOption(opt => opt.setName("message_id").setDescription("ID of the giveaway message").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log("✅ Commands registered");
}

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);




