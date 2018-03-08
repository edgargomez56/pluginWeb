"use strict";
define([
    'knockout',
    'text!./activity-block-component.html',
    '../constants',
    '../i18n',

    // non-referenced:
    'css!./activity-block-component.css',
    '../utils/ko-text-highlighted-binding',
    '../utils/ko-enter-pressed-binding',
    '../utils/ko-escape-pressed-binding'
], (ko,
    template,
    constants,
    i18n) => {

    const STATUS_CLASS_POSITIVE = 'positive';
    const STATUS_CLASS_NEUTRAL = 'neutral';
    const STATUS_CLASS_NEGATIVE = 'negative';
    const STATUS_CLASS_DISABLED = 'disabled';

    class ActivityBlockComponent {
        constructor(params, componentInfo) {
            /** @type ActivityModel */
            this.activity = ko.unwrap(params.activity);
            this.attributeDescription = params.attributeDescription;

            this.searchString = params.searchString || null;

            /** @type Element */
            this.elementConainer = componentInfo.element;

            this.title = this.outputProperty(constants.ACTIVITY_PROPERTY_SEARCH_BY);
            this.address = this.outputProperty(constants.ACTIVITY_PROPERTY_ADDRESS);

            this.meterReading = ko.observable(this.activity.meterReading);
            this.enteredMeterReading = ko.observable(this.meterReading());
            this.meterReadingError = ko.observable(null);

            this.meterReadingEntered = params.meterReadingEntered;
            this.activityDetailsRequested = params.activityDetailsRequested;

            this.status = '';
            this.statusClass = '';
            this.statusDetails = ko.pureComputed(() => {
                if (this.activity.isComplete() && this.meterReading()) {
                    return this.meterReading();
                }
                return '';
            });

            this.isExpanded = ko.observable(false);

            this.blockExpandedSignal = params.blockExpandedSignal;
            this.submitBlockedSignal = params.submitBlockedSignal;
            this.submitUnlockedSignal = params.submitUnlockedSignal;

            if (this.activity.isComplete()) {
                this.statusClass = STATUS_CLASS_POSITIVE;
                if (this.activity.isAwaitingSynchronization()) {
                    this.status = this.i18n('activity-status-complete');
                } else {
                    this.status = this.i18n('activity-status-complete');
                    this.statusClass = STATUS_CLASS_DISABLED;
                }
            } else if (!this.activity.isPending() && !this.activity.isComplete()) {
                switch (this.activity.status) {
                    case constants.ACTIVITY_STATUS_COMPLETE:
                        this.status = this.i18n('activity-status-complete');
                        this.statusClass = STATUS_CLASS_POSITIVE;
                        break;
                    case constants.ACTIVITY_STATUS_STARTED:
                        this.status = this.i18n('activity-status-started');
                        this.statusClass = STATUS_CLASS_NEUTRAL;
                        break;
                    case constants.ACTIVITY_STATUS_DELETED:
                        // very rare situation:
                        this.status = this.i18n('activity-status-deleted');
                        this.statusClass = STATUS_CLASS_NEGATIVE;
                        break;
                    case constants.ACTIVITY_STATUS_SUSPENDED:
                        this.status = this.i18n('activity-status-suspended');
                        this.statusClass = STATUS_CLASS_NEUTRAL;
                        break;
                    case constants.ACTIVITY_STATUS_NOTDONE:
                        this.status = this.i18n('activity-status-notdone');
                        this.statusClass = STATUS_CLASS_NEGATIVE;
                        break;
                }
            }

            this.isApplyButtonDisabled = ko.pureComputed(() => this.enteredMeterReading() == this.meterReading());

            this.isActivityEditable = ko.pureComputed(() =>
                this.activity.isPending() || this.activity.isComplete() && this.activity.isAwaitingSynchronization()
            );

            this.blockExpandedSignalSubscription = this.blockExpandedSignal.add((activity) => {
                if (this.isExpanded() && activity !== this.activity) {
                    this.toggleEditor(true);
                }
            });
        }

        outputProperty(propertyName) {
            let value = this.activity.properties[propertyName];
            let attributeDescription = this.attributeDescription[propertyName];
            if (!attributeDescription) {
                return value;
            }
            if (attributeDescription.type === 'enum' && attributeDescription.enum && attributeDescription.enum[value] && attributeDescription.enum[value].text) {
                value = attributeDescription.enum[value] && attributeDescription.enum[value].text || value;
            }
            return value;
        }

        focusOnInput() {
            let meterReadingInput = this.elementConainer.querySelector('.meter-reading-input');
            if (meterReadingInput) {
                meterReadingInput.focus();
                setTimeout(() => meterReadingInput.select(), 50);
            }
        }

        collapseEditor() {
            if (this.isExpanded()) {
                this.toggleEditor();
            }
        }

        toggleEditor(quietMode) {
            if (!this.isExpanded()) {
                this.enteredMeterReading(this.meterReading());
                this.isExpanded(true);
                this.blockExpandedSignal.dispatch(this.activity);
                this.submitBlockedSignal.dispatch();
                this.focusOnInput();
            } else {
                this.isExpanded(false);
                this.enteredMeterReading(this.meterReading());
                this.meterReadingError(false);
                if (quietMode !== true) {
                    this.submitUnlockedSignal.dispatch();
                }
            }
        }

        applyMeterReading() {
            if (this.isApplyButtonDisabled() || !this.isActivityEditable()) {
                return;
            }

            this.meterReadingError(null);

            let applyResult = this.meterReadingEntered(this.activity, this.enteredMeterReading());

            if (applyResult === true) {
                this.meterReading(this.enteredMeterReading());
                this.isExpanded(false);
            } else if (typeof applyResult === 'string') {
                // text error - show it
                this.meterReadingError(applyResult);
                this.focusOnInput();
            } else {
                // unexpected error
                this.focusOnInput();
            }
        }

        goToDetails() {
            this.activityDetailsRequested(this.activity);
        }

        onInputFocus() {
            this.submitBlockedSignal.dispatch();
        }

        onInputBlur() {
            this.submitUnlockedSignal.dispatch();
        }

        i18n(label) {
            return i18n(label);
        }

        dispose() {
            if (this.isExpanded()) {
                this.submitUnlockedSignal.dispatch();
            }
            this.blockExpandedSignalSubscription && this.blockExpandedSignalSubscription.detach && this.blockExpandedSignalSubscription.detach();
            this.blockExpandedSignalSubscription = null;
        }
    }

    ko.components.register('activity-block', {
        viewModel: {
            createViewModel: (params, componentInfo) => {
                return new ActivityBlockComponent(params, componentInfo);
            }
        },
        template
    });
});