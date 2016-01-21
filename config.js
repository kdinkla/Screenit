requirejs.config({
    paths: {
        bacon: 'bower_components/bacon/dist/Bacon',
        jquery: 'bower_components/jquery/dist/jquery',
        lodash: 'bower_components/lodash/lodash',
        openlayers: 'bower_components/openlayers/lib/OpenLayers',
        jsts: 'bower_components/jsts/lib/jsts'
    },
    shim: {
        jsts: {
            deps: ['bower_components/jsts/lib/javascript.util.min'],
            exports: 'jsts'
        }
    }
});

require(['src/app']);