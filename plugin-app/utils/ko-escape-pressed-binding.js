"use strict";
define(['knockout'], (ko) => {
    ko.bindingHandlers.escapePressed = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            let handler = valueAccessor();
            element.addEventListener('keyup', (e) => {
                if (e.keyCode === 27) {
                    e.preventDefault();
                    e.stopPropagation();
                    handler.call(viewModel);
                    return false;
                }
            });
        }
    };
});