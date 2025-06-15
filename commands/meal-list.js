const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-list')
    .setDescription('Generate a grocery list from selected meals'),

  async execute(interaction) {
    const userId = interaction.user.id;

    db.all(
      `SELECT name FROM meals WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Error fetching your meals.', ephemeral: true });
        }

        if (rows.length === 0) {
          return interaction.reply({ content: '🍽️ You have no meals to generate a list from.', ephemeral: true });
        }

        const options = rows.slice(0, 25).map(meal => ({
          label: meal.name,
          value: meal.name
        }));

        const menu = new StringSelectMenuBuilder()
          .setCustomId('meal_select')
          .setPlaceholder('Select meals to generate your grocery list')
          .setMinValues(1)
          .setMaxValues(options.length)
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(menu);

        const message = await interaction.reply({
          content: '🍴 Select meals for your grocery list:',
          components: [row],
          ephemeral: true
        });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000
        });

        collector.on('collect', async selectInteraction => {
          if (selectInteraction.user.id !== userId) {
            return selectInteraction.reply({ content: "This menu isn't for you.", ephemeral: true });
          }

          const selectedMealNames = selectInteraction.values;

          // Now fetch ingredients for the selected meals
          db.all(
            `SELECT ingredients FROM meals WHERE user_id = ? AND name IN (${selectedMealNames.map(() => '?').join(',')})`,
            [userId, ...selectedMealNames],
            (err, ingredientRows) => {
              if (err) {
                console.error(err);
                return selectInteraction.reply({ content: '❌ Error building the grocery list.', ephemeral: true });
              }

              const allIngredients = ingredientRows
                .flatMap(row =>
                  row.ingredients
                    .split(/\r?\n|,\s*/) // newline or comma
                    .map(i => i.trim().toLowerCase())
                    .filter(Boolean)
                );

              const frequencyMap = {};
              for (const item of allIngredients) {
                frequencyMap[item] = (frequencyMap[item] || 0) + 1;
              }

              const groceryList = Object.entries(frequencyMap)
                .map(([item, count]) => count > 1 ? `• ${item} (x${count})` : `• ${item}`)
                .join('\n');

              selectInteraction.update({
                content: `🛒 Grocery list based on your selected meals:\n\n${groceryList}`,
                components: []
              });
            }
          );
        });

        collector.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({ content: '⏱️ You didn’t select any meals in time.', components: [] });
          }
        });
      }
    );
  }
};