
import { Component, CssClassMap, Element, Event, EventEmitter, Listen, Prop } from '@stencil/core';
import { Animation, AnimationBuilder, AnimationController, ComponentDetail, Config } from '../../index';

import iOSEnterAnimation from './animations/ios.enter';
import iOSLeaveAnimation from './animations/ios.leave';

@Component({
  tag: 'ion-alert',
  styleUrls: {
    ios: 'alert.ios.scss',
    md: 'alert.md.scss',
    wp: 'alert.wp.scss'
  },
  host: {
    theme: 'alert'
  }
})
export class Alert {
  private animation: Animation;
  private activeId: string;
  private inputType: string;
  private hdrId: string;

  @Element() private el: HTMLElement;

  /**
   * @output {ComponentEvent} Emitted after the alert has loaded.
   */
  @Event() ionAlertDidLoad: EventEmitter<ComponentDetail<Alert>>;

  /**
   * @output {ComponentEvent} Emitted after the alert has presented.
   */
  @Event() ionAlertDidPresent: EventEmitter<ComponentDetail<Alert>>;

  /**
   * @output {ComponentEvent} Emitted before the alert has presented.
   */
  @Event() ionAlertWillPresent: EventEmitter<ComponentDetail<Alert>>;

  /**
   * @output {ComponentEvent} Emitted before the alert has dismissed.
   */
  @Event() ionAlertWillDismiss: EventEmitter<ComponentDetail<Alert>>;

  /**
   * @output {ComponentEvent} Emitted after the alert has dismissed.
   */
  @Event() ionAlertDidDismiss: EventEmitter<ComponentDetail<Alert>>;

  /**
   * @output {ComponentEvent} Emitted after the alert has unloaded.
   */
  @Event() ionAlertDidUnload: EventEmitter<ComponentDetail<Alert>>;

  @Prop({ connect: 'ion-animation-controller' }) animationCtrl: AnimationController;
  @Prop({ context: 'config' }) config: Config;

  @Prop() cssClass: string;
  @Prop() title: string;
  @Prop() subTitle: string;
  @Prop() message: string;
  @Prop() buttons: AlertButton[] = [];
  @Prop({ mutable: true }) inputs: AlertInput[] = [];
  @Prop() enableBackdropDismiss: boolean = true;

  @Prop() enterAnimation: AnimationBuilder;
  @Prop() exitAnimation: AnimationBuilder;
  @Prop() alertId: string;

  present() {
    return new Promise<void>(resolve => {
      this._present(resolve);
    });
  }

  private _present(resolve: Function) {
    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }
    this.ionAlertWillPresent.emit({ component: this });

    // get the user's animation fn if one was provided
    let animationBuilder = this.enterAnimation;

    if (!animationBuilder) {
      // user did not provide a custom animation fn
      // decide from the config which animation to use
      animationBuilder = iOSEnterAnimation;
    }

