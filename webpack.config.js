const webpack = require('webpack');
const path = require('path');
var package = require('./package.json');
const three_version = package.dependencies.three.replace('^','');

function getConfig() {
    return config = {
        entry: './src/index.ts',
        externalsType: 'script',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'webgui.js',
            library: package.name,
            libraryTarget: 'umd',
            globalObject: 'this',
        },
        module: {
            rules: [
                {
                    test: /\.ts(x)?$/,
                    loader: 'ts-loader',
                },
                {
                    test: /\.css$/,
                    use: [
                        'style-loader',
                        'css-loader'
                    ]
                }
            ]
        },
        resolve: {
            extensions: [
                '.tsx',
                '.ts',
                '.js'
            ]
        },
    };
}

var html_config = getConfig();
html_config.output.filename = "webgui_external_three.js";
html_config.externals = {
'@jupyter-widgets/base': '@jupyter-widgets/base',
    three: [`https://unpkg.com/three@${three_version}/build/three.min.js`, "THREE"],
};

module.exports = [
    getConfig(), html_config
];
