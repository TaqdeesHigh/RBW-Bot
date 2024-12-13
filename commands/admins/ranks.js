const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranks')
        .setDescription('Display the ELO ranking system information (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const embedPages = [
                createMainEmbed(interaction),
                createSecondEmbed(),
                createThirdEmbed(),
                createFourthEmbed(),
                createFinalEmbed()
            ];

            await interaction.editReply({ embeds: embedPages });
        } catch (error) {
            console.error('Error in ranks command:', error);
            await interaction.editReply({ content: 'There was an error displaying the ranks.' });
        }
    },
};

function createDivisionField(divisionName, ranks) {
    const rankText = ranks.map(rank => 
        `# ${rank.name} [${rank.elo} ELO]\n* Win: +${rank.win} | Loss: -${rank.loss} | Draw: +${rank.draw}`
    ).join('\n\n');
    
    return {
        name: divisionName,
        value: `\`\`\`md\n${rankText}\`\`\``,
        inline: false
    };
}

function createMainEmbed(interaction) {
    return new EmbedBuilder()
        .setTitle('Zomire Ranking System')
        .setDescription('```A complete guide showing all ranks and their ELO requirements```')
        .setColor('#ff0000')
        .setTimestamp()
        .setFooter({ 
            text: 'Zomire', 
            iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .addFields(
            createDivisionField('𝗕𝗿𝗼𝗻𝘇𝗲 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Bronze I', elo: '0-34', win: 30, loss: 10, draw: 5 },
                { name: 'Bronze II', elo: '35-69', win: 28, loss: 12, draw: 5 },
                { name: 'Bronze III', elo: '70-99', win: 26, loss: 14, draw: 5 }
            ]),
            createDivisionField('𝗦𝗶𝗹𝘃𝗲𝗿 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Silver I', elo: '100-134', win: 24, loss: 16, draw: 6 },
                { name: 'Silver II', elo: '135-169', win: 22, loss: 18, draw: 6 },
                { name: 'Silver III', elo: '170-199', win: 20, loss: 20, draw: 6 }
            ]),
            createDivisionField('𝗚𝗼𝗹𝗱 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Gold I', elo: '200-234', win: 18, loss: 22, draw: 7 },
                { name: 'Gold II', elo: '235-269', win: 16, loss: 24, draw: 7 },
                { name: 'Gold III', elo: '270-299', win: 15, loss: 26, draw: 7 }
            ]),
            createDivisionField('𝗣𝗹𝗮𝘁𝗶𝗻𝘂𝗺 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Platinum I', elo: '300-334', win: 14, loss: 28, draw: 8 },
                { name: 'Platinum II', elo: '335-369', win: 13, loss: 30, draw: 8 },
                { name: 'Platinum III', elo: '370-399', win: 12, loss: 32, draw: 8 }
            ])
        );
}

function createSecondEmbed() {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .addFields(
            createDivisionField('𝗗𝗶𝗮𝗺𝗼𝗻𝗱 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Diamond I', elo: '400-434', win: 11, loss: 34, draw: 9 },
                { name: 'Diamond II', elo: '435-469', win: 10, loss: 36, draw: 9 },
                { name: 'Diamond III', elo: '470-499', win: 9, loss: 38, draw: 9 }
            ]),
            createDivisionField('𝗘𝗺𝗲𝗿𝗮𝗹𝗱 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Emerald I', elo: '500-534', win: 8, loss: 40, draw: 10 },
                { name: 'Emerald II', elo: '535-569', win: 7, loss: 42, draw: 10 },
                { name: 'Emerald III', elo: '570-599', win: 6, loss: 45, draw: 10 }
            ]),
            createDivisionField('𝗦𝗮𝗽𝗽𝗵𝗶𝗿𝗲 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Sapphire I', elo: '600-634', win: 8, loss: 40, draw: 10 },
                { name: 'Sapphire II', elo: '635-669', win: 7, loss: 42, draw: 10 },
                { name: 'Sapphire III', elo: '670-699', win: 6, loss: 44, draw: 10 }
            ]),
            createDivisionField('𝗥𝘂𝗯𝘆 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Ruby I', elo: '700-734', win: 8, loss: 40, draw: 10 },
                { name: 'Ruby II', elo: '735-769', win: 7, loss: 42, draw: 10 },
                { name: 'Ruby III', elo: '770-799', win: 6, loss: 44, draw: 10 }
            ])
        );
}

