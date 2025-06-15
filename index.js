require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '⚠️ Error executing that command.', ephemeral: true });
    }
  }

  // Autocomplete
  else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(err);
    }
  }

  // Modals
  else if (interaction.isModalSubmit()) {
    const mealAddCommand = require('./commands/meal-add');
    const userId = interaction.user.id;
    const draft = mealAddCommand.getDraft(userId);

    if (!draft) {
      return interaction.reply({ content: '⚠️ No active recipe draft found.', ephemeral: true });
    }

    if (interaction.customId === 'start-recipe') {
      const name = interaction.fields.getTextInputValue('name');
      const quantity = interaction.fields.getTextInputValue('ingredient_qty');
      const ingredientName = interaction.fields.getTextInputValue('ingredient_name');
      const step = interaction.fields.getTextInputValue('step');

      draft.name = name;
      draft.ingredients.push({ quantity, name: ingredientName });
      draft.steps.push(step);
      mealAddCommand.setDraft(userId, draft);
    }

    if (interaction.customId === 'modal-add-ingredient') {
      const quantity = interaction.fields.getTextInputValue('qty');
      const name = interaction.fields.getTextInputValue('name');
      draft.ingredients.push({ quantity, name });
      mealAddCommand.setDraft(userId, draft);
    }

    if (interaction.customId === 'modal-add-step') {
      const step = interaction.fields.getTextInputValue('step');
      draft.steps.push(step);
      mealAddCommand.setDraft(userId, draft);
    }

    // Show updated preview after modal
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add-ingredient').setLabel('➕ Add Ingredient').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('add-step').setLabel('➕ Add Step').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('save-recipe').setLabel('✅ Save Recipe').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel-recipe').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
    );

    const ingredientsPreview = draft.ingredients
      .map(i => `- ${i.quantity} ${i.name}`)
      .join('\n');

    const stepsPreview = draft.steps
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n');

    return interaction.reply({
      content: `📋 **${draft.name}**\n\n🧾 **Ingredients:**\n${ingredientsPreview}\n\n👩‍🍳 **Steps:**\n${stepsPreview}`,
      components: [row],
      ephemeral: true
    });
  }

  // Buttons
  else if (interaction.isButton()) {
    const mealAddCommand = require('./commands/meal-add');
    const userId = interaction.user.id;
    const draft = mealAddCommand.getDraft(userId);

    if (!draft) {
      return interaction.reply({ content: '⚠️ No active recipe in progress.', ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    switch (interaction.customId) {
      case 'add-ingredient': {
        const modal = new ModalBuilder()
          .setCustomId('modal-add-ingredient')
          .setTitle('Add Ingredient');

        const qtyInput = new TextInputBuilder()
          .setCustomId('qty')
          .setLabel('Quantity (e.g. 1 tbsp)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const nameInput = new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Ingredient Name (e.g. olive oil)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(qtyInput),
          new ActionRowBuilder().addComponents(nameInput)
        );

        return interaction.showModal(modal);
      }

      case 'add-step': {
        const modal = new ModalBuilder()
          .setCustomId('modal-add-step')
          .setTitle('Add Step');

        const stepInput = new TextInputBuilder()
          .setCustomId('step')
          .setLabel('What should the next step be?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(stepInput));

        return interaction.showModal(modal);
      }

      case 'save-recipe': {
        const db = require('./database/database');

        const ingredientsText = draft.ingredients
          .map(i => `${i.quantity} ${i.name}`)
          .join('\n');

        const instructionsText = draft.steps
          .map((s, i) => `${i + 1}. ${s}`)
          .join('\n');

        db.run(
          `INSERT INTO meals (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)`,
          [userId, draft.name, ingredientsText, instructionsText],
          function (err) {
            if (err) {
              console.error(err);
              return interaction.reply({
                content: '❌ Something went wrong saving your recipe.',
                ephemeral: true
              });
            }

            mealAddCommand.clearDraft(userId);
            return interaction.update({
              content: `✅ **${draft.name}** has been saved to your recipe list!`,
              components: []
            });
          }
        );
        break;
      }

      case 'cancel-recipe': {
        mealAddCommand.clearDraft(userId);
        return interaction.update({ content: '❌ Recipe creation canceled.', components: [] });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);