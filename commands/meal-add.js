const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-add')
    .setDescription('Add a meal to your recipe list')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the meal')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('ingredients')
        .setDescription('Ingredients (comma or newline separated)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('instructions')
        .setDescription('Instructions for preparing the meal')
        .setRequired(true)),
        
  async execute(interaction) {
    const userId = interaction.user.id;
    const name = interaction.options.getString('name');
    const ingredients = interaction.options.getString('ingredients');
    const instructions = interaction.options.getString('instructions');

    try {
      db.run(
        `INSERT INTO meals (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)`,
        [userId, name, ingredients, instructions],
        function (err) {
          if (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Failed to save your meal.', ephemeral: true });
          }

          interaction.reply({
            content: `✅ **${name}** was saved to your meal list!`,
            ephemeral: true
          });
        }
      );
    } catch (error) {
      console.error(error);
      interaction.reply({ content: '⚠️ An error occurred while saving your meal.', ephemeral: true });
    }
  }
};