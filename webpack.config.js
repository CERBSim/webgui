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
            libraryTarget: 'amd',
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
        optimization: {
            minimize: true,
        }
    };
}

module.exports = [
    getConfig()
];
