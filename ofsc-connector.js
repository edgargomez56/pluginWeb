"use strict";
define(['signals'], (Signal) => {
    const OFSC_API_VERSION = 1;

    class OfscConnector {
        constructor() {
            window.addEventListener("message", this.onPostMessage.bind(this), false);

            this.debugMessageSentSignal = new Signal();
            this.debugMessageReceivedSignal = new Signal();
            this.debugIncorrectMessageReceivedSignal = new Signal();

            this.messageFromOfscSignal = new Signal();

            this._currentCommunicationCallback = null;
            this._currentCommunicationPromise = null;
        }

        /**
         * @param {Object} data
         * @returns {Promise.<*>}
         */
        sendMessage(data) {
            if (this._currentCommunicationPromise) {
                return Promise.reject(new Error('Communication chanel is busy'));
            }

            return this._currentCommunicationPromise = new Promise((resolve, reject) => {

                let originUrl = document.referrer || (document.location.ancestorOrigins && document.location.ancestorOrigins[0]) || '';

                if (originUrl) {
                    this._currentCommunicationCallback = (data) => {
                        this._currentCommunicationCallback = null;
                        this._currentCommunicationPromise = null;

                        if (data instanceof Error) {
                            return reject(data);
                        }

                        if (data.method && data.method === 'error') {
                            return reject(data);
                        }

                        return resolve(data);
                    };

                    data.apiVersion = OFSC_API_VERSION;

                    parent.postMessage(data, this.constructor._getOrigin(originUrl));
                    this.debugMessageSentSignal.dispatch(data);
                } else {
                    return reject("Unable to get referrer");
                }
            });
        }


        onPostMessage(event) {
            if (typeof event.data === 'undefined') {
                this.debugIncorrectMessageReceivedSignal.dispatch("No data");
                if (this._currentCommunicationCallback) {
                    this._currentCommunicationCallback(new Error('No data'));
                    return;
                }

                return false;
            }

            let data;

            try {
                data = JSON.parse(event.data);
            } catch(e) {
                if (this._currentCommunicationCallback) {
                    this._currentCommunicationCallback(new Error('Incorrect JSON'));
                    return;
                }
                this.debugIncorrectMessageReceivedSignal.dispatch("Incorrect JSON", event.data);

                return false;
            }

            this.debugMessageReceivedSignal.dispatch(data);

            if (this._currentCommunicationCallback) {
                this._currentCommunicationCallback(data);
            } else {
                this.messageFromOfscSignal.dispatch(data);
            }
        }

        static _getOrigin(url) {
            if (typeof url === 'string' && url !== '') {
                if (url.indexOf("://") > -1) {
                    return 'https://' + url.split('/')[2];
                } else {
                    return 'https://' + url.split('/')[0];
                }
            }

            return '';
        }
    }

    return OfscConnector;
});