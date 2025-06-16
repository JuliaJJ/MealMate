const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType
} = require('discord.js');
const db = require('../database/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meal-search')
    .setDescription('Search your saved meals by category or tag'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Step 1: Fetch all distinct categories and tags
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
          ...categories.map(cat => ({ label: `Category: ${cat}`, value: `category:${cat}` })),
          ...tags.map(tag => ({ label: `Tag: #${tag}`, value: `tag:${tag}` }))
        ];

        if (filterOptions.length === 0) {
          return interaction.reply({ content: '📭 No categories or tags found.', ephemeral: true });
        }

        const filterMenu = new StringSelectMenuBuilder()
          .setCustomId('meal_search_filter')
          .setPlaceholder('Choose a category or tag')
          .addOptions(filterOptions);

        const row = new ActionRowBuilder().addComponents(filterMenu);

        const reply = await interaction.reply({
          content: '🔍 Select a filter to search your meals:',
          components: [row],
          ephemeral: true
        });

        const filterCollector = reply.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60_000
        });

        filterCollector.on('collect', async selectInteraction => {
          if (selectInteraction.user.id !== userId) {
            return selectInteraction.reply({
              content: 'This menu isn’t for you.',
              ephemeral: true
            });
          }

          const filterValue = selectInteraction.values[0];
          let query = `SELECT name FROM meals WHERE user_id = ?`;
          const params = [userId];

          if (filterValue.startsWith('category:')) {
            query += ` AND category = ?`;
            params.push(filterValue.split(':')[1]);
          } else if (filterValue.startsWith('tag:')) {
            query += ` AND tags LIKE ?`;
            params.push(`%${filterValue.split(':')[1]}%`);
          }

          db.all(query + ` ORDER BY name ASC`, params, async (err, rows) => {
            if (err) {
              console.error(err);
              return selectInteraction.reply({ content: '❌ Error fetching meals.', ephemeral: true });
            }

            if (!rows.length) {
              return selectInteraction.update({
                content: '📭 No meals found for that filter.',
                components: []
              });
            }

            const mealOptions = rows.map(meal => ({
              label: meal.name,
              value: meal.name
            }));

            const mealSelectMenu = new StringSelectMenuBuilder()
              .setCustomId('meal_search_select')
              .setPlaceholder('Select a meal to view details')
              .addOptions(mealOptions);

            const mealRow = new ActionRowBuilder().addComponents(mealSelectMenu);

            await selectInteraction.update({
              content: '📋 Select a meal to view its full details:',
              components: [mealRow]
            });

            const detailCollector = reply.createMessageComponentCollector({
              componentType: ComponentType.StringSelect,
              time: 60_000
            });

            detailCollector.on('collect', async mealInteraction => {
              if (mealInteraction.user.id !== userId) {
                return mealInteraction.reply({
                  content: 'This menu isn’t for you.',
                  ephemeral: true
                });
              }

              const selectedMeal = mealInteraction.values[0];

              db.get(
                `SELECT name, ingredients, instructions, category, tags FROM meals WHERE user_id = ? AND name = ? COLLATE NOCASE`,
                [userId, selectedMeal],
                (err, row) => {
                  if (err || !row) {
                    console.error(err);
                    return mealInteraction.reply({
                      content: '❌ Error retrieving meal details.',
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

                  mealInteraction.update({
                    content:
                      `📖 **${row.name}**\n\n` +
                      `${categoryDisplay}${tagsDisplay}` +
                      `📝 **Ingredients:**\n${row.ingredients}\n\n` +
                      `👩‍🍳 **Instructions:**\n${row.instructions}`,
                    components: []
                  });
                }
              );
            });
          });
        });

        filterCollector.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({ content: '⏱️ You didn’t make a selection in time.', components: [] });
          }
        });
      });
    });
  }
};