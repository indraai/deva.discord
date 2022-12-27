// Copyright (c)2021 Quinn Michaels
//  Discord Deva

const fs = require('fs');
const path = require('path');
const {Client, Intents, EmbedBuilder, REST, Routes, SlashCommandBuilder, GatewayIntentBits} = require('discord.js');

const data_path = path.join(__dirname, 'data.json');
const {agent,vars} = require(data_path).data;


const icmd = new SlashCommandBuilder().setName('veda').setDescription('Retrieve the Vedas')
  .addStringOption(opt => {
    return opt.setName('book')
              .setDescription('Get a book from the Vedas.')
              .setRequired(false);
  })
  .addStringOption(opt => {
    return opt.setName('view')
              .setDescription('View a hymn from the Vedas.')
              .setRequired(false);
  });


const commands = {
  indra: [icmd].map(command => command.toJSON()),
};
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
    discord: {},
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
    onDiscordMessage(opts) {
      // this.func.tweetMessage(message);
      return;
    },
    onDiscordWarn(opts) {
      return;
    },
    onDiscordError(opts) {
      console.error(opts.error);
      return;
    },
    onGuildMemberAdd(opts) {
      return;
    },
    onDiscordReady(opts) {
      const {key, ready} = opts;
      const _user = this.modules[key].client.user;
      this.agent.discord[key] = {
        id: _user.id,
        username: _user.username,
        discriminator: _user.discriminator,
        avatar: _user.displayAvatarURL
      };
      this.prompt(`${agent} - this.vars.messages.ready`)
      return;
    },
    /***********
      func: send
      params: opts [text,room]
      describe: sends a message to a specified title room.
    ***********/
    send(opts) {
      if (!opts) return;
      const {key, text, room} = opts;
      let _text = text;
      const channels = this.modules[key].client.channels.cache.filter(ch => ch.name === room);
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
    async veda(interaction) {
      const book = interaction.options.getString('book');
      const view = interaction.options.getString('view');
      let text;
      let question = `#veda books`;
      if (book) question = `#veda book ${book}`;
      else if (view) question = `#veda view ${view}`;

      const item = await this.question(question);
      const {data} = item.a;
      if (view) {
        console.log(data);
        text = [
          `**${data.title}**`,
          data.feecting.replace(/p\:/g, '\n')
        ].join('\n');
      }
      else if (book) {
        text = data.map((itm,idx) => {
          return `${itm.key} - ${itm.title}`;
        }).join('\n');
      }
      else {
        text = data.map((itm,idx) => {
          const mk = idx + 1;
          return `${itm.key} - ${itm.title}`;
        }).join('\n')
      }
      const dropoff = 1500
      if (text.length < dropoff) {
        await interaction.reply({ content:text, ephemeral: false });
      }
      else {
        // here we have to split the message into 2000 character lines
        const replies = [];
        let temp = [];
        let t = 0;
        text.split('\n').forEach((itm,idx) => {
          t = t + itm.length;
          if (t < dropoff) {
            temp.push(itm);
          }
          else {
            replies.push(temp.join('\n'));
            t = itm.length;
            temp = [];
            temp.push(itm);
          }
        });
        await interaction.reply({ content:replies[0], ephemeral: false });
      }
    },

  },
  methods: {
    send(packet) {
      return this.func.send({
        key: packet.q.meta.params[2] || this.vars.active_agent,
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
  async onStop() {
    try {
      for (const acct of this.client.services.discord) {
        const {key} = this.client.services.discord[acct];
        await this.modules[key].client.destroy();
      }
    } catch (e) {
      return this.error(e);
    } finally {
      return this.exit();
    }
  },
  onError(err) {
    console.error(err);
  },
  async onInit() {
    this.prompt(this.vars.messages.init);
    const { discord } = this.client.services;
    this.vars.active_agent = discord[0].key;
    let ukey;

    try {
      for (const acct in this.client.services.discord) {
        const {key,token,clientId} = this.client.services.discord[acct];
        this.agent.discord[key] = {};
        this.modules[key] ={
          rest: new REST({ version: '10' }).setToken(token),
          client: new Client({intents:[GatewayIntentBits.Guilds]}),
        }
        if (commands[key]) await this.modules[key].rest.put(Routes.applicationCommands(clientId), { body: commands[key] });
        await this.modules[key].client.login(token);

        this.modules[key].client.on('ready', ready => {
            return this.func.onDiscordReady({key,ready});
          })
          .on('messageCreate', message => {
            return this.func.onDiscordMessage({key,message});
          })
          .on('guildMemberAdd', member => {
            return this.func.onGuildMemberAdd({key,member});
          })
          .on('error', err => {
            return this.func.onDiscordError({key,err});
          })
          .on('warn', warn => {
            return this.func.onDiscordWarn({key,warn})
          })
          .on('interactionCreate', async interaction => {
          	if (!interaction.isCommand()) return;
          	const { commandName } = interaction;
            if (this.func[commandName]) this.func[commandName](interaction);
          });

      }
    } catch (e) {
      console.log('KEY', ukey);
      return this.error(e);
    } finally {
      return this.start();
    }
  },
});
module.exports = DISCORD
