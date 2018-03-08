"use strict";
define(['knockout'], (ko) => {
    ko.bindingHandlers.enterPressed = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            let handler = valueAccessor();
            element.addEventListener('keypress', (e) => {
                if (e.keyCode === 13) {
                    e.preventDefault();
                    e.stopPropagation();
                    handler.call(viewModel);
                    return false;
                }
            });
        }
    };
});