client.on(Events.InteractionCreate, async interaction => {
  // فقط أوامر Chat Input (Slash Commands)
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ticketpanel") {
      const ticketPanel = new EmbedBuilder()
        .setTitle("🎫 Support Tickets")
        .setDescription("Click the button below to create a ticket.")
        .setColor("Blue");

      const ticketButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [ticketPanel], components: [ticketButton] });
    }
  }

  // التعامل مع ضغط الزر
  if (interaction.isButton()) {
    if (interaction.customId === "create_ticket") {
      const member = interaction.member;
      const guild = interaction.guild;
      const channelName = `ticket-${member.user.username}`;

      const existingChannel = guild.channels.cache.find(c => c.name === channelName);
      if (existingChannel) {
        return await interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, ephemeral: true });
      }

      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: ['ViewChannel'] },
          { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ]
      });

      await ticketChannel.send({ content: `${member}, your ticket is created!` });

      await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: "Click the button below to close the ticket.", components: [closeButton] });
    }

    if (interaction.customId === "close_ticket") {
      const channel = interaction.channel;
      await interaction.reply({ content: `✅ Ticket will be deleted in 5 seconds...`, ephemeral: true });
      setTimeout(() => channel.delete(), 5000);
    }
  }
});

