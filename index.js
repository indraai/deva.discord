// Copyright (c)2025 Quinn Michaels
//  Discord Deva

import Deva from '@indra.ai/deva';
import pkg from './package.json' with {type:'json'};

import data from './data.json' with {type:'json'};
const {agent,vars} = data.DATA;

// set the __dirname
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';    
const __dirname = dirname(fileURLToPath(import.meta.url));

const info = {
  id: pkg.id,
  name: pkg.name,
  version: pkg.version,
  describe: pkg.description,
  dir: __dirname,
  url: pkg.homepage,
  git: pkg.repository.url,
  bugs: pkg.bugs.url,
  license: pkg.license,
  author: pkg.author,
  owner: pkg.owner,
  copyright: pkg.copyright,
};

import {Client, EmbedBuilder, REST, Routes, SlashCommandBuilder, GatewayIntentBits} from 'discord.js';

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

const DISCORD = new Deva({
  info,
  agent,
  vars,
  utils: {
    translate(input) {return input.trim()},
    parse(input) {return input.trim()},
    process(input) {return input.trim()},
  },
  listeners: {},
  modules: {},
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
      return new Promise((resolve, reject) => {
        for (let [key,value] of opts.message.mentions.users) {
          const user = value.username === this.vars.accts[opts.key].username;
          const descrim = value.discriminator === this.vars.accts[opts.key].discriminator;
          const isAuthor = opts.message.author.id === value.id
          if (user && descrim && !isAuthor) this.func.reply(opts);
        }
        return resolve(true)
      });
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
      this.vars.accts[key] = {
        id: _user.id,
        username: _user.username,
        discriminator: _user.discriminator,
        avatar: _user.displayAvatarURL
      };
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

    /**************
    func: reply
    params: opts
    describe: Reply to a message from the on message handler.
    ***************/
    reply(opts) {

      const {mentions, content, author, channel} = opts.message;
      const {guild} = channel;

      let msg = content;

      const header = [
        '::begin:header',
        `info: You are talking with @${author.globalName} in room #${channel.name} about ${channel.topic}`,
        '::end:header',
      ].join('\n');

      const channels = guild.channels.cache.map(channel => {
        const {id, name} = channel;
        const msgReg = new RegExp(`<#${id}>`, 'g');
        msg = msg.replace(msgReg, `#${name}`);
        return {
          id,
          name,
        }
      });

      const members = guild.members.cache.map(member => {
        const {id, globalName, username} = member.user;
        const name = globalName || username;
        const msgReg = new RegExp(`<@${id}>`, 'g');
        msg = msg.replace(msgReg, `@${name}`);
        return {
          id,
          name,
        }
      });

      channel.sendTyping();
      this.prompt(msg);
      this.question(`${this.askChr}${opts.key} ask ${msg}`, {
        header,
      }).then(chat => {
        opts.message.reply(chat.a.text);
      }).catch(err => {
        opts.message.reply(this.vars.messages.error);
        this.error(err, opts);
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
  },
  async onExit(data) {
    try {
      for (const key in this.modules) {
        await this.modules[key].client.destroy();
      }
    } catch (e) {
      return this.error(e, data);
    } finally {
      return data;
    }
  },
  async onReady(data, resolve) {
    const { personal } = this.security();
    this.vars.active_agent = personal[0].key;

    try {
      for (const acct of personal) {
        const {key,token,clientId} = acct;
        this.vars.accts[key] = {};
        this.modules[key] ={
          rest: new REST({ version: '10' }).setToken(token),
          client: new Client({intents:[
            GatewayIntentBits.Guilds,
        		GatewayIntentBits.GuildMessages,
        		GatewayIntentBits.MessageContent,
        		GatewayIntentBits.GuildMembers,
          ]}),

        }
        if (commands[key]) await this.modules[key].rest.put(Routes.applicationCommands(clientId), { body: commands[key] });
        await this.modules[key].client.login(token);

        this.modules[key].client.on('ready', ready => {
          return this.func.onDiscordReady({key,ready});
        });
        await this.modules[key].client.on('messageCreate', message => {
          return this.func.onDiscordMessage({key,message});
        });
        await this.modules[key].client.on('guildMemberAdd', member => {
          return this.func.onGuildMemberAdd({key,member});
        });
        await this.modules[key].client.on('error', err => {
          return this.func.onDiscordError({key,err});
        })
        await this.modules[key].client.on('warn', warn => {
          return this.func.onDiscordWarn({key,warn})
        });
        await this.modules[key].client.on('interactionCreate', async interaction => {
        	if (!interaction.isCommand()) return;
        	const { commandName } = interaction;
          if (this.func[commandName]) this.func[commandName](interaction);
        });
        this.prompt(`acct: ${key}`);
      }
    } catch (e) {
      return this.error(e);
    } finally {
      this.prompt(this.vars.messages.ready);
      return resolve(data);
    }
  },
  onError(err, data, reject) {
    console.log('error \n', err);
    return reject(err);
  }
});
export default DISCORD
