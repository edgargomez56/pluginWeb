"use strict";
define(['text!./translations_en.json'], (translationsJSON) => {
    const TRANSLATIONS = JSON.parse(translationsJSON);

    /**
     * @param {String} label
     * @returns {String}
     */
    function i18n(label) {
        return TRANSLATIONS[label] || ((console.error("No translation for '" + label + "'")), label);
    }

    return i18n;
});