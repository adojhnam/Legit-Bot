// ======================================
// Legit Bot - FINAL FULL VERSION
// ======================================

require("dotenv").config();
const fs = require("fs");
const ms = require("ms");
const archiver = require("archiver");

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

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/***********************
CONFIG
************************/
const GUILD_ID = "1412911390494036072";
const STAFF_ROLE_ID = "1414301511579598858";
const TICKET_CATEGORY_ID = "1414954122918236171";
const LOG_CHANNEL_ID = "1470080063792742410";

/***********************
FILES
************************/
const GIVEAWAY_FILE = "giveaways.json";
const INVITES_FILE = "invites.json";

if (!fs.existsSync(GIVEAWAY_FILE)) fs.writeFileSync(GIVEAWAY_FILE, "{}");
if (!fs.existsSync(INVITES_FILE)) fs.writeFileSync(INVITES_FILE, "{}");

let giveaways = new Map();
let invitesData = JSON.parse(fs.readFileSync(INVITES_FILE));

/***********************
READY
************************/
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  await loadGiveaways();
  await cacheInvites();
});

/***********************
REGISTER COMMANDS
************************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Open panel"),
    new SlashCommandBuilder().setName("close").setDescription("Close ticket"),
    new SlashCommandBuilder().setName("paypal").setDescription("Show PayPal"),
    new SlashCommandBuilder().setName("binance").setDescription("Show Binance"),
    new SlashCommandBuilder().setName("payment-methods").setDescription("All methods"),
    new SlashCommandBuilder()
      .setName("paypal-fees")
      .setDescription("Fees")
      .addNumberOption(o =>
        o.setName("amount").setDescription("Amount").setRequired(true)
      ),
    new SlashCommandBuilder().setName("leaderboard").setDescription("Invites"),
    new SlashCommandBuilder().setName("resetinvites").setDescription("Reset invites"),
    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway")
      .addSubcommand(s =>
        s.setName("start")
          .setDescription("Start")
          .addStringOption(o =>
            o.setName("duration").setDescription("10m 1h").setRequired(true))
          .addIntegerOption(o =>
            o.setName("winners").setDescription("Winners").setRequired(true))
          .addStringOption(o =>
            o.setName("prize").setDescription("Prize").setRequired(true)))
  ].map(x => x.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
}

/***********************
INVITE TRACKING
************************/
let inviteCache = new Map();

async function cacheInvites() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const invites = await guild.invites.fetch();
  inviteCache.set(GUILD_ID, invites);
}

client.on("guildMemberAdd", async member => {
  const newInvites = await member.guild.invites.fetch();
  const oldInvites = inviteCache.get(member.guild.id);

  const invite = newInvites.find(i => oldInvites.get(i.code)?.uses < i.uses);

  if (invite) {
    if (!invitesData[invite.inviter.id])
      invitesData[invite.inviter.id] = { invites: 0, joined: [] };

    invitesData[invite.inviter.id].invites++;
    invitesData[invite.inviter.id].joined.push(member.id);

    fs.writeFileSync(INVITES_FILE, JSON.stringify(invitesData, null, 2));
  }

  inviteCache.set(member.guild.id, newInvites);
});

client.on("guildMemberRemove", member => {
  for (const user in invitesData) {
    const data = invitesData[user];
    if (data.joined.includes(member.id)) {
      data.invites--;
      data.joined = data.joined.filter(x => x !== member.id);
    }
  }
  fs.writeFileSync(INVITES_FILE, JSON.stringify(invitesData, null, 2));
});

/***********************
GIVEAWAYS AUTO RESUME
************************/
async function loadGiveaways() {
  const data = JSON.parse(fs.readFileSync(GIVEAWAY_FILE));
  for (const id in data) {
    giveaways.set(id, data[id]);
    const time = data[id].end - Date.now();
    if (time > 0) setTimeout(() => endGiveaway(id), time);
  }
}

function saveGiveaways() {
  fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(Object.fromEntries(giveaways)));
}

/***********************
INTERACTIONS
************************/
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {

      if (["leaderboard", "giveaway"].includes(interaction.commandName))
        await interaction.deferReply();

      if (interaction.commandName === "paypal")
        return interaction.reply("PayPal: example@email.com");

      if (interaction.commandName === "binance")
        return interaction.reply("Binance: ID");

      if (interaction.commandName === "payment-methods")
        return interaction.reply("All methods");

      if (interaction.commandName === "paypal-fees") {
        const amount = interaction.options.getNumber("amount");
        const fee = amount * 0.0449 + 0.6;
        return interaction.reply(`Fee: ${fee.toFixed(2)}`);
      }

      if (interaction.commandName === "leaderboard") {
        const sorted = Object.entries(invitesData)
          .sort((a, b) => b[1].invites - a[1].invites)
          .slice(0, 10);

        const text = sorted.map((x, i) =>
          `${i + 1}. <@${x[0]}> - ${x[1].invites}`
        ).join("\n");

        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle("Leaderboard").setDescription(text || "No data")],
        });
      }

      if (interaction.commandName === "resetinvites") {
        invitesData = {};
        fs.writeFileSync(INVITES_FILE, "{}");
        return interaction.reply("Done");
      }

      if (interaction.commandName === "giveaway") {
        const sub = interaction.options.getSubcommand();

        if (sub === "start") {
          const duration = interaction.options.getString("duration");
          const winners = interaction.options.getInteger("winners");
          const prize = interaction.options.getString("prize");

          const end = Date.now() + ms(duration);

          const embed = new EmbedBuilder()
            .setTitle("🎉 Giveaway")
            .setDescription(`${prize}\nEnds <t:${Math.floor(end / 1000)}:R>`);

          const msg = await interaction.editReply({ embeds: [embed] });

          giveaways.set(msg.id, {
            prize,
            winners,
            end,
            channel: msg.channel.id,
            users: [],
          });

          saveGiveaways();
          setTimeout(() => endGiveaway(msg.id), ms(duration));
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
});

/***********************
END GIVEAWAY
************************/
async function endGiveaway(id) {
  const g = giveaways.get(id);
  if (!g) return;

  const channel = await client.channels.fetch(g.channel);
  const msg = await channel.messages.fetch(id);

  if (!g.users.length) return msg.edit("No participants");

  const winner = g.users[Math.floor(Math.random() * g.users.length)];

  msg.edit(`Winner: <@${winner}>`);
}

/***********************/
client.login(process.env.TOKEN);
