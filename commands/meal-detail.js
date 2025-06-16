const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-detail')
    .setDescription('View the full recipe details for a saved meal')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the meal')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const userId = interaction.user.id;
    const focusedValue = interaction.options.getFocused();

    db.all(
      `SELECT name FROM meals WHERE user_id = ? AND name LIKE ? LIMIT 25`,
      [userId, `%${focusedValue}%`],
      (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.respond([]);
        }

        const options = rows.map(row => ({
          name: row.name,
          value: row.name
        }));

        interaction.respond(options);
      }
    );
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const name = interaction.options.getString('name');

    db.get(
      `SELECT name, ingredients, instructions, category, tags FROM meals WHERE user_id = ? AND name = ? COLLATE NOCASE`,
      [userId, name],
      (err, row) => {
        if (err) {
          console.error(err);
          return interaction.reply({
            content: '❌ There was an error retrieving the recipe.',
            ephemeral: true
          });
        }

        if (!row) {
          return interaction.reply({
            content: `🤔 No saved meal called “${name}” found.`,
            ephemeral: true
          });
        }

        const tagsFormatted = row.tags
          ? row.tags
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean)
              .map(tag => `#${tag}`)
              .join(' ')
          : '';

        const categoryDisplay = row.category ? `📂 **Category:** ${row.category}\n` : '';
        const tagsDisplay = tagsFormatted ? `🏷️ **Tags:** ${tagsFormatted}\n` : '';

        interaction.reply({
          content:
            `📖 **${row.name}**\n\n` +
            `${categoryDisplay}${tagsDisplay}` +
            `📝 **Ingredients:**\n${row.ingredients}\n\n` +
            `👩‍🍳 **Instructions:**\n${row.instructions}`,
          ephemeral: true
        });
      }
    );
  }
};