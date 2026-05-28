const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const config = require('./config');
const { getDb, closeDb } = require('./db');
const { mountRuntimeRoutes } = require('./routes/runtime');
const { createTranslator, dictionaries } = require('./i18n');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const connectionsRoutes = require('./routes/connections');
const sqlQueriesRoutes = require('./routes/sqlQueries');
const apiGroupsRoutes = require('./routes/apiGroups');
const apisRoutes = require('./routes/apis');
const backupRoutes = require('./routes/backup');
const corsRoutes = require('./routes/cors');

const app = express();

getDb();

app.set('view engine', 'ejs');
app.set('views', config.viewsPath);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(config.publicPath));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, '../node_modules/bootstrap/dist')));
app.use('/vendor/bootstrap-icons', express.static(path.join(__dirname, '../node_modules/bootstrap-icons')));
app.use('/vendor/chart.js', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use((req, res, next) => {
  req.session.lang = req.session.lang || 'th';
  req.t = createTranslator(req.session.lang);
  res.locals.user = req.session?.user || null;
  res.locals.locale = req.session.lang;
  res.locals.t = req.t;
  next();
});

app.get('/locale/:lang', (req, res) => {
  const lang = req.params.lang;
  req.session.lang = dictionaries[lang] ? lang : 'th';
  res.redirect(req.get('referer') || '/dashboard');
});

app.get('/', (req, res) => {
  res.redirect(req.session?.user ? '/dashboard' : '/login');
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(connectionsRoutes);
app.use(sqlQueriesRoutes);
app.use(apiGroupsRoutes);
app.use(apisRoutes);
app.use(backupRoutes);
app.use(corsRoutes);

mountRuntimeRoutes(app);

app.use((req, res) => {
  res.status(404).render('error', { title: req.t('notFound'), message: req.t('notFoundMessage'), user: req.session?.user });
});

const server = app.listen(config.port, () => {
  console.log(`API Generator running at http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other process or set PORT in .env`);
    process.exit(1);
  }
  throw err;
});

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
