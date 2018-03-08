"use strict";
define([
    'knockout',
], (
    ko
) => {
    const storage = window.localStorage;

    class PersistentStorage {

        static saveData(key, value) {
            storage.setItem(key, JSON.stringify(value));
        }

        static loadData(key) {
            return JSON.parse(storage.getItem(key));
        }
    }

    return PersistentStorage;
});
