const { AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const config = require('../../config.json');
const fs = require('fs').promises;
const path = require('path');

class GameLogger {
  constructor(client) {
    this.client = client;
  }

  async logGameStart(gameData) {
    const { gameNumber, gamemode, selectionMethod, teams, startTime, mapName, serverRegion, spectators } = gameData;
    const logChannel = this.client.channels.cache.get(config.logsChannel);

    if (!logChannel) {
      console.error('Game log channel not found. Check your config.json file.');
      return;
    }

    const canvas = Canvas.createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    await this.drawBackground(ctx, canvas.width, canvas.height);
    this.drawHeader(ctx, gameNumber, gamemode, canvas.width);
    this.drawDetailedGameInfo(ctx, gameData, canvas.width);
    this.drawTeams(ctx, teams, canvas.width, canvas.height);
    this.drawSpectators(ctx, spectators, canvas.width, canvas.height);
    await this.drawBotLogo(ctx, canvas.width, canvas.height);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'game-log.png' });
    await logChannel.send({ files: [attachment] });
  }

  async drawBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1b26');
    gradient.addColorStop(1, '#24283b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < width; i += 20) {
      for (let j = 0; j < height; j += 20) {
        ctx.beginPath();
        ctx.arc(i, j, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawHeader(ctx, gameNumber, gamemode, width) {
    ctx.font = 'bold 120px "Arial", sans-serif';
    ctx.fillStyle = '#7aa2f7';
    ctx.textAlign = 'center';
    ctx.fillText(`Game #${gameNumber}`, width / 2, 140);

    ctx.font = '60px "Arial", sans-serif';
    ctx.fillStyle = '#bb9af7';
    ctx.fillText(`${gamemode.toUpperCase()} Match`, width / 2, 220);
  }

  drawDetailedGameInfo(ctx, gameData, width) {
    const { startTime, selectionMethod, mapName, serverRegion } = gameData;
    const infoX = 50;
    const infoY = 300;
    const lineHeight = 40;
    const labelWidth = 300;

    ctx.font = 'bold 30px "Arial", sans-serif';
    ctx.textAlign = 'left';

    const infoItems = [
      { label: 'Start Time', value: startTime.toLocaleString() },
      { label: 'Selection Method', value: selectionMethod },
      { label: 'Map', value: mapName },
      { label: 'Server Region', value: serverRegion },
      { label: 'Players', value: `${gameData.teams.reduce((acc, team) => acc + team.length, 0)} (${gameData.gamemode})` }
    ];

    infoItems.forEach((item, index) => {
      ctx.fillStyle = '#7dcfff';
      ctx.fillText(`${item.label}:`, infoX, infoY + index * lineHeight);
      
      ctx.fillStyle = '#c0caf5';
      ctx.textAlign = 'right';
      ctx.fillText(item.value, width - infoX, infoY + index * lineHeight);
      ctx.textAlign = 'left';
    });
  }

  drawTeams(ctx, teams, width, height) {
    const teamColors = ['#f7768e', '#9ece6a'];
    const cardWidth = 800;
    const cardHeight = 500;
    const startY = height - cardHeight - 50;

    teams.forEach((team, index) => {
      const startX = index === 0 ? 50 : width - cardWidth - 50;
      this.drawTeamCard(ctx, startX, startY, cardWidth, cardHeight, `Team ${index + 1}`, team, teamColors[index]);
    });
  }

  drawTeamCard(ctx, x, y, width, height, title, members, color) {
    ctx.fillStyle = 'rgba(36, 40, 59, 0.8)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    this.roundRect(ctx, x, y, width, height, 20);

    ctx.font = 'bold 50px "Arial", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 30, y + 70);

    ctx.font = '30px "Arial", sans-serif';
    ctx.fillStyle = '#c0caf5';
    members.forEach((member, index) => {
      const avatarSize = 40;
      const avatarY = y + 120 + index * 60;
      
      ctx.fillStyle = '#4e5173';
      ctx.beginPath();
      ctx.arc(x + 50, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#c0caf5';
      ctx.fillText(member.user.username, x + 100, avatarY + 30);
    });
  }

  drawSpectators(ctx, spectators, width, height) {
    if (!spectators || spectators.length === 0) return;

    const spectatorY = height - 60;
    ctx.font = 'bold 24px "Arial", sans-serif';
    ctx.fillStyle = '#7aa2f7';
    ctx.textAlign = 'center';
    ctx.fillText(`Spectators: ${spectators.map(s => s.username).join(', ')}`, width / 2, spectatorY);
  }

  async drawBotLogo(ctx, width, height) {
    try {
      const avatarURL = this.client.user.displayAvatarURL({ format: 'png' });
      const avatarResponse = await fetch(avatarURL);
      const avatarBuffer = await avatarResponse.arrayBuffer();
      const avatar = new Canvas.Image();
      avatar.src = Buffer.from(avatarBuffer);

      const size = 120;
      const x = width - size - 30;
      const y = 30;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
      ctx.restore();

      ctx.shadowColor = '#7aa2f7';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#7aa2f7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    } catch (error) {
      console.error('Error loading bot avatar:', error);
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

module.exports = GameLogger;