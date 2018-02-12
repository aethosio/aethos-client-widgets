import { bindable } from 'aurelia-framework';

export class ActionBar {
  @bindable actions;

  constructor() {

  }

  activate(params, routeConfig) {
    console.log(this.actions);
  }
}
