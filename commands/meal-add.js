const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

// Temporary in-memory storage for in-progress recipes
const inProgressRecipes = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-add')
    .setDescription('Start building a new recipe'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Reset any existing draft
    inProgressRecipes[userId] = {
      name: '',
      ingredients: [],
      steps: []
    };

    const modal = new ModalBuilder()
      .setCustomId('start-recipe')
      .setTitle('Start New Meal');

    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Meal Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const qtyInput = new TextInputBuilder()
      .setCustomId('ingredient_qty')
      .setLabel('First Ingredient Quantity (e.g. 2 cups)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const ingInput = new TextInputBuilder()
      .setCustomId('ingredient_name')
      .setLabel('First Ingredient Name (e.g. rice)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const stepInput = new TextInputBuilder()
      .setCustomId('step')
      .setLabel('First Step (e.g. Rinse the rice)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(qtyInput),
      new ActionRowBuilder().addComponents(ingInput),
      new ActionRowBuilder().addComponents(stepInput)
    );

    await interaction.showModal(modal);
  },

  // Helper functions for draft management
  getDraft(userId) {
    return inProgressRecipes[userId];
  },

  setDraft(userId, draft) {
    inProgressRecipes[userId] = draft;
  },

  clearDraft(userId) {
    delete inProgressRecipes[userId];
  }
};