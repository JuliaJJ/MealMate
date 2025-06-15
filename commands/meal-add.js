const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const inProgressRecipes = {}; // temporary in-memory recipe drafts

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-add')
    .setDescription('Start building a new recipe'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Reset any previous draft
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

    const firstIngredient = new TextInputBuilder()
      .setCustomId('ingredient')
      .setLabel('First Ingredient (e.g. 2 cups rice)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstStep = new TextInputBuilder()
      .setCustomId('step')
      .setLabel('First Step (e.g. Rinse the rice)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(firstIngredient),
      new ActionRowBuilder().addComponents(firstStep)
    );

    await interaction.showModal(modal);
  },

  // This is a helper for later when we break this into a modal handler file:
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