const path = require('path');
const project = require('../aurelia_project/aurelia.json');
const { AureliaPlugin, ModuleDependenciesPlugin } = require('aurelia-webpack-plugin');
const { ProvidePlugin } = require('webpack');

// config helpers:
const ensureArray = (config) => config && (Array.isArray(config) ? config : [config]) || [];
const when = (condition, config, negativeConfig) =>
  condition ? ensureArray(config) : ensureArray(negativeConfig);

// primary config:
const rootDir = path.dirname(__dirname);
const outDir = path.resolve(rootDir, project.paths.output);
const srcDir = path.resolve(rootDir, project.paths.root);
const nodeModulesDir = path.resolve(rootDir, 'node_modules');
const baseUrl = '/';

const cssRules = [
  { loader: 'css-loader' },
];

module.exports = ({coverage} = {}) => ({
  resolve: {
    extensions: ['.js'],
    modules: [srcDir, 'node_modules'],
  },
  entry: {
    app: ['aurelia-bootstrapper'],
    vendor: ['bluebird'],
  },
  devServer: {
    contentBase: outDir,
    // serve index.html for all 404 (required for push-state)
    historyApiFallback: true
  },
  devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [
      // CSS required in JS/TS files should use the style-loader that auto-injects it into the website
      // only when the issuer is a .js/.ts file, so the loaders are not applied inside html templates
      {
        test: /\.css$/i,
        issuer: [{ not: [{ test: /\.html$/i }] }],
        use: ['style-loader', ...cssRules],
      },
      {
        test: /\.css$/i,
        issuer: [{ test: /\.html$/i }],
        // CSS required in templates cannot be extracted safely
        // because Aurelia would try to require it again in runtime
        use: cssRules
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
        issuer: /\.[tj]s$/i
      },
      {
        test: /\.scss$/,
        use: ['css-loader', 'sass-loader'],
        issuer: /\.html?$/i
      },
      { test: /\.html$/i, loader: 'html-loader' },
      { test: /\.js$/i, loader: 'babel-loader', exclude: nodeModulesDir,
        options: coverage ? { sourceMap: 'inline', plugins: [ 'istanbul' ] } : {},
      },
      { test: /\.json$/i, loader: 'json-loader' },
      // use Bluebird as the global Promise implementation:
      { test: /[\/\\]node_modules[\/\\]bluebird[\/\\].+\.js$/, loader: 'expose-loader?Promise' },
      // embed small images and fonts as Data Urls and larger ones as files:
      { test: /\.(png|gif|jpg|cur)$/i, loader: 'url-loader', options: { limit: 8192 } },
      { test: /\.woff2(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader', options: { limit: 10000, mimetype: 'application/font-woff2' } },
      { test: /\.woff(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader', options: { limit: 10000, mimetype: 'application/font-woff' } },
      // load these fonts normally, as files:
      { test: /\.(ttf|eot|svg|otf)(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'file-loader' },
    ]
  },
  plugins: [
    new AureliaPlugin({ aureliaApp: null }),
    new ProvidePlugin({
      'Promise': 'bluebird'
    }),
    new ModuleDependenciesPlugin({
      'aurelia-testing': [ './compile-spy', './view-spy' ]
    }),
    new ModuleExtensionFallbackPlugin('.css', '.scss'),
  ]
});
class ModuleExtensionFallbackPlugin {
  
  constructor(extension, fallbackExtension) {
    this.extension = extension;
    this.fallbackExtension = fallbackExtension;
  }

  apply(compiler) {
    compiler.moduleExtensionFallbackMap = compiler.moduleExtensionFallbackMap || new Map();
    compiler.plugin('normal-module-factory', (factory) => {
      factory.plugin('before-resolve', (result, callback) => {
        if (!result) {
          return callback();
        }
        if (result.context && result.context.startsWith(srcDir)
            && result.request && !path.isAbsolute(result.request) && result.request.endsWith(this.extension)) {
          const requestPath = path.resolve(result.context, result.request);
          const fallbackRequest = withExt(result.request, this.fallbackExtension);
          const fallbackPath = path.resolve(result.context, fallbackRequest);
          if (!exists(compiler.inputFileSystem, requestPath) && exists(compiler.inputFileSystem, fallbackPath)) {
            const oldExt = path.parse(result.request).ext;
            compiler.moduleExtensionFallbackMap.set(fallbackPath, oldExt);
            result.request = fallbackRequest;
          }
        }
        return callback(null, result);
      });
    });
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('before-module-ids', (modules) => {
        modules.forEach((module) => {
          const oldExt = module.request && compiler.moduleExtensionFallbackMap.get(module.resource);
          if (oldExt && typeof module.id === 'string') {
            module.id = withExt(module.id, oldExt);
          }
        });
      });
    });
    compiler.plugin('done', () => {
      compiler.moduleExtensionFallbackMap.clear();
    });

    function withExt(filename, newExt) {
      const oldExt = path.parse(filename).ext;
      return filename.substring(0, filename.length - oldExt.length) + newExt;
    }

    function exists(fs, filename) {
      try {
        fs.statSync(filename);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
}