    // build the animation and kick it off
    this.animationCtrl.create(animationBuilder, this.el).then(animation => {
      this.animation = animation;

      animation.onFinish((a: any) => {
        a.destroy();

        const firstInput = this.el.querySelector('[tabindex]') as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }

        this.ionViewDidEnter();
        resolve();
      }).play();
    });
  }

  dismiss() {
    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }
    return new Promise(resolve => {
      this.ionAlertWillDismiss.emit({ component: this });

      // get the user's animation fn if one was provided
      let animationBuilder = this.exitAnimation;
      if (!animationBuilder) {
        // user did not provide a custom animation fn
        // decide from the config which animation to use
        animationBuilder = iOSLeaveAnimation;
      }

      // build the animation and kick it off
      this.animationCtrl.create(animationBuilder, this.el).then(animation => {
        this.animation = animation;

        animation.onFinish((a: any) => {
          a.destroy();
          this.ionAlertDidDismiss.emit({ component: this });

          Context.dom.write(() => {
            this.el.parentNode.removeChild(this.el);
          });

          resolve();
        }).play();
      });
    });
  }


  protected ionViewDidUnload() {
    this.ionAlertDidUnload.emit({ component: this });
  }

  @Listen('ionDismiss')
  protected onDismiss(ev: UIEvent) {
    ev.stopPropagation();
    ev.preventDefault();

    this.dismiss();
  }

  protected ionViewDidLoad() {
    this.ionAlertDidLoad.emit({ component: this });
  }

  protected ionViewDidEnter() {
    this.ionAlertDidPresent.emit({ component: this });
  }

  protected backdropClick() {
    if (this.enableBackdropDismiss) {
      // const opts: NavOptions = {
      //   minClickBlockDuration: 400
      // };
      this.dismiss();
    }
  }

  rbClick(inputIndex: number) {
    this.inputs = this.inputs.map((input, index) => {
      input.checked = (inputIndex === index);
      return input;
    });

    const rbButton = this.inputs[inputIndex];
    this.activeId = rbButton.id;

    if (rbButton.handler) {
      rbButton.handler(rbButton);
    }
  }

  cbClick(inputIndex: number) {
    this.inputs = this.inputs.map((input, index) => {
      if (inputIndex === index) {
        input.checked = !input.checked;
      }
      return input;
    });

    const cbButton = this.inputs[inputIndex];
    if (cbButton.handler) {
      cbButton.handler(cbButton);
    }
  }

  buttonClick(button: any) {
    console.log('buttonClick', button);

    // TODO keep the time of the most recent button click
    // this.lastClick = Date.now();

    let shouldDismiss = true;

    if (button.handler) {
      // a handler has been provided, execute it
      // pass the handler the values from the inputs
      if (button.handler(this.getValues()) === false) {
        // if the return value of the handler is false then do not dismiss
        shouldDismiss = false;
      }
    }

    if (shouldDismiss) {
      this.dismiss();
    }
  }

  getValues(): any {
    if (this.inputType === 'radio') {
      // this is an alert with radio buttons (single value select)
      // return the one value which is checked, otherwise undefined
      const checkedInput = this.inputs.find(i => i.checked);
      console.debug('returning', checkedInput ? checkedInput.value : undefined);
      return checkedInput ? checkedInput.value : undefined;
    }

    if (this.inputType === 'checkbox') {
      // this is an alert with checkboxes (multiple value select)
      // return an array of all the checked values
      console.debug('returning', this.inputs.filter(i => i.checked).map(i => i.value));
      return this.inputs.filter(i => i.checked).map(i => i.value);
    }

    if (this.inputs.length === 0) {
      // this is an alert without any options/inputs at all
      console.debug('returning', 'undefined');
      return undefined;
    }

    // this is an alert with text inputs
    // return an object of all the values with the input name as the key
    const values: {[k: string]: string} = {};
    this.inputs.forEach(i => {
      values[i.name] = i.value;
    });

    console.debug('returning', values);
    return values;
  }

  buttonClass(button: AlertButton): CssClassMap {
    let buttonClass: string[] = !button.cssClass
      ? ['alert-button']
      : [`alert-button`, `${button.cssClass}`];

    return buttonClass.reduce((prevValue: any, cssClass: any) => {
      prevValue[cssClass] = true;
      return prevValue;
    }, {});
  }

  renderCheckbox(inputs: AlertInput[]) {
    if (inputs.length === 0) return null;

    return (
      <div class='alert-checkbox-group'>
        { inputs.map((i, index) => (
          <button onClick={() => this.cbClick(index)} aria-checked={i.checked} id={i.id} disabled={i.disabled} tabIndex={0} role='checkbox' class='alert-tappable alert-checkbox alert-checkbox-button'>
            <div class='button-inner'>
              <div class='alert-checkbox-icon'><div class='alert-checkbox-inner'></div></div>
              <div class='alert-checkbox-label'>
                {i.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  renderRadio(inputs: AlertInput[]) {
    if (inputs.length === 0) return null;

    return (
      <div class='alert-radio-group' role='radiogroup' aria-labelledby={this.hdrId} aria-activedescendant={this.activeId}>
        { inputs.map((i, index) => (
          <button onClick={() => this.rbClick(index)} aria-checked={i.checked} disabled={i.disabled} id={i.id} tabIndex={0} class='alert-radio-button alert-tappable alert-radio' role='radio'>
            <div class='button-inner'>
              <div class='alert-radio-icon'><div class='alert-radio-inner'></div></div>
              <div class='alert-radio-label'>
                {i.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  renderInput(inputs: AlertInput[]) {
    if (inputs.length === 0) return null;

    return (
      <div class='alert-input-group'>
        { inputs.map(i => (
          <div class='alert-input-wrapper'>
            <input
              placeholder={i.placeholder}
              value={i.value}
              type={i.type}
              min={i.min}
              max={i.max}
              id={i.id}
              tabIndex={0}
              class='alert-input'/>
          </div>
        ))}
      </div>
    );
  }

  protected render() {
    const hdrId = `${this.alertId}-hdr`;
    const subHdrId = `${this.alertId}-sub-hdr`;
    const msgId = `${this.alertId}-msg`;

    if (this.title || !this.subTitle) {
      this.hdrId = hdrId;

    } else if (this.subTitle) {
      this.hdrId = subHdrId;
    }

    const alertButtonGroupClass = {
      'alert-button-group': true,
      'alert-button-group-vertical': this.buttons.length > 2
    };

    const buttons = this.buttons
      .map(b => {
        if (typeof b === 'string') {
          b = { text: b };
        }
        return b;
      })
      .filter(b => b !== null);

    // An alert can be created with several different inputs. Radios,
    // checkboxes and inputs are all accepted, but they cannot be mixed.
    const inputTypes: string[] = [];

    this.inputs = this.inputs
      .map((i, index) => {
        let r: AlertInput = {
          type: i.type || 'text',
          name: i.name ? i.name : index + '',
          placeholder: i.placeholder ? i.placeholder : '',
          value: i.value ? i.value : '',
          label: i.label,
          checked: !!i.checked,
          disabled: !!i.disabled,
          id: i.id ? i.id : `alert-input-${this.alertId}-${index}`,
          handler: i.handler ? i.handler : null,
          min: i.min ? i.min : null,
          max: i.max ? i.max : null
        };
        return r;
      })
      .filter(i => i !== null);

      this.inputs.forEach(i => {
      if (inputTypes.indexOf(i.type) < 0) {
        inputTypes.push(i.type);
      }
    });

    if (inputTypes.length > 1 && (inputTypes.indexOf('checkbox') > -1 || inputTypes.indexOf('radio') > -1)) {
      console.warn(`Alert cannot mix input types: ${(inputTypes.join('/'))}. Please see alert docs for more info.`);
    }

    this.inputType = inputTypes.length ? inputTypes[0] : null;

    return [
      <ion-backdrop
        onClick={this.backdropClick.bind(this)}
        class='alert-backdrop'
      />,
      <div class='alert-wrapper'>
        <div class='alert-head'>
          {this.title
              ? <h2 id={hdrId} class='alert-title'>{this.title}</h2>
              : null}
          {this.subTitle
              ? <h2 id={subHdrId} class='alert-sub-title'>{this.subTitle}</h2>
              : null}
        </div>
        <div id={msgId} class='alert-message' innerHTML={this.message}></div>

        {(() => {
          switch (this.inputType) {
            case 'checkbox':
              return this.renderCheckbox(this.inputs);

            case 'radio':
              return this.renderRadio(this.inputs);

            default:
              return this.renderInput(this.inputs);
          }
        })()}

        <div class={alertButtonGroupClass}>
          {buttons.map(b =>
            <button class={this.buttonClass(b)} tabIndex={0} onClick={() => this.buttonClick(b)}>
              <span class='button-inner'>
                {b.text}
              </span>
            </button>
          )}
       </div>
      </div>
    ];
  }

  hostData() {
    return {
      id: this.alertId
    };
  }

}


export interface AlertOptions {
  title?: string;
  subTitle?: string;
  message?: string;
  cssClass?: string;
  mode?: string;
  inputs?: AlertInput[];
  buttons?: (AlertButton|string)[];
  enableBackdropDismiss?: boolean;
}

export interface AlertInput {
  type?: string;
  name?: string | number;
  placeholder?: string;
  value?: string;
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  id?: string;
  handler?: Function;
  min?: string | number;
  max?: string | number;
}

export interface AlertButton {
  text?: string;
  role?: string;
  cssClass?: string;
  handler?: (value: any) => boolean|void;
}
