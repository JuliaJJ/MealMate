const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-list')
    .setDescription('Generate a grocery list from selected meals'),

  async execute(interaction) {
    const userId = interaction.user.id;

    db.all(`SELECT DISTINCT category FROM meals WHERE user_id = ?`, [userId], (catErr, categoryRows) => {
      if (catErr) {
        console.error(catErr);
        return interaction.reply({ content: '❌ Error fetching categories.', ephemeral: true });
      }

      db.all(`SELECT tags FROM meals WHERE user_id = ?`, [userId], async (tagErr, tagRows) => {
        if (tagErr) {
          console.error(tagErr);
          return interaction.reply({ content: '❌ Error fetching tags.', ephemeral: true });
        }

        const categories = categoryRows.map(row => row.category).filter(Boolean);
        const tagSet = new Set();
        tagRows.forEach(row => {
          if (row.tags) {
            row.tags.split(',').map(t => t.trim()).forEach(t => tagSet.add(t));
          }
        });
        const tags = [...tagSet];

        const filterOptions = [
          { label: 'No Filter (All Meals)', value: 'all' },
          ...categories.map(cat => ({ label: cat, value: `category:${cat}` })),
          ...tags.map(tag => ({ label: `#${tag}`, value: `tag:${tag}` }))
        ];

        const filterMenu = new StringSelectMenuBuilder()
          .setCustomId('filter-meal-list')
          .setPlaceholder('Filter meals by category or tag')
          .addOptions(filterOptions);

        const filterRow = new ActionRowBuilder().addComponents(filterMenu);

        const reply = await interaction.reply({
          content: '🔍 Filter meals before selecting for your grocery list:',
          components: [filterRow],
          ephemeral: true
        });

        const filterCollector = reply.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000
        });

        filterCollector.on('collect', async selectInteraction => {
          if (selectInteraction.user.id !== userId) {
            return selectInteraction.reply({ content: 'This menu isn’t for you.', ephemeral: true });
          }

          const filterValue = selectInteraction.values[0];
          let query = `SELECT name FROM meals WHERE user_id = ?`;
          let params = [userId];

          if (filterValue.startsWith('category:')) {
            query += ` AND category = ?`;
            params.push(filterValue.split(':')[1]);
          } else if (filterValue.startsWith('tag:')) {
            query += ` AND tags LIKE ?`;
            params.push(`%${filterValue.split(':')[1]}%`);
          }

          db.all(query + ` ORDER BY created_at DESC`, params, async (err, rows) => {
            if (err) {
              console.error(err);
              return selectInteraction.reply({
                content: '❌ Error fetching filtered meals.',
                ephemeral: true
              });
            }

            if (rows.length === 0) {
              return selectInteraction.update({
                content: '🍽️ No meals matched that filter.',
                components: []
              });
            }

            const mealOptions = rows.map(meal => ({
              label: meal.name,
              value: meal.name
            }));

            const mealMenu = new StringSelectMenuBuilder()
              .setCustomId('meal_select')
              .setPlaceholder('Select meals to generate your grocery list')
              .setMinValues(1)
              .setMaxValues(mealOptions.length)
              .addOptions(mealOptions);

            const mealRow = new ActionRowBuilder().addComponents(mealMenu);

            await selectInteraction.deferReply({ ephemeral: true });

            const followup = await selectInteraction.followUp({
              content: '🍴 Select meals for your grocery list:',
              components: [mealRow]
            });

            const mealCollector = followup.createMessageComponentCollector({
              componentType: ComponentType.StringSelect,
              time: 60_000
            });

            mealCollector.on('collect', async mealSelectInteraction => {
              if (mealSelectInteraction.user.id !== userId) {
                return mealSelectInteraction.reply({ content: "This menu isn't for you.", ephemeral: true });
              }

              const selectedMealNames = mealSelectInteraction.values;

              db.all(
                `SELECT ingredients FROM meals WHERE user_id = ? AND name IN (${selectedMealNames.map(() => '?').join(',')})`,
                [userId, ...selectedMealNames],
                (err, ingredientRows) => {
                  if (err) {
                    console.error(err);
                    return mealSelectInteraction.reply({ content: '❌ Error building the grocery list.', ephemeral: true });
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

                  mealSelectInteraction.update({
                    content: `🛒 Grocery list based on your selected meals:\n\n${groceryList}`,
                    components: []
                  });
                }
              );
            });

            mealCollector.on('end', collected => {
              if (!collected.size) {
                selectInteraction.editReply({
                  content: '⏱️ You didn’t select any meals in time.',
                  components: []
                });
              }
            });
          });
        });

        filterCollector.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({
              content: '⏱️ You didn’t select a filter in time.',
              components: []
            });
          }
        });
      });
    });
  }
};