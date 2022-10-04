// Copyright (c)2021 Quinn Michaels
// Discord Deva test file

const {expect} = require('chai')
const discord = require('./index.js');

describe(discord.me.name, () => {
  beforeEach(() => {
    return discord.init()
  });
  it('Check the SVARGA Object', () => {
    expect(discord).to.be.an('object');
    expect(discord).to.have.property('me');
    expect(discord).to.have.property('vars');
    expect(discord).to.have.property('listeners');
    expect(discord).to.have.property('methods');
    expect(discord).to.have.property('modules');
  });
})