function createThirdEmbed() {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .addFields(
            createDivisionField('𝗖𝗿𝘆𝘀𝘁𝗮𝗹 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Crystal I', elo: '800-834', win: 6, loss: 44, draw: 10 },
                { name: 'Crystal II', elo: '835-869', win: 5, loss: 45, draw: 10 },
                { name: 'Crystal III', elo: '870-899', win: 5, loss: 45, draw: 10 }
            ]),
            createDivisionField('𝗢𝗽𝗮𝗹 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Opal I', elo: '900-934', win: 5, loss: 45, draw: 10 },
                { name: 'Opal II', elo: '935-969', win: 4, loss: 46, draw: 10 },
                { name: 'Opal III', elo: '970-999', win: 4, loss: 46, draw: 10 }
            ]),
            createDivisionField('𝗔𝗺𝗲𝘁𝗵𝘆𝘀𝘁 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Amethyst I', elo: '1000-1129', win: 4, loss: 46, draw: 10 },
                { name: 'Amethyst II', elo: '1130-1164', win: 3, loss: 47, draw: 10 },
                { name: 'Amethyst III', elo: '1165-1199', win: 3, loss: 47, draw: 10 }
            ])
        );
}

function createFourthEmbed() {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .addFields(
            createDivisionField('𝗢𝗯𝘀𝗶𝗱𝗶𝗮𝗻 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Obsidian I', elo: '1200-1234', win: 3, loss: 47, draw: 10 },
                { name: 'Obsidian II', elo: '1235-1269', win: 2, loss: 48, draw: 10 },
                { name: 'Obsidian III', elo: '1270-1399', win: 2, loss: 48, draw: 10 }
            ]),
            createDivisionField('𝗩𝗲𝘁𝗲𝗿𝗮𝗻 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Veteran I', elo: '1400-1434', win: 2, loss: 48, draw: 10 },
                { name: 'Veteran II', elo: '1435-1469', win: 1, loss: 49, draw: 10 },
                { name: 'Veteran III', elo: '1470-1599', win: 1, loss: 49, draw: 10 }
            ]),
            createDivisionField('𝗤𝘂𝗮𝗿𝘁𝘇 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Quartz I', elo: '1600-1634', win: 1, loss: 49, draw: 10 },
                { name: 'Quartz II', elo: '1635-1669', win: 1, loss: 49, draw: 10 },
                { name: 'Quartz III', elo: '1670-1799', win: 1, loss: 49, draw: 10 }
            ])
        );
}

function createFinalEmbed() {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .addFields(
            createDivisionField('𝗧𝗼𝗽𝗮𝘇 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Topaz I', elo: '1800-1834', win: 1, loss: 49, draw: 10 },
                { name: 'Topaz II', elo: '1835-1869', win: 1, loss: 49, draw: 10 },
                { name: 'Topaz III', elo: '1870-1999', win: 1, loss: 49, draw: 10 }
            ]),
            createDivisionField('𝗡𝗲𝘁𝗵𝗲𝗿𝗶𝘁𝗲 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻', [
                { name: 'Netherite I', elo: '2000-2034', win: 6, loss: 45, draw: 10 },
                { name: 'Netherite II', elo: '2035-2069', win: 6, loss: 45, draw: 10 },
                { name: 'Netherite III', elo: '2070+', win: 6, loss: 45, draw: 10 }
            ])
        );
}