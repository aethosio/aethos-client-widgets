import { PLATFORM } from 'aurelia-pal';

export { ActionBar } from './action-bar';

export function configure(config) {
  console.log('Configuring aethos-client-widgets library');
  config.globalResources([
    PLATFORM.moduleName('./action-bar')
  ]);
}
