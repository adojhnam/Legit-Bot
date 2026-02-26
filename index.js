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
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/***********************
 * CONFIG
 ***********************/
const GUILD_ID = "1412911390494036072";
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";
const STAFF_ROLE_ID = "1414301511579598858";
const ADMIN_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

/***********************
 * GIVEAWAY DATA
 ***********************/
const GIVEAWAY_FILE = "giveaways.json";
if (!fs.existsSync(GIVEAWAY_FILE)) fs.writeFileSync(GIVEAWAY_FILE, "{}");
let giveaways = new Map();

/***********************
 * INVITE DATA
 ***********************/
const INVITE_FILE = "invites.json";
if (!fs.existsSync(INVITE_FILE)) fs.writeFileSync(INVITE_FILE, "{}");
let invitesData = JSON.parse(fs.readFileSync(INVITE_FILE));
let guildInvites = new Map();

const REWARD_ROLES = {
  5: "PUT_ROLE_ID",
  10: "PUT_ROLE_ID",
  20: "PUT_ROLE_ID"
};

function saveGiveaways() {
  const obj = Object.fromEntries([...giveaways].map(([id, g]) => [id, { ...g, users: [...g.users] }]));
  fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(obj, null, 2));
}

function saveInvites() {
  fs.writeFileSync(INVITE_FILE, JSON.stringify(invitesData, null, 2));
}

/***********************
 * READY
 ***********************/
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
  loadGiveaways();

  const guild = client.guilds.cache.get(GUILD_ID);
  const invites = await guild.invites.fetch();
  guildInvites.set(guild.id, invites);
});

/***********************
 * REGISTER COMMANDS
 ***********************/
async function registerCommands() {
  const commands = [
  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Check your invites or someone else's invites")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Select a user to check their invites")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the invites leaderboard"),

  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways")
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Start a new giveaway")
        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("The giveaway prize")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("duration")
            .setDescription("Duration in minutes")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Number of winners")
            .setRequired(true)
        )
    )
].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log("✅ All commands registered");
}

/***********************
 * INVITE TRACKING
 ***********************/
client.on("guildMemberAdd", async member => {

  const accountAge = Date.now() - member.user.createdTimestamp;
  if (accountAge < 1000 * 60 * 60 * 24 * 3) return;

  const newInvites = await member.guild.invites.fetch();
  const oldInvites = guildInvites.get(member.guild.id);

  const invite = newInvites.find(i => i.uses > (oldInvites.get(i.code)?.uses || 0));
  guildInvites.set(member.guild.id, newInvites);
  if (!invite) return;

  const inviter = invite.inviter;

  if (!invitesData[inviter.id]) {
    invitesData[inviter.id] = { invites: 0, joined: [], left: [] };
  }

  if (invitesData[inviter.id].joined.includes(member.id)) return;

  invitesData[inviter.id].invites++;
  invitesData[inviter.id].joined.push(member.id);
  saveInvites();

  const count = invitesData[inviter.id].invites;
  if (REWARD_ROLES[count]) {
    const role = member.guild.roles.cache.get(REWARD_ROLES[count]);
    const guildMember = await member.guild.members.fetch(inviter.id).catch(()=>null);
    if (role && guildMember) guildMember.roles.add(role).catch(()=>{});
  }
});

client.on("guildMemberRemove", member => {
  for (const id in invitesData) {
    const data = invitesData[id];
    if (data.joined.includes(member.id) && !data.left.includes(member.id)) {
      data.invites--;
      data.left.push(member.id);
    }
  }
  saveInvites();
});

/***********************
 * INVITE COMMANDS
 ***********************/
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "invites") {
    const user = interaction.options.getUser("user") || interaction.user;
    const data = invitesData[user.id] || { invites: 0 };
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor("Blue")
        .setTitle("Invite Counter")
        .setDescription(`👤 ${user}\n🎉 Invites: **${data.invites}**`)]
    });
  }

  if (interaction.commandName === "leaderboard") {
    const sorted = Object.entries(invitesData)
      .sort((a,b)=>b[1].invites - a[1].invites)
      .slice(0,10);

    let text = "";
    sorted.forEach((x,i)=> text += `**${i+1}.** <@${x[0]}> — ${x[1].invites}\n`);
    return interaction.reply({ content: text || "No data yet" });
  }

  if (interaction.commandName === "invite-giveaway") {
    const needed = interaction.options.getInteger("invites");
    const winners = Object.entries(invitesData).filter(x=>x[1].invites>=needed);
    if (!winners.length) return interaction.reply("No winners");
    const winner = winners[Math.floor(Math.random()*winners.length)];
    return interaction.reply(`🎉 Winner: <@${winner[0]}>`);
  }

});

/***********************
 * LOGIN
 ***********************/
client.login(process.env.TOKEN);

