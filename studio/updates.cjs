// Downloads are opt-in; installation only happens after Studio settles unsaved edits.
function createUpdates({updater, version, enabled, disabledReason, send, notify = () => {}}) {
  let state = {status: enabled ? 'idle' : 'disabled', currentVersion: version, message: disabledReason || ''};
  let busy = false;
  const publish = patch => {state = {...state, ...patch}; send({type:'update', ...state});};
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.disableDifferentialDownload = false;
  updater.disableWebInstaller = true;
  const previousLogger = updater.logger;
  updater.logger = Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => {
    previousLogger?.[level]?.(message);
    const text = String(message);
    if (text.includes('Full:') || text.includes('Differential download:')) publish({downloadMode:'changes'});
    if (text.includes('fallback to full download')) {
      publish({downloadMode:'full'});
      send({type:'log', kind:'info', text:'Changed-block update unavailable; downloading the full update. Your projects are preserved.\n'});
    }
  }]));
  updater.on('checking-for-update', () => publish({status:'checking', message:''}));
  updater.on('update-available', info => {
    publish({status:'available', version:info.version, message:''});
    notify(info.version);
  });
  updater.on('update-not-available', () => publish({status:'current', message:''}));
  updater.on('download-progress', progress => publish({status:'downloading', percent:Math.round(progress.percent), transferred:progress.transferred, total:progress.total}));
  updater.on('update-downloaded', info => publish({status:'downloaded', version:info.version, message:''}));
  updater.on('error', () => publish({status:'error', message:'Could not retrieve the update. Check your connection and try again.'}));
  async function perform(operation) {
    busy = true;
    try {await operation();} catch {publish({status:'error', message:'Could not retrieve the update. Check your connection and try again.'});}
    finally {busy = false;}
    return {...state};
  }
  return {
    state: () => ({...state}),
    check() {
      if (!enabled || busy || ['available','downloading','downloaded','installing'].includes(state.status)) return Promise.resolve({...state});
      return perform(() => updater.checkForUpdates());
    },
    download() {
      if (!enabled || busy || state.status !== 'available') return Promise.resolve({...state});
      publish({status:'downloading', percent:0, downloadMode:'preparing', transferred:0, total:0});
      return perform(() => updater.downloadUpdate());
    },
    install() {
      if (!enabled || state.status !== 'downloaded') throw Error('Download an update before installing.');
      publish({status:'installing'});
      updater.quitAndInstall(true, true);
    }
  };
}
module.exports = {createUpdates};
