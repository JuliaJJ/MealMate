const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-edit')
    .setDescription('Edit one of your saved meals'),

  async execute(interaction) {
    const userId = interaction.user.id;

    db.all(
      `SELECT id, name FROM meals WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Error loading meals.', ephemeral: true });
        }

        if (rows.length === 0) {
          return interaction.reply({ content: '🍽️ You don’t have any saved meals.', ephemeral: true });
        }

        const options = rows.map(meal => ({
          label: meal.name,
          value: meal.id.toString()
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('edit-meal-select')
          .setPlaceholder('Choose a meal to edit')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
          content: '📝 Select a meal to edit:',
          components: [row],
          ephemeral: true
        });

        const collector = interaction.channel.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000
        });

        collector.on('collect', async selectInteraction => {
          if (selectInteraction.user.id !== userId) {
            return selectInteraction.reply({ content: '⚠️ This menu is not for you.', ephemeral: true });
          }

          const mealId = selectInteraction.values[0];

          db.get(
            `SELECT * FROM meals WHERE id = ? AND user_id = ?`,
            [mealId, userId],
            async (err, meal) => {
              if (err || !meal) {
                console.error(err);
                return selectInteraction.reply({ content: '❌ Meal not found.', ephemeral: true });
              }

              const modal = new ModalBuilder()
                .setCustomId(`modal-edit-meal-${meal.id}`)
                .setTitle(`Edit "${meal.name}"`);

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

              const categoryInput = new TextInputBuilder()
                .setCustomId('edit-category')
                .setLabel('Category (e.g. Italian, Breakfast)')
                .setStyle(TextInputStyle.Short)
                .setValue(meal.category || '')
                .setRequired(false);

              const tagsInput = new TextInputBuilder()
                .setCustomId('edit-tags')
                .setLabel('Tags (comma-separated)')
                .setStyle(TextInputStyle.Short)
                .setValue(meal.tags || '')
                .setRequired(false);

              modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(ingredientsInput),
                new ActionRowBuilder().addComponents(stepsInput),
                new ActionRowBuilder().addComponents(categoryInput),
                new ActionRowBuilder().addComponents(tagsInput)
              );

              await selectInteraction.showModal(modal);
            }
          );
        });
      }
    );
  }
};