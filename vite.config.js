import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to load GLSL shaders as raw strings
const rawGlslPlugin = {
  name: 'raw-glsl-plugin',
  transform(code, id) {
    if (id.endsWith('.glsl')) {
      return {
        code: `export default ${JSON.stringify(code)};`,
        map: null
      };
    }
  }
};

// Plugin to handle dynamic index.html loading and copying of tools assets
function htmlTemplatePlugin() {
  let activeMode = 'development';
  return {
    name: 'html-template-plugin',
    configResolved(config) {
      activeMode = config.mode;
    },
    transformIndexHtml(html, ctx) {
      // Select template based on Vite build mode
      let templatePath = 'tools/index.dev.html';
      if (activeMode === 'release') {
        templatePath = 'tools/index.release.html';
      } else if (activeMode === 'website') {
        templatePath = 'tools/index.website.html';
      } else if (activeMode === 'webad') {
        templatePath = fs.existsSync('tools/index.webad.html') ? 'tools/index.webad.html' : 'tools/index.release.html';
      }
      
      if (!fs.existsSync(templatePath)) {
        console.warn(`Template path not found: ${templatePath}. Falling back to tools/index.dev.html`);
        templatePath = 'tools/index.dev.html';
      }
      
      let content = fs.readFileSync(path.resolve(templatePath), 'utf-8');
      
      // Rewrite output bundled script import
      if (ctx.server) {
        content = content.replace("<script src='sculptsp.js'></script>", '<script type="module" src="/main.js"></script>');
        content = content.replace('<script src="sculptsp.js"></script>', '<script type="module" src="/main.js"></script>');
        content = content.replace("<script src='app/sculptsp.js'></script>", '<script type="module" src="/main.js"></script>');
      } else {
        content = content.replace("<script src='sculptsp.js'></script>", '<script type="module" src="./sculptsp.js"></script>');
        content = content.replace('<script src="sculptsp.js"></script>', '<script type="module" src="./sculptsp.js"></script>');
        content = content.replace("<script src='app/sculptsp.js'></script>", '<script type="module" src="./sculptsp.js"></script>');
      }
      
      // For dev server, map static assets residing in /app to the root request paths
      if (ctx.server) {
        content = content.replace(/href=['"]css\//g, "href='/app/css/");
        content = content.replace(/href=['"]resources\//g, "href='/app/resources/");
        content = content.replace(/src=['"]worker\//g, "src='/app/worker/");
      }
      
      return content;
    },
    closeBundle() {
      // Copy authSuccess.html
      const dest = path.resolve(__dirname, 'app/authSuccess.html');
      const src = path.resolve(__dirname, 'tools/authSuccess.html');
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('Copied authSuccess.html to app/');
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  return {
    root: __dirname,
    base: './',
    resolve: {
      alias: {
        'zip': path.resolve(__dirname, 'lib/zip-wrapper.js'),
        'sketchfab-oauth2-1.2.0': path.resolve(__dirname, 'lib/sketchfab-wrapper.js')
      }
    },
    plugins: [
      rawGlslPlugin,
      htmlTemplatePlugin(),
      {
        name: 'serve-app-assets',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url.startsWith('/resources/') || req.url.startsWith('/worker/') || req.url.startsWith('/css/')) {
              req.url = '/app' + req.url;
            }
            next();
          });
        }
      }
    ],
    server: {
      port: 8080,
      host: true,
      https: false
    },
    build: {
      outDir: 'app',
      emptyOutDir: false,
      minify: mode !== 'development',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html')
        },
        output: {
          entryFileNames: 'sculptsp.js',
          assetFileNames: '[name].[ext]',
          chunkFileNames: '[name].js',
          format: 'es'
        }
      }
    }
  };
});
