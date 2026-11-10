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
      select.onchange = () => {select.dataset.broadcaster = select.value ? twitch?.userId || '' : '';};
    }
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
