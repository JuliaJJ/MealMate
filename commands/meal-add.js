const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-add')
    .setDescription('Start adding a new meal recipe'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('start-recipe')
      .setTitle('Start a New Recipe');

    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Meal name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const qtyInput = new TextInputBuilder()
      .setCustomId('quantity')
      .setLabel('First ingredient quantity (e.g., 1 cup)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const ingredientInput = new TextInputBuilder()
      .setCustomId('ingredient')
      .setLabel('First ingredient name (e.g., flour)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const stepInput = new TextInputBuilder()
      .setCustomId('step')
      .setLabel('First instruction step')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const categoryInput = new TextInputBuilder()
      .setCustomId('category')
      .setLabel('Category (e.g., Dinner, Snack)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const tagsInput = new TextInputBuilder()
      .setCustomId('tags')
      .setLabel('Tags (comma-separated: vegetarian, spicy)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(qtyInput),
      new ActionRowBuilder().addComponents(ingredientInput),
      new ActionRowBuilder().addComponents(stepInput),
      new ActionRowBuilder().addComponents(categoryInput),
      new ActionRowBuilder().addComponents(tagsInput)
    );

    await interaction.showModal(modal);
  }
};