const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranks')
        .setDescription('Display the ELO ranking system information (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setTitle('Zomire Ranking System')
            .setDescription('```A complete guide showing all ranks and their ELO requirements```')
            .setColor('#ff0000')
            .setFooter({ 
                text: 'Zomire', 
                iconURL: interaction.guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp()
            .addFields(
                {
                    name: '𝗕𝗿𝗼𝗻𝘇𝗲 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Bronze I [0-34 ELO]
* Win: +30 | Loss: -10 | Draw: +5

# Bronze II [35-69 ELO]
* Win: +28 | Loss: -12 | Draw: +5

# Bronze III [70-99 ELO]
* Win: +26 | Loss: -14 | Draw: +5\`\`\``,
                    inline: false
                },
                {
                    name: '𝗦𝗶𝗹𝘃𝗲𝗿 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Silver I [100-134 ELO]
* Win: +24 | Loss: -16 | Draw: +6

# Silver II [135-169 ELO]
* Win: +22 | Loss: -18 | Draw: +6

# Silver III [170-199 ELO]
* Win: +20 | Loss: -20 | Draw: +6\`\`\``,
                    inline: false
                },
                {
                    name: '𝗚𝗼𝗹𝗱 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Gold I [200-234 ELO]
* Win: +18 | Loss: -22 | Draw: +7

# Gold II [235-269 ELO]
* Win: +16 | Loss: -24 | Draw: +7

# Gold III [270-299 ELO]
* Win: +15 | Loss: -26 | Draw: +7\`\`\``,
                    inline: false
                },
                {
                    name: '𝗣𝗹𝗮𝘁𝗶𝗻𝘂𝗺 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Platinum I [300-334 ELO]
* Win: +14 | Loss: -28 | Draw: +8

# Platinum II [335-369 ELO]
* Win: +13 | Loss: -30 | Draw: +8

# Platinum III [370-399 ELO]
* Win: +12 | Loss: -32 | Draw: +8\`\`\``,
                    inline: false
                }
            );

        const embed2 = new EmbedBuilder()
            .setColor('#ff0000')
            .addFields(
                {
                    name: '𝗗𝗶𝗮𝗺𝗼𝗻𝗱 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Diamond I [400-434 ELO]
* Win: +11 | Loss: -34 | Draw: +9

# Diamond II [435-469 ELO]
* Win: +10 | Loss: -36 | Draw: +9

# Diamond III [470-499 ELO]
* Win: +9 | Loss: -38 | Draw: +9\`\`\``,
                    inline: false
                },
                {
                    name: '𝗘𝗺𝗲𝗿𝗮𝗹𝗱 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Emerald I [500-534 ELO]
* Win: +8 | Loss: -40 | Draw: +10

# Emerald II [535-569 ELO]
* Win: +7 | Loss: -42 | Draw: +10

# Emerald III [570-599 ELO]
* Win: +6 | Loss: -45 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗦𝗮𝗽𝗽𝗵𝗶𝗿𝗲 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Sapphire I [600-634 ELO]
* Win: +8 | Loss: -40 | Draw: +10

# Sapphire II [635-669 ELO]
* Win: +7 | Loss: -42 | Draw: +10

# Sapphire III [670-699 ELO]
* Win: +6 | Loss: -44 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗥𝘂𝗯𝘆 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Ruby I [700-734 ELO]
* Win: +8 | Loss: -40 | Draw: +10

# Ruby II [735-769 ELO]
* Win: +7 | Loss: -42 | Draw: +10

# Ruby III [770-799 ELO]
* Win: +6 | Loss: -44 | Draw: +10\`\`\``,
                    inline: false
                }
            );

        const embed3 = new EmbedBuilder()
            .setColor('#ff0000')
            .addFields(
                {
                    name: '𝗖𝗿𝘆𝘀𝘁𝗮𝗹 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Crystal I [800-834 ELO]
* Win: +6 | Loss: -44 | Draw: +10

# Crystal II [835-869 ELO]
* Win: +5 | Loss: -45 | Draw: +10

# Crystal III [870-899 ELO]
* Win: +5 | Loss: -45 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗢𝗽𝗮𝗹 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Opal I [900-934 ELO]
* Win: +5 | Loss: -45 | Draw: +10

# Opal II [935-969 ELO]
* Win: +4 | Loss: -46 | Draw: +10

# Opal III [970-999 ELO]
* Win: +4 | Loss: -46 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗔𝗺𝗲𝘁𝗵𝘆𝘀𝘁 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Amethyst I [1000-1129 ELO]
* Win: +4 | Loss: -46 | Draw: +10

# Amethyst II [1130-1164 ELO]
* Win: +3 | Loss: -47 | Draw: +10

# Amethyst III [1165-1199 ELO]
* Win: +3 | Loss: -47 | Draw: +10\`\`\``,
                    inline: false
                }
            );

        const embed4 = new EmbedBuilder()
            .setColor('#ff0000')
            .addFields(
                {
                    name: '𝗢𝗯𝘀𝗶𝗱𝗶𝗮𝗻 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Obsidian I [1200-1234 ELO]
* Win: +3 | Loss: -47 | Draw: +10

# Obsidian II [1235-1269 ELO]
* Win: +2 | Loss: -48 | Draw: +10

# Obsidian III [1270-1399 ELO]
* Win: +2 | Loss: -48 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗩𝗲𝘁𝗲𝗿𝗮𝗻 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Veteran I [1400-1434 ELO]
* Win: +2 | Loss: -48 | Draw: +10

# Veteran II [1435-1469 ELO]
* Win: +1 | Loss: -49 | Draw: +10

# Veteran III [1470-1599 ELO]
* Win: +1 | Loss: -49 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗤𝘂𝗮𝗿𝘁𝘇 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Quartz I [1600-1634 ELO]
* Win: +1 | Loss: -49 | Draw: +10

# Quartz II [1635-1669 ELO]
* Win: +1 | Loss: -49 | Draw: +10

# Quartz III [1670-1799 ELO]
* Win: +1 | Loss: -49 | Draw: +10\`\`\``,
                    inline: false
                }
            );

        const embed5 = new EmbedBuilder()
            .setColor('#ff0000')
            .addFields(
                {
                    name: '𝗧𝗼𝗽𝗮𝘇 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Topaz I [1800-1834 ELO]
* Win: +1 | Loss: -49 | Draw: +10

# Topaz II [1835-1869 ELO]
* Win: +1 | Loss: -49 | Draw: +10

# Topaz III [1870-1999 ELO]
* Win: +1 | Loss: -49 | Draw: +10\`\`\``,
                    inline: false
                },
                {
                    name: '𝗡𝗲𝘁𝗵𝗲𝗿𝗶𝘁𝗲 𝗗𝗶𝘃𝗶𝘀𝗶𝗼𝗻',
                    value: `\`\`\`md
# Netherite I [2000-2034 ELO]
* Win: +6 | Loss: -45 | Draw: +10

# Netherite II [2035-2069 ELO]
* Win: +6 | Loss: -45 | Draw: +10

# Netherite III [2070+ ELO]
* Win: +6 | Loss: -45 | Draw: +10\`\`\``,
                    inline: false
                }
            );

        await interaction.editReply({ embeds: [embed, embed2, embed3, embed4, embed5] });
    },
};