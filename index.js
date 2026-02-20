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
  ChannelType,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = "1412911390494036072";
const STAFF_ROLE = "1414301511579598858";

/**************** INVITES ****************/
let inviteData = fs.existsSync("./invites.json")
  ? JSON.parse(fs.readFileSync("./invites.json"))
  : {};

function saveInvites() {
  fs.writeFileSync("./invites.json", JSON.stringify(inviteData, null, 2));
}

/**************** READY ****************/
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

/**************** COMMAND REGISTER ****************/
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("invites")
      .setDescription("Invite system")
      .addSubcommand(s =>
        s.setName("user")
          .setDescription("Check user invites")
          .addUserOption(o =>
            o.setName("target")
              .setDescription("User")
              .setRequired(true)
          )
      )
      .addSubcommand(s => s.setName("leaderboard").setDescription("Top inviters"))
      .addSubcommand(s => s.setName("reset").setDescription("Reset invites"))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Send ticket panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Start giveaway")
      .addStringOption(o =>
        o.setName("duration").setDescription("ex 1h").setRequired(true)
      )
      .addIntegerOption(o =>
        o.setName("winners").setDescription("winners").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("prize").setDescription("prize").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands
  });

  console.log("✅ Commands loaded");
}

/**************** COMMAND HANDLER ****************/
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  /************** INVITES **************/
  if (interaction.commandName === "invites") {
    const sub = interaction.options.getSubcommand();

    if (sub === "user") {
      const user = interaction.options.getUser("target");
      const data = inviteData[user.id] || { real: 0, fake: 0 };

      const embed = new EmbedBuilder()
        .setTitle(`Invites for ${user.username}`)
        .addFields(
          { name: "Real", value: `${data.real}`, inline: true },
          { name: "Fake", value: `${data.fake}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "leaderboard") {
      const sorted = Object.entries(inviteData).sort(
        (a, b) => b[1].real - a[1].real
      );

      let desc = sorted
        .slice(0, 10)
        .map((x, i) => `${i + 1}. <@${x[0]}> → ${x[1].real}`)
        .join("\n");

      if (!desc) desc = "No data";

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Leaderboard").setDescription(desc)]
      });
    }

    if (sub === "reset") {
      inviteData = {};
      saveInvites();
      return interaction.reply("✅ Reset done");
    }
  }

  /************** TICKETS **************/
  if (interaction.commandName === "ticketpanel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Tickets")
      .setDescription("Click button");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("Open Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  /************** GIVEAWAY **************/
  if (interaction.commandName === "giveaway") {
    const duration = interaction.options.getString("duration");
    const winners = interaction.options.getInteger("winners");
    const prize = interaction.options.getString("prize");

    const end = Date.now() + ms(duration);

    const embed = new EmbedBuilder()
      .setTitle("🎉 GIVEAWAY")
      .setDescription(
        `Prize: **${prize}**\nEnds: <t:${Math.floor(end / 1000)}:R>\nWinners: ${winners}`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join")
        .setLabel("Enter")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
});

/**************** BUTTONS ****************/
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "ticket") {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: ["ViewChannel"]
        },
        {
          id: interaction.user.id,
          allow: ["ViewChannel", "SendMessages"]
        }
      ]
    });

    return interaction.reply({
      content: `Ticket created: ${channel}`,
      ephemeral: true
    });
  }

  if (interaction.customId === "join") {
    return interaction.reply({ content: "✅ Joined!", ephemeral: true });
  }
});

/**************** LOGIN ****************/
client.login(process.env.TOKEN);





