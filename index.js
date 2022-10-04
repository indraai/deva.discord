// Copyright (c)2021 Quinn Michaels
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {Client,Intents,MessageEmbed} = require('discord.js');

const data_path = path.join(__dirname, 'data.json');
const {agent,vars} = require(data_path).data;

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const cmdhymn = new SlashCommandBuilder().setName('hymn').setDescription('Retrieve a RigVeda Hymn')
  .addStringOption(opt => {
    return opt.setName('num').setDescription('The Hymn to view.').setRequired(true);
  });

const commands = [
        cmdhymn,
      ].map(command => command.toJSON());

const Deva = require('@indra.ai/deva');
const DISCORD = new Deva({
  agent: {
    uid: agent.uid,
    key: agent.key,
    name: agent.name,
    describe: agent.describe,
    prompt: agent.prompt,
    voice: agent.voice,
    profile: agent.profile,
    translate(input) {
      return input.trim();
    },
    parse(input) {
      return input.trim();
    }
  },
  vars,
  listeners: {
    system(packet) {
      // log system packets to discord.
      if (!this.active) return;
      if (!packet) return;
      return;
      const {state,pattern} = packet.data;
      const relay = state && this.func[state] && typeof this.func[state] === 'function';
      if (relay) this.func[state](packet.data);
    }
  },
  modules: {
    client: false,
    rest: false,
  },
  deva: {},
  func: {
    /***********
      func: say(packet)
      params: packet.data
      describe:
    ***********/
    say(data) {
      const {state,pattern} = data;
      let text = pattern.matched[1] ? pattern.matched[1] : false;
      if (!text) return Promise.resolve('NOTHING TO SEND');
      this.func.send({text,room:'public'});
    },
    emote(data) {
      return this.func.say(data);
    },
    onDiscordMessage(message) {
      // this.func.tweetMessage(message);
    },
    onDiscordWarn(warning) {},
    onDiscordError(error) {
      console.error(error);
    },
    onGuildMemberAdd(member) {},
    onDiscordReady() {
      const _user = this.modules.client.user;
      this.agent.discord = {
        id: _user.id,
        username: _user.username,
        discriminator: _user.discriminator,
        avatar: _user.displayAvatarURL
      };
      this.prompt(this.vars.messages.ready)
    },
    /***********
      func: send
      params: opts [text,room]
      describe: sends a message to a specified title room.
    ***********/
    send(opts) {
      if (!opts) return;
      const {text, room} = opts;
      let _text = text;
      const channels = this.modules.client.channels.cache.filter(ch => ch.name === room);
      // const buffer = message.buffer ? new this.modules.DiscordServer.Attachment(message.buffer, 'attachment.png') : false;

      const entities = {
        mentions: text ? text.match(/@\w*/g) : false,
        emoji: text ? text.match(/:\w*:/g) : false,
        hash: text ? text.match(/#\w*/g) : false,
      };

      // strange things
      return new Promise((resolve, reject) => {
        channels.forEach((channel,key) => {
          if (entities.mentions) entities.mentions.forEach(mention => {
            const username = mention.replace(/@/g, '').toLowerCase();
            const usernameReg = new RegExp(mention, 'g');
            const member = channel.members.find(member => member.user.username === username);
            if (member) _text = _text.replace(usernameReg, `${member.user.username} <@${member.user.id}>`);
          });

          if (entities.hash) entities.hash.forEach(hash => {
            const room = hash.replace(/#/g, '').toLowerCase();
            const roomReg = new RegExp(hash, 'g');
            const refRoom = channel.guild.channels.cache.find(ch => ch.name === room);
            if (refRoom) _text = _text.replace(roomReg, `<#${refRoom.id}>`);
          });

          if (entities.emoji) entities.emoji.forEach(emoji => {
            const emj = emoji.replace(/:/g, '');
            const emojiReg = new RegExp(emoji, 'g');
            const refEmoji = channel.guild.emojis.cache.find(e => e.name === emj);
            if (refEmoji) _text = _text.replace(emojiReg, `<:${emj}:${refEmoji.id}>`);
          });
          channel.send(_text).catch(reject);
        })
        return resolve(this.vars.messages.sent)
      });
    },

    /***********
      func: hymn
      params: interaction
      describe: async hymn function relays an interaction to call a hymn from the vedas deva.
    ***********/
    async hymn(interaction) {
      const hymn = interaction.options.getString('num');
      let question = `#veda view ${hymn}`;

      const item = await this.question(question);
      const {data} = item.a;

      let _embed;
      if (!data.title) {
        _embed = new MessageEmbed()
          .setColor('#336699')
          .setDescription(item.a.text);
      }
      else {
        _embed = new MessageEmbed()
          .setColor('#336699')
          .setTitle(data.title)
          .setURL(`http://indra.church/rigveda/hymns/${data.key}.html`)
          .setDescription(data.feecting.replace(/p:/g, ''));
      }

      await interaction.reply({embeds:[_embed], ephemeral: false});
    },

  },
  methods: {
    send(packet) {
      return this.func.send({
        text: packet.q.text || false,
        room: packet.q.meta.params[1] || 'public',
      });
    },
    uid(packet) {
      return Promise.resolve(this.uid());
    },
    status(packet) {
      return this.status();
    },
    help(packet) {
      return new Promise((resolve, reject) => {
        this.lib.help(packet.q.text, __dirname).then(text => {
          return resolve({text})
        }).catch(reject);
      });
    },
  },
  onStart() {
    this.modules.client = new Client({intents:[Intents.FLAGS.GUILDS,Intents.FLAGS.GUILD_MESSAGES]});
    this.modules.client.on('ready', this.func.onDiscordReady)
      .on('messageCreate', this.func.onDiscordMessage)
      .on('guildMemberAdd', this.func.onGuildMemberAdd)
      .on('error', this.func.onDiscordError)
      .on('warn', this.func.onDiscordWarn)
      .on('interactionCreate', async interaction => {
      	if (!interaction.isCommand()) return;
      	const { commandName } = interaction;
        if (this.func[commandName]) this.func[commandName](interaction);
      });
    return this.enter();
  },
  onStop() {
    this.modules.client.destroy();
    return this.exit();
  },
  onEnter() {
    return this.modules.client.login(this.client.services.discord.token).then(loggedin => {
      return this.done();
    }).catch(err => {
      return this.error(err);
    });
  },
  onInit() {
    this.prompt(this.vars.messages.init);
    const { clientId, guildId } = this.client.services.discord;

    const this.modules.rest = new REST({ version: '10' }).setToken(this.client.services.discord.token);

    return this.modules.rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands }).then(() => {
      return this.start();
    }).catch(this.error);

  },
});
module.exports = DISCORD
