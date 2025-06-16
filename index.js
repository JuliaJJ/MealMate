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
  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder
  } = require('discord.js');
  const db = require('./database/database');

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '⚠️ Error executing that command.', ephemeral: true });
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(err);
    }
  } else if (interaction.isModalSubmit()) {
    const mealAddCommand = require('./commands/meal-add');
    const userId = interaction.user.id;
    const draft = mealAddCommand.getDraft(userId);

    if (interaction.customId.startsWith('modal-edit-meal-')) {
      const mealId = interaction.customId.split('modal-edit-meal-')[1];

      const name = interaction.fields.getTextInputValue('edit-name');
      const ingredients = interaction.fields.getTextInputValue('edit-ingredients');
      const instructions = interaction.fields.getTextInputValue('edit-steps');
      const category = interaction.fields.getTextInputValue('edit-category');
      const tags = interaction.fields.getTextInputValue('edit-tags');

      db.run(
        `UPDATE meals SET name = ?, ingredients = ?, instructions = ?, category = ?, tags = ? WHERE id = ?`,
        [name, ingredients, instructions, category, tags, mealId],
        function (err) {
          if (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Error saving updated meal.', ephemeral: true });
          }

          return interaction.reply({
            content: `✅ Meal **${name}** has been updated.`,
            ephemeral: true
          });
        }
      );
      return;
    }

    if (!draft) {
      return interaction.reply({ content: '⚠️ No active recipe draft found.', ephemeral: true });
    }

    if (interaction.customId === 'start-recipe') {
      const name = interaction.fields.getTextInputValue('name');
      const quantity = interaction.fields.getTextInputValue('ingredient_qty');
      const ingredientName = interaction.fields.getTextInputValue('ingredient_name');
      const step = interaction.fields.getTextInputValue('step');
      const category = interaction.fields.getTextInputValue('category');
      const tags = interaction.fields.getTextInputValue('tags');

      draft.name = name;
      draft.category = category;
      draft.tags = tags;
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add-ingredient').setLabel('➕ Add Ingredient').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('add-step').setLabel('➕ Add Step').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('save-recipe').setLabel('✅ Save Recipe').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel-recipe').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
    );

    const ingredientsPreview = draft.ingredients.map(i => `- ${i.quantity} ${i.name}`).join('\n');
    const stepsPreview = draft.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

    return interaction.reply({
      content: `📋 **${draft.name}**\n📂 *Category:* ${draft.category || 'None'}\n🏷️ *Tags:* ${draft.tags || 'None'}\n\n🧾 **Ingredients:**\n${ingredientsPreview}\n\n👩‍🍳 **Steps:**\n${stepsPreview}`,
      components: [row],
      ephemeral: true
    });
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select-meal-delete') {
      const selectedMealId = interaction.values[0];
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`confirm-delete-${selectedMealId}`).setLabel('❌ Confirm Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel-delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        content: `Are you sure you want to delete this meal?`,
        components: [confirmRow]
      });
    }

    if (interaction.customId === 'edit-meal-select') {
      const mealId = interaction.values[0];

      db.get(`SELECT * FROM meals WHERE id = ?`, [mealId], (err, meal) => {
        if (err || !meal) {
          console.error(err);
          return interaction.reply({ content: '❌ Error loading meal.', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`modal-edit-meal-${meal.id}`)
          .setTitle(`Edit \"${meal.name}\"`);

        const nameInput = new TextInputBuilder()
          .setCustomId('edit-name')
          .setLabel('Meal Name')
          .setStyle(TextInputStyle.Short)
          .setValue(meal.name)
          .setRequired(true);

        const ingredientsInput = new TextInputBuilder()
          .setCustomId('edit-ingredients')
          .setLabel('Ingredients (1 per line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(meal.ingredients)
          .setRequired(true);

        const stepsInput = new TextInputBuilder()
          .setCustomId('edit-steps')
          .setLabel('Instructions (1 step per line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(meal.instructions)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(ingredientsInput),
          new ActionRowBuilder().addComponents(stepsInput)
        );

        return interaction.showModal(modal);
      });
    }
  } else if (interaction.isButton()) {
    const mealAddCommand = require('./commands/meal-add');
    const userId = interaction.user.id;
    const draft = mealAddCommand.getDraft(userId);

    if (interaction.customId.startsWith('confirm-delete-')) {
      const mealId = interaction.customId.split('confirm-delete-')[1];
      db.run(`DELETE FROM meals WHERE id = ?`, [mealId], function (err) {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Error deleting meal.', ephemeral: true });
        }

        return interaction.update({
          content: `🗑️ Meal has been deleted.`,
          components: []
        });
      });
      return;
    }

    if (interaction.customId === 'cancel-delete') {
      return interaction.update({
        content: '❎ Meal deletion canceled.',
        components: []
      });
    }

    if (!draft && interaction.customId !== 'cancel-recipe') {
      return interaction.reply({ content: '⚠️ No active recipe in progress.', ephemeral: true });
    }

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
        const ingredientsText = draft.ingredients.map(i => `${i.quantity} ${i.name}`).join('\n');
        const instructionsText = draft.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

        db.run(
            `INSERT INTO meals (user_id, name, ingredients, instructions, category, tags) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, draft.name, ingredientsText, instructionsText, draft.category || '', draft.tags || ''],
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
