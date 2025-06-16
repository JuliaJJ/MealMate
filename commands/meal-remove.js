const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-remove')
    .setDescription('Remove a saved meal from your list'),

  async execute(interaction) {
    const userId = interaction.user.id;

    db.all(
      `SELECT id, name FROM meals WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`,
      [userId],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Error fetching your meals.', ephemeral: true });
        }

        if (rows.length === 0) {
          return interaction.reply({ content: '🍽️ You have no saved meals to delete.', ephemeral: true });
        }

        const options = rows.map(row => ({
          label: row.name,
          value: row.id.toString()
        }));

        const menu = new StringSelectMenuBuilder()
          .setCustomId('select-meal-delete')
          .setPlaceholder('Select a meal to delete')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          content: '🗑️ Select a meal to remove:',
          components: [row],
          ephemeral: true
        });
      }
    );
  }
};