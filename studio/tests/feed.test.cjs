const test = require('node:test');
const assert = require('node:assert/strict');
test('activity feed describes every supported event', async () => {
  const {feedEntry} = await import('../../scripts/tss-twitch.mjs');
  assert.deepEqual(feedEntry('channel.follow', {user_name:'Ann'}), {kind:'follow', name:'Ann', detail:''});
  assert.deepEqual(feedEntry('channel.cheer', {is_anonymous:true, bits:100}), {kind:'cheer', name:'Anonymous', detail:'100 Bits'});
  assert.deepEqual(feedEntry('channel.raid', {from_broadcaster_user_name:'Bo', viewers:12}), {kind:'raid', name:'Bo', detail:'Raided with 12 viewers'});
  assert.deepEqual(feedEntry('channel.subscription.gift', {user_name:'Cy', total:5}), {kind:'gift', name:'Cy', detail:'Gifted 5 subs'});
  assert.equal(feedEntry('channel.subscription.message', {user_name:'Di', cumulative_months:7}).detail, 'Resubscribed, 7 months');
  assert.equal(feedEntry('channel.follow', {}), '');
  assert.equal(feedEntry('unknown', {user_name:'X'}), null);
});
test('bits power-ups update the recent bits name like cheers', async () => {
  const {applyEvent} = await import('../../scripts/tss-twitch.mjs');
  const power = {user_name:'Eve', status:'fulfilled'};
  assert.equal(applyEvent({}, 'channel.custom_power_up_redemption.add', power).cheerer, 'Eve');
  assert.deepEqual(applyEvent({cheerer:'A'}, 'channel.custom_power_up_redemption.add', {...power, status:'canceled'}), {cheerer:'A'});
  assert.equal(applyEvent({}, 'channel.cheer', {user_name:'Fay', bits:5}).cheerer, 'Fay');
});
