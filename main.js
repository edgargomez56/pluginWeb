"use strict";

requirejs.config({
    waitSeconds: 30,
    paths: {
        'knockout': 'vendor/knockout/dist/knockout',
        'signals': 'vendor/signals/dist/signals.min',

        'domReady': 'vendor/requirejs-domready/domReady',

        'ofsc-connector': 'ofsc-connector',
        'plugin-app': 'plugin-app'
    },
    map: {
        '*': {
            'css': 'vendor/require-css/css.min',
            'text': 'vendor/requirejs-text/text'
        }
    }
});

require(['plugin-app/app', 'domReady!'], (PluginApp) => {
    let app = new PluginApp(document.querySelector('body'));
    app.start();

    // for debug:
    window.app = app;
});