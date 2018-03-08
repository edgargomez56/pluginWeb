define([
    'knockout',
    'signals',
    'ofsc-connector',
    './models/activity-model',
    './models/activity-service',
    './models/persistent-storage',
    './constants',
    'text!./app.html',
    './i18n',

    // non-referenced:
    'css!./app',
    './activity-block-component/activity-block-component'
], (ko,
    Signal,
    OfscConnector,
    ActivityModel,
    ActivityService,
    PersistentStorage,
    constants,
    appTemplate,
    i18n) => {

    const STORAGE_PREFIX = 'meter_';
    const STORAGE_KEY_ACTIVITY_CHANGES = STORAGE_PREFIX + 'activityChanges';
    const STORAGE_KEY_ATTRIBUTE_DESCRIPTION = STORAGE_PREFIX + 'attributeDescription';
    const STORAGE_KEY_CHANGES_APPLIED = STORAGE_PREFIX + 'isChangesApplied';
    const STORAGE_KEY_RESOURCE_ID = STORAGE_PREFIX + 'resourceId';

    class PluginApp {
        /**
         * @param {Element} domElement
         */
        constructor(domElement) {
            this.domElement = domElement;
            this.ofscConnector = new OfscConnector();

            this.ofscConnector.debugMessageReceivedSignal.add((data) => {
                console.info('-> ACTIVITY SEARCH PLUGIN: ', data);
            });

            this.ofscConnector.debugMessageSentSignal.add((data) => {
                console.info('<- ACTIVITY SEARCH PLUGIN: ', data);
            });

            this.ofscConnector.debugIncorrectMessageReceivedSignal.add((error, data) => {
                console.error('-> ACTIVITY SEARCH PLUGIN: incorrect message: ', error, data);
            });

            this.activityService = new ActivityService();

            this.attributeDescription = this._loadAttributeDescription();
            this.activityDictionary = {};
            this.activityViewModelList = {list: [], lastCompletedNumber: null};
            this.resourceId = null;

            this.isProcessing = ko.observable(false);
            this.isLoaded = ko.observable(false);

            this.searchQuery = ko.observable('');
            this.searchQueryDebounced = ko.pureComputed(() => {
                return this.searchQuery();
            }).extend({rateLimit: 250});
            this.searchQueryIsEmpty = ko.pureComputed(() => {
                return this.searchQuery().length < constants.MIN_SEARCH_REQUEST_LENGTH;
            });

            this.foundActivities = ko.pureComputed(() => {
                if (this.searchQueryIsEmpty()) {
                    return [];
                }
                return this.searchActivity(this.searchQueryDebounced());
            });

            /**
             * @return {Array}
             * @type {void|*}
             */
            this.searchResults = ko.pureComputed(() => {
                let foundActivities = this.foundActivities();

                let entriesNumber = 0;

                return foundActivities.reduce((accumulator, normalizedActivity) => {
                    ++entriesNumber;
                    if (entriesNumber > constants.MAX_SEARCH_ENTRIES_NUMBER) {
                        return accumulator;
                    }

                    accumulator.push(normalizedActivity.activity);
                    return accumulator;
                }, []);
            });

            this.notShownSearchResultsNumber = ko.pureComputed(() => {
                return Math.max(0, this.foundActivities().length - constants.MAX_SEARCH_ENTRIES_NUMBER);
            });

            this.notShownSearchResults = ko.pureComputed(() => {
                if (!this.notShownSearchResultsNumber()) {
                    return '';
                }
                return this.i18n('search-not-shown-results-text').replace('#NUMBER#', this.notShownSearchResultsNumber());
            });

            this.isScrolled = ko.observable(false);

            let updateScrollPosition = (e) => {
                let scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                this.isScrolled(scrollPosition > 1);
            };

            updateScrollPosition(null);

            window.addEventListener('scroll', updateScrollPosition);
            window.addEventListener('resize', updateScrollPosition);
            window.addEventListener('orientationchange', updateScrollPosition);

            /* Links for debugging*/
            window.app = this;
        }

        terminatePlugin() {
            this.ofscConnector.sendMessage({
                method: 'close',
            }).then((data) => {
                console.log('RESPONSE DATA: ', data);
            }).catch(e => {
                console.error(e);
            });
        }

        start() {
            this.ofscConnector.sendMessage({
                method: 'ready',
                sendInitData: true,
                dataItems: ['resource', 'scheduledActivities', 'nonScheduledActivities']
            }).then((message) => {
                switch (message.method) {
                    case 'init':
                        this._saveAttributeDescription(message.attributeDescription);
                        this.ofscConnector.sendMessage({
                            method: 'initEnd'
                        });
                        break;
                    case 'open':
                        console.log(message);

                        let savedResourceId = this._loadResourceId();
                        let currentResourceId = null;

                        if (message.resource && message.resource[constants.RESOURCE_PROPERTY_ID]) {
                            currentResourceId = message.resource[constants.RESOURCE_PROPERTY_ID];
                        }

                        this._cleanupChanges(savedResourceId, currentResourceId);
                        this.activityService.unserializeChanges(this._loadActivityChanges());

                        this._saveResourceId(currentResourceId);

                        this.open(message.activityList);
                        break;
                }
            }).catch((e) => {
                console.error("Unable to start application: ", e);
            });
        }

        open(activityDictionary) {
            if (!activityDictionary) {
                alert(this.i18n('error-popup-title') + '\n\n' + this.i18n('error-unsupported-screen'));
                this.terminatePlugin();
                return;
            }

            this.activityDictionary = activityDictionary || {};
            this.activityViewModelList = this.createActivityViewModelList(this.activityDictionary);
            this.lastCompletedActivityNumber = ko.observable(this.findLastCompletedActivityNumber(this.activityViewModelList));
            this.lastCompletedActivityViewModel = ko.pureComputed(() => {
                let number = this.lastCompletedActivityNumber();
                if (number === null) {
                    return null;
                }
                return this.activityViewModelList[number] || null;
            });
            this.lastCompletedActivityPosition = ko.pureComputed(() => {
                if (!this.lastCompletedActivityViewModel()) {
                    return null;
                }
                return this.lastCompletedActivityViewModel().activity.completionOrder || 0;
            });

            this.nextActivities = ko.observableArray(this.calculateNextActivities(constants.NEXT_ACTIVITIES_NUMBER, this.lastCompletedActivityNumber()));

            this.domElement.innerHTML = appTemplate;
            this.blockExpandedSignal = new Signal();
            this.submitBlockedSignal = new Signal();
            this.submitUnlockedSignal = new Signal();

            this.isSubmitBlocked = ko.observable(false);

            this.submitBlockedSignal.add(() => {
                this.isSubmitBlocked(true);
            });

            this.submitUnlockedSignal.add(() => {
                this.isSubmitBlocked(false);
            });

            this.isSubmitAvailable = ko.pureComputed(() => {
                return !this.isSubmitBlocked() && this.activityService.changesNumber() > 0;
            });

            this.buttonSubmitText = ko.pureComputed(() => {
                if (!this.isSubmitAvailable()) {
                    return '';
                }
                return i18n('button-submit-title').replace('#NUMBER#', this.activityService.changesNumber());
            });

            ko.applyBindings(this, this.domElement);
            this.isLoaded(true);

            let searchInput = this.domElement.querySelector('#search-query');
            if (searchInput) {
                searchInput.focus && searchInput.focus();
            }
        }

        /**
         * Returns true on successful validation.
         * Returns error description as a string on unsuccessful validation.
         *
         * @param activity
         * @param meterReading
         * @returns {Boolean|String}
         */
        validateMeterReadingForActivity(activity, meterReading) {
            if (meterReading == '') {
                // the empty value is acceptable
                return true;
            }
            if (isNaN(meterReading)) {
                // it's not a number and not an empty value
                return i18n('error-validation-incorrect-value');
            }
            if (meterReading <= 0) {
                // the value must be above 0
                return i18n('error-validation-incorrect-value');
            }
            return true;
        }

        /**
         * @param {ActivityModel} activity
         * @param meterReading
         * @returns {string | boolean}
         */
        meterReadingEntered(activity, meterReading) {
            let validationResult = this.validateMeterReadingForActivity(activity, meterReading);
            if (validationResult !== true) {
                return validationResult;
            }
            // validation is successful - continue:

            if (activity.isPending()) {
                this.activityService.completeActivity(activity, meterReading, (this.lastCompletedActivityPosition() || 0) + 1);

                // find index of this activity:
                let activityIndex = -1;
                for (let i = 0; i < this.activityViewModelList.length; ++i) {
                    if (this.activityViewModelList[i].activity === activity) {
                        activityIndex = i;
                        break;
                    }
                }
                if (activityIndex >= 0) {
                    // and make it last completed:
                    this.lastCompletedActivityNumber(activityIndex);
                }
            } else {
                this.activityService.updateActivity(activity, meterReading);
                if (!meterReading) {
                    // the activity was "un-completed", we need to find last complete activity from the list:
                    this.lastCompletedActivityNumber(this.findLastCompletedActivityNumber(this.activityViewModelList));
                }
            }

            // after getting index of last completed activity - calculate next pending ones:

            this._saveActivityChanges(this.activityService.serializeChanges());

            this.nextActivities(this.calculateNextActivities(constants.NEXT_ACTIVITIES_NUMBER, this.lastCompletedActivityNumber()));

            this.searchQuery('');

            return true;
        }

        activityDetailsRequested(activity) {
            this.isProcessing(true);

            this.ofscConnector.sendMessage({
                method: 'close',
                backScreen: 'activity_by_id',
                backActivityId: activity.id.toString(),
            }).then((data) => {
                this.isProcessing(false);
                console.log('RESPONSE DATA: ', data);
            }).catch(e => {
                console.error(e);
            });
        }

        i18n(label) {
            return i18n(label);
        }

        normalizeQuery(query) {
            return query.toLowerCase().trim();
        }

        searchActivity(query) {
            query = this.normalizeQuery(query);

            if (query === '') {
                return [];
            }

            return this.activityViewModelList
                .filter(item => item.searchString.indexOf(query) >= 0);
        }

        submitChanges() {
            let activityList = this.activityService.getActivityUpdates() || {};

            this._submitChangesToOfsc(activityList);
        }

        _submitChangesToOfsc(activityList) {
            this.isProcessing(true);
            this._saveIsChangesApplied(true);

            this.ofscConnector.sendMessage({
                method: 'close',
                activityList
            }).then((data) => {
                this.isProcessing(false);
                console.log('RESPONSE DATA: ', data);
            }).catch(message => {
                this._saveIsChangesApplied(false);

                if (!message || !message.errors) {
                    alert(this.i18n('error-unexpected'));
                    return;
                }

                let errorRows = [];

                message.errors.forEach((error) => {
                    let failedId = error.entityId;

                    if (failedId) {
                        delete activityList[failedId];
                        let failedActivity = this.activityDictionary[failedId];
                        errorRows.push((failedActivity && failedActivity[constants.ACTIVITY_PROPERTY_SEARCH_BY]) || '#' + failedId);
                    }
                });

                let errorText = this.i18n('error-unable-to-update') + '\n\n' + errorRows.join('\n');

                alert(errorText);

                this._submitChangesToOfsc(activityList);
            });
        }

        _cleanupChanges(savedResourceId, currentResourceId) {
            let isChangesApplied = this._loadIsChangesApplied();

            if (isChangesApplied || savedResourceId !== currentResourceId) {
                this._saveActivityChanges({});
                this._saveIsChangesApplied(false);
            }
        }

        _loadActivityChanges() {
            try {
                return PersistentStorage.loadData(STORAGE_KEY_ACTIVITY_CHANGES) || {};
            } catch (e) {
                return {};
            }
        }

        _loadAttributeDescription() {
            try {
                return PersistentStorage.loadData(STORAGE_KEY_ATTRIBUTE_DESCRIPTION) || {};
            } catch (e) {
                return {};
            }
        }

        _loadIsChangesApplied() {
            try {
                return PersistentStorage.loadData(STORAGE_KEY_CHANGES_APPLIED) || false;
            } catch (e) {
                return false;
            }
        }

        _loadResourceId() {
            try {
                return PersistentStorage.loadData(STORAGE_KEY_RESOURCE_ID) || null;
            } catch (e) {
                return null;
            }
        }

        _saveActivityChanges(changes) {
            PersistentStorage.saveData(STORAGE_KEY_ACTIVITY_CHANGES, changes || {});
        }

        _saveAttributeDescription(description) {
            PersistentStorage.saveData(STORAGE_KEY_ATTRIBUTE_DESCRIPTION, description || {});
        }

        _saveIsChangesApplied(isApplied) {
            PersistentStorage.saveData(STORAGE_KEY_CHANGES_APPLIED, !!isApplied);
        }

        _saveResourceId(id) {
            PersistentStorage.saveData(STORAGE_KEY_RESOURCE_ID, id);
        }

        /**
         * Extracts all searchable text data form inventory properties.
         * Represents all text values of inventory as a 1 string at lower case where values are divided by "~" symbol.
         * Example "val1~val2~val3"
         *
         * @param activityDictionary
         * @returns {Array}
         */
        createActivityViewModelList(activityDictionary) {
            let lastCompletedActivity = null;
            let list = [];
            Object.entries(activityDictionary).forEach(([aid, activityProperties]) => {
                let activity = this.activityService.getModelInstance(activityProperties);

                if (!activity.searchKey) {
                    return;
                }

                let activitySearchStringValue = activity.searchKey;

                if (activitySearchStringValue === null || activitySearchStringValue === undefined) {
                    return;
                }

                let searchString = activitySearchStringValue.toString().trim().toLowerCase();
                if (searchString.length <= 0) {
                    return;
                }

                let order = activity.sortKey;

                let activityViewModel = {
                    activity,
                    searchString,
                    order
                };

                list.push(activityViewModel);
            });

            // return sorted list:

            return list.sort((first, second) => first.order - second.order);
        }

        findLastCompletedActivityNumber(activityViewModelList) {
            let lastCompletedActivityNumber = null;
            let lastCompletionOrder = null;
            activityViewModelList.forEach((activityViewModel, index) => {
                if (activityViewModel.activity.isComplete()) {
                    if (lastCompletedActivityNumber === null || lastCompletionOrder < activityViewModel.activity.completionOrder) {
                        lastCompletionOrder = activityViewModel.activity.completionOrder;
                        lastCompletedActivityNumber = index;
                    }
                }
            });
            return lastCompletedActivityNumber;
        }

        /**
         * @param activitiesNumber
         * @param lastCompletedActivityNumber
         * @returns {Array}
         */
        calculateNextActivities(activitiesNumber, lastCompletedActivityNumber) {
            let result = [];

            // the list is already sorted - just get appropriate next ones after the last completed:
            let startPosition = lastCompletedActivityNumber === null ? 0 : lastCompletedActivityNumber + 1;

            let foundNumber = 0;

            for (let i = startPosition, l = this.activityViewModelList.length; i < l && foundNumber < activitiesNumber; ++i) {
                let normalizedActivity = this.activityViewModelList[i];
                if (normalizedActivity.activity.isPending()) {
                    result.push(normalizedActivity.activity);
                    ++foundNumber;
                }
            }

            return result;
        }
    }

    return PluginApp;
});
