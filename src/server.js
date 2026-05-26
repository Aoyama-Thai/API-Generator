const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const config = require('./config');
const { getDb, closeDb } = require('./db');
const { mountRuntimeRoutes } = require('./routes/runtime');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const connectionsRoutes = require('./routes/connections');
const sqlQueriesRoutes = require('./routes/sqlQueries');
const apiGroupsRoutes = require('./routes/apiGroups');
const apisRoutes = require('./routes/apis');

const app = express();

getDb();

app.set('view engine', 'ejs');
app.set('views', config.viewsPath);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(config.publicPath));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  next();
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

mountRuntimeRoutes(app);

app.use((req, res) => {
  res.status(404).render('error', { title: 'ไม่พบหน้า', message: 'ไม่พบหน้าที่ต้องการ', user: req.session?.user });
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
