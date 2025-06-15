const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-view')
    .setDescription('View the meals you have saved'),

  async execute(interaction) {
    const userId = interaction.user.id;

    db.all(
      `SELECT id, name, created_at FROM meals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply({
            content: '❌ Error fetching your meals.',
            ephemeral: true
          });
        }

        if (rows.length === 0) {
          return interaction.reply({
            content: '🍽️ You haven’t added any meals yet. Use `/meal-add` to get started!',
            ephemeral: true
          });
        }

        const mealList = rows
          .map((row, index) => `**${index + 1}. ${row.name}** (added <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>)`)
          .join('\n');

        return interaction.reply({
          content: `📋 Here are your most recent meals:\n\n${mealList}`,
          ephemeral: true
        });
      }
    );
  }
};