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
  OverwriteType,
} = require("discord.js");

/* ================= CONFIG ================= */
const TOKEN = process.env.TOKEN;
const GUILD_ID = "1412911390494036072";
const TICKET_CATEGORY_ID = "1414954122918236171";
const STAFF_ROLE_ID = "1414301511579598858";
const ADMIN_ROLE_ID = "1414301511579598858";

const PAYPAL_INFO = "<:paypal:1430875512221339680> **Paypal:** Ahmdla9.ahmad@gmail.com";
const BINANCE_INFO = "<:binance:1430875529539489932> **Binance ID:** 993881216";

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
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def));
  return JSON.parse(fs.readFileSync(file));
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let invites = load(INVITES_FILE, {});
let giveaways = load(GIVEAWAYS_FILE, {});

/* ================= EMBEDS ================= */
const paypalEmbed = () =>
  new EmbedBuilder().setColor("#009cde").setTitle("💰 PayPal").setDescription(PAYPAL_INFO);

const binanceEmbed = () =>
  new EmbedBuilder().setColor("#f3ba2f").setTitle("💰 Binance").setDescription(BINANCE_INFO);

const paymentEmbed = () =>
  new EmbedBuilder().setTitle("💳 Payment Methods").setDescription(`${PAYPAL_INFO}\n\n${BINANCE_INFO}`);

function paypalFeesEmbed(a) {
  const fee = a * 0.0449 + 0.6;
  return new EmbedBuilder()
    .setTitle("💰 PayPal Fees")
    .addFields(
      { name: "Amount", value: `$${a}`, inline: true },
      { name: "Fee", value: `$${fee.toFixed(2)}`, inline: true },
      { name: "After", value: `$${(a - fee).toFixed(2)}`, inline: true },
      { name: "Send", value: `$${(a + fee).toFixed(2)}`, inline: true }
    );
}

function giveawayEmbed(g) {
  return new EmbedBuilder().setColor("#0d0d0d").setTitle("🎉 DARK GIVEAWAY 🎉").setDescription(
    `✨ Prize: **${g.prize}**
🏆 Winners: **${g.winners}**
👥 Participants: **${g.users.length}**
⏳ Ends: <t:${Math.floor(g.end / 1000)}:R>`
  );
}

