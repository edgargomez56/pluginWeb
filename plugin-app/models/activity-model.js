"use strict";
define([
    '../constants'
], (constants) => {

    class ActivityModel {

        constructor(properties) {
            this.properties = properties;

            this._syncAwaiting = false;
        }

        get id() {
            return this.properties[constants.ACTIVITY_PROPERTY_ID] || '';
        }

        get searchKey() {
            return this.properties[constants.ACTIVITY_PROPERTY_SEARCH_BY] || '';
        }

        get sortKey() {
            return this.properties[constants.ACTIVITY_PROPERTY_SORT] && parseInt(this.properties[constants.ACTIVITY_PROPERTY_SORT], 10) || 0;
        }

        get meterReading() {
            return this.properties[constants.ACTIVITY_PROPERTY_METER_READING] || '';
        }

        set meterReading(value) {
            this.properties[constants.ACTIVITY_PROPERTY_METER_READING] = value;
        }

        get completionOrder() {
            return this.properties[constants.ACTIVITY_PROPERTY_COMPLETION_ORDER] && parseInt(this.properties[constants.ACTIVITY_PROPERTY_COMPLETION_ORDER], 10) || 0;
        }

        set completionOrder(value) {
            this.properties[constants.ACTIVITY_PROPERTY_COMPLETION_ORDER] = value;
        }

        get status() {
            return this.properties[constants.ACTIVITY_PROPERTY_STATUS] || '';
        }

        get address() {
            return this.properties[constants.ACTIVITY_PROPERTY_ADDRESS] || '';
        }

        cancel() {
            this.properties[constants.ACTIVITY_PROPERTY_STATUS] = constants.ACTIVITY_STATUS_CANCELLED;
            this._syncAwaiting = true;
        }

        undoCancel() {
            this.properties[constants.ACTIVITY_PROPERTY_STATUS] = constants.ACTIVITY_STATUS_PENDING;
            this._syncAwaiting = false;
        }

        isPending() {
            return constants.ACTIVITY_STATUS_PENDING === this.status;
        }

        isStarted() {
            return constants.ACTIVITY_STATUS_STARTED === this.status;
        }

        isComplete() {
            return constants.ACTIVITY_STATUS_CANCELLED === this.status;
        }

        isAwaitingSynchronization() {
            return this.isComplete() && this._syncAwaiting;
        }
    }

    return ActivityModel;
});
