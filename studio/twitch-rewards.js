/* Reward discovery belongs to Studio; projects only store the selected event links. */
(() => {
  let connection;
  window.renderTwitchRewardPickers = () => {
    const twitch = connection?.root === state?.root ? connection.twitch : null;
    for (const select of document.querySelectorAll('[data-reward-event]')) {
      const selected = select.value;
      const otherChannel = selected && select.dataset.broadcaster && select.dataset.broadcaster !== twitch?.userId;
      const rewards = (twitch?.rewards.items || []).filter(reward => reward.trigger === select.dataset.trigger);
      select.replaceChildren(new Option('Match by name (legacy)', ''));
      for (const reward of rewards) {
        const unit = reward.trigger === 'bits' ? 'Bits' : 'points';
        select.append(new Option(`${reward.title} · ${reward.cost} ${unit}${!reward.enabled ? ' (disabled)' : reward.paused ? ' (paused)' : ''}`, reward.id));
      }
      if (selected && (otherChannel || !rewards.some(reward => reward.id === selected))) {
        select.append(new Option(otherChannel ? 'Saved reward belongs to another Twitch channel' : 'Saved reward (not in current Twitch list)', selected));
      }
      select.value = selected;
      select.onchange = () => {select.dataset.broadcaster = select.value ? twitch?.userId || '' : '';window.renderTwitchRewardList?.();};
    }
    window.renderTwitchRewardList?.();
  };
  // Every reward on the channel is listed automatically; the project's events define what each one does.
  window.renderTwitchRewardList = () => {
    const twitch = connection?.root === state?.root ? connection.twitch : null;
    const list = document.getElementById('twitch-reward-list');
    if (!list) return;
    const cards = [...document.querySelectorAll('[data-reward-event]')];
    const items = twitch?.rewards.items || [];
    list.hidden = !items.length;
    list.replaceChildren(...items.map(reward => {
      const row = document.createElement('label'), name = document.createElement('span'), select = document.createElement('select');
      row.className = 'reward-row';
      name.textContent = `${reward.title} · ${reward.cost} ${reward.trigger === 'bits' ? 'Bits power-up' : 'points'}${!reward.enabled ? ' (disabled)' : ''}`;
      const options = cards.filter(card => card.dataset.trigger === reward.trigger);
      select.append(new Option(options.length ? 'Not used by any event' : 'No event in this project uses this', ''));
      for (const card of options) {
        const label = document.querySelector(`[data-event-name="${CSS.escape(card.dataset.rewardEvent)}"]`)?.value || card.dataset.rewardEvent;
        select.append(new Option(label, card.dataset.rewardEvent));
      }
      select.value = options.find(card => card.value === reward.id)?.dataset.rewardEvent || '';
      select.disabled = !options.length;
      select.onchange = () => {
        for (const card of options) {
          if (card.value === reward.id) {card.value = '';card.dataset.broadcaster = '';}
          if (card.dataset.rewardEvent === select.value) {card.value = reward.id;card.dataset.broadcaster = twitch.userId;}
        }
        window.renderTwitchRewardPickers();
        document.getElementById('events-form').dispatchEvent(new Event('input', {bubbles: true}));
      };
      row.append(name, select);
      return row;
    }));
  };
  window.setTwitchRewards = data => {
    if (data.root !== state?.root) return;
    connection = data;
    const rewards = data.twitch.rewards;
    const status = !data.twitch.connected ? 'Connect Twitch in Settings to choose rewards.'
      : rewards.errors.length ? rewards.errors.join(' ')
      : rewards.updatedAt ? `${rewards.items.filter(item => item.trigger === 'bits').length} Bits power-ups and ${rewards.items.filter(item => item.trigger === 'points').length} channel-point rewards loaded.`
      : 'Refresh to load your Twitch rewards.';
    for (const element of document.querySelectorAll('[data-rewards-status]')) element.textContent = status;
    for (const button of document.querySelectorAll('[data-refresh-rewards]')) button.disabled = !data.twitch.connected;
    window.renderTwitchRewardPickers();
  };
  window.loadTwitchRewards = async () => {
    try {window.setTwitchRewards(await call('connections-state'));} catch (error) {report(error);}
  };
  for (const button of document.querySelectorAll('[data-refresh-rewards]')) {
    button.onclick = async () => {
      button.disabled = true;
      try {window.setTwitchRewards(await call('twitch-rewards'));}
      catch (error) {report(error);}
      finally {button.disabled = !connection?.twitch.connected;}
    };
  }
})();
