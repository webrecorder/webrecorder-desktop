/**
 * Webpack config for production electron main process
 */

const webpack = require('webpack');
const path = require('path');
const projectDir = path.resolve(__dirname, '..');

module.exports = {
  target: 'electron-main',
  mode: 'production',
  entry: path.join(projectDir, 'app', 'main.js'),

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true
          }
        }
      }
    ]
  },

  output: {
    path: path.join(projectDir, 'app'),
    filename: 'main.prod.js'
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },

  plugins: [
    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production'
      ),
      'process.env.DEBUG_PROD': JSON.stringify(
        process.env.DEBUG_PROD || 'false'
      )
    })
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false
  }
};