/* ================= COMMANDS ================= */
async function register() {
  const cmds = [
    new SlashCommandBuilder().setName("paypal").setDescription("paypal"),
    new SlashCommandBuilder().setName("binance").setDescription("binance"),
    new SlashCommandBuilder().setName("paymentmethods").setDescription("all payments"),
    new SlashCommandBuilder().setName("paypal-fees").setDescription("fees")
      .addNumberOption(o=>o.setName("amount").setRequired(true)),

    new SlashCommandBuilder().setName("ticketpanel").setDescription("panel"),
    new SlashCommandBuilder().setName("close").setDescription("close"),

    new SlashCommandBuilder().setName("giveaway").setDescription("giveaway")
      .addSubcommand(s=>s.setName("start")
        .addStringOption(o=>o.setName("duration").setRequired(true))
        .addIntegerOption(o=>o.setName("winners").setRequired(true))
        .addStringOption(o=>o.setName("prize").setRequired(true)))
      .addSubcommand(s=>s.setName("end")
        .addStringOption(o=>o.setName("id").setRequired(true)))
      .addSubcommand(s=>s.setName("reroll")
        .addStringOption(o=>o.setName("id").setRequired(true))),

    new SlashCommandBuilder().setName("invites").setDescription("invites")
      .addUserOption(o=>o.setName("user")),

    new SlashCommandBuilder().setName("invite").setDescription("invite")
      .addSubcommand(s=>s.setName("leaderboard")),

    new SlashCommandBuilder().setName("reset").setDescription("reset")
      .addSubcommandGroup(g=>g.setName("invite")
        .addSubcommand(s=>s.setName("user").addUserOption(o=>o.setName("target").setRequired(true)))
        .addSubcommand(s=>s.setName("leaderboard")))
  ].map(x=>x.toJSON());

  const rest = new REST({version:"10"}).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {body:cmds});
}

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log("READY");
  await register();
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async i => {

  /* ===== COMMANDS ===== */
  if (i.isChatInputCommand()) {

    if (i.commandName === "paypal") return i.reply({embeds:[paypalEmbed()]});
    if (i.commandName === "binance") return i.reply({embeds:[binanceEmbed()]});
    if (i.commandName === "paymentmethods") return i.reply({embeds:[paymentEmbed()]});

    if (i.commandName === "paypal-fees") {
      const a = i.options.getNumber("amount");
      return i.reply({embeds:[paypalFeesEmbed(a)]});
    }

    if (i.commandName === "ticketpanel") {
      return i.reply({
        embeds:[new EmbedBuilder().setTitle("🎫 Ticket System")],
        components:[new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("buy").setLabel("Purchase").setEmoji("🛒").setStyle(1),
          new ButtonBuilder().setCustomId("sell").setLabel("Seller").setEmoji("📦").setStyle(3),
          new ButtonBuilder().setCustomId("report").setLabel("Report").setEmoji("🚨").setStyle(4)
        )]
      });
    }

    if (i.commandName === "close") {
      if (!i.channel.topic?.includes("ticket")) return i.reply({content:"not ticket",ephemeral:true});
      i.reply("closing...");
      setTimeout(()=>i.channel.delete(),3000);
    }

    if (i.commandName === "giveaway") {
      const sub = i.options.getSubcommand();

      if (sub === "start") {
        const dur = ms(i.options.getString("duration"));
        const g = {
          prize:i.options.getString("prize"),
          winners:i.options.getInteger("winners"),
          end:Date.now()+dur,
          users:[]
        };

        const msg = await i.reply({
          embeds:[giveawayEmbed(g)],
          components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("join").setLabel("Join").setStyle(3)
          )],
          fetchReply:true
        });

        giveaways[msg.id]=g;
        save(GIVEAWAYS_FILE,giveaways);

        setTimeout(()=>endGiveaway(msg.id),dur);
      }

      if (sub === "end") endGiveaway(i.options.getString("id"));
      if (sub === "reroll") reroll(i.options.getString("id"),i);
    }

    if (i.commandName === "invites") {
      const u = i.options.getUser("user")||i.user;
      const d = invites[u.id]||{joins:0};
      return i.reply(`Invites: ${d.joins}`);
    }

    if (i.commandName === "invite") {
      const list = Object.entries(invites).sort((a,b)=>b[1].joins-a[1].joins);
      return i.reply(list.map((x,i)=>`${i+1}. <@${x[0]}> ${x[1].joins}`).join("\n"));
    }

    if (i.commandName === "reset") {
      invites={}; save(INVITES_FILE,invites);
      return i.reply("reset done");
    }
  }

  /* ===== BUTTONS ===== */
  if (i.isButton()) {

    if (i.customId==="buy") {
      const m=new ModalBuilder().setCustomId("buym").setTitle("شراء");
      m.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("p").setLabel("شو بدك").setStyle(1)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("pay").setLabel("طريقة الدفع").setStyle(1)
        )
      );
      return i.showModal(m);
    }

    if (i.customId==="sell") {
      const m=new ModalBuilder().setCustomId("sellm").setTitle("Seller");
      m.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("items").setLabel("items").setStyle(2)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("proof").setLabel("proof").setStyle(2)
        )
      );
      return i.showModal(m);
    }

    if (i.customId==="report") return createTicket(i,"Report",["🚨 Scam"]);

    if (i.customId==="join") {
      const g=giveaways[i.message.id];
      if (!g) return i.reply({content:"ended",ephemeral:true});
      if (g.users.includes(i.user.id)) return i.reply({content:"joined",ephemeral:true});
      g.users.push(i.user.id);
      save(GIVEAWAYS_FILE,giveaways);
      i.message.edit({embeds:[giveawayEmbed(g)]});
      return i.reply({content:"joined 🎉",ephemeral:true});
    }
  }

  /* ===== MODALS ===== */
  if (i.isModalSubmit()) {
    if (i.customId==="buym") {
      return createTicket(i,"Purchase",[
        `🛒 ${i.fields.getTextInputValue("p")}`,
        `💳 ${i.fields.getTextInputValue("pay")}`
      ]);
    }

    if (i.customId==="sellm") {
      return createTicket(i,"Seller",[
        i.fields.getTextInputValue("items"),
        i.fields.getTextInputValue("proof")
      ]);
    }
  }

});

/* ================= TICKET ================= */
async function createTicket(i,type,data) {
  const ch=await i.guild.channels.create({
    name:`ticket-${i.user.username}`,
    type:ChannelType.GuildText,
    parent:TICKET_CATEGORY_ID,
    topic:"ticket",
    permissionOverwrites:[
      {id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},
      {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]},
      {id:STAFF_ROLE_ID,allow:[PermissionFlagsBits.ViewChannel]}
    ]
  });

  await ch.send({
    content:`${i.user}`,
    embeds:[new EmbedBuilder().setTitle(type).setDescription(data.join("\n"))],
    components:[new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(4)
    )]
  });

  i.reply({content:`Ticket: ${ch}`,ephemeral:true});
}

/* ================= GIVEAWAY ================= */
async function endGiveaway(id) {
  const g=giveaways[id];
  if (!g) return;

  const ch=await client.channels.fetch(g.channelId).catch(()=>null);
  const users=g.users;

  if (!users.length) return;

  const winners=[];
  while(winners.length<Math.min(g.winners,users.length)){
    const r=users[Math.floor(Math.random()*users.length)];
    if(!winners.includes(r)) winners.push(r);
  }

  ch.send(`🎉 Winners: ${winners.map(x=>`<@${x}>`).join(", ")}`);
}

/* ================= LOGIN ================= */
client.login(TOKEN);
