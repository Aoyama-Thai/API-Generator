const DB_TYPES = ['mssql', 'postgres', 'mysql', 'mariadb', 'sqlite', 'mongodb', 'db2'];

const DEFAULT_PORTS = {
  mssql: 1433,
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  sqlite: 0,
  mongodb: 27017,
  db2: 50000,
};

const SQL_DRIVERS = new Set(['mssql', 'postgres', 'mysql', 'mariadb', 'sqlite', 'db2']);

function isSqlDriver(dbType) {
  return SQL_DRIVERS.has(dbType);
}

function isValidDbType(dbType) {
  return DB_TYPES.includes(dbType);
}

function defaultPort(dbType) {
  return DEFAULT_PORTS[dbType] ?? 0;
}

function displayLabel(dbType) {
  const labels = {
    mssql: 'MS SQL Server',
    postgres: 'PostgreSQL',
    mysql: 'MySQL',
    mariadb: 'MariaDB',
    sqlite: 'SQLite',
    mongodb: 'MongoDB',
    db2: 'IBM DB2',
  };
  return labels[dbType] || dbType;
}

module.exports = { DB_TYPES, DEFAULT_PORTS, SQL_DRIVERS, isSqlDriver, isValidDbType, defaultPort, displayLabel };
