// Polyfill for Node 24+ where SlowBuffer was removed (required for buffer-equal-constant-time / jsonwebtoken)
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = function () {};
  buffer.SlowBuffer.prototype = {};
}

// Global crash protection against unhandled database/network promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Database/Async Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err?.message || err);
});

const express = require('express');
const zip = require('express-easy-zip');
const dotenv = require('dotenv');
const colors = require('colors');
const compression = require('compression');
// const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
//Load env variables from our custom path
dotenv.config({ path: './config/config.env' });

const helmet = require('helmet');
//Middlewares
const errorHandler = require('./middleware/error');
const { authMiddleware } = require('./middleware/auth');

//Routes files


const putRoutes = require('./routes/put');
const pickRoutes = require('./routes/pick');
const logRoutes = require('./routes/log');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/user');
const fileRoutes = require('./routes/file');
const authRoutes = require('./routes/auth');
const huRoutes = require('./routes/hu');
const materialRoutes = require('./routes/material');
const reportRoutes = require('./routes/report');
const { create } = require('xmlbuilder2');

// Automated Daily Database Backup Scheduler (20-day retention)
require('./scheduler/db_backup');

//Request logger
const morgan = require('morgan');

const app = express();
app.use(zip());
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:4200', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. mobile apps, internal tools, curl)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    exposedHeaders: ['File-Name'],
    credentials: true,
  })
);
//Body parser - 25mb safe limit to protect against memory exhaustion DoS
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

app.use(express.static('public'));

app.use(compression()); //Compress all routes
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],

    },
  })
)
app.use(
  helmet({
    referrerPolicy: { policy: "no-referrer" },
  })
);
app.use(helmet())
app.use(helmet.hidePoweredBy({ setTo: '""' }));
app.use(helmet.frameguard());
app.use(helmet.hsts());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter());


app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Methods", "POST,GET,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  if (['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)) {
    next();
  } else {
    res.status(405).send(`${req.method} Method Not Allowed`);
  }
});




//Cookie parser
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(authMiddleware);
app.use('/uploads', express.static('./uploads'));
app.use('/api/put', putRoutes);
app.use('/api/pick', pickRoutes);
app.use('/api/log', logRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/file', fileRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/hu', huRoutes);
app.use('/api/material', materialRoutes);
app.use('/api/report', reportRoutes);



//Error Handler
app.use(errorHandler);


const db = require('./models');

db.sequelize.sync()
  .then(async () => {
    try {
      const qi = db.sequelize.getQueryInterface();
      const putCols = await qi.describeTable('put').catch(() => null);
      const userCols = await qi.describeTable('user').catch(() => null);
      if (userCols && !userCols.token_version) {
        if (db.sequelize.getDialect() === 'postgres') {
          await db.sequelize.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "token_version" INTEGER DEFAULT 1;').catch(() => {});
        } else {
          await qi.addColumn('user', 'token_version', { type: db.Sequelize.INTEGER, defaultValue: 1, allowNull: false }).catch(() => {});
        }
      }
      if (putCols) {
        if (!putCols.compartment_id) {
          if (db.sequelize.getDialect() === 'postgres') {
            await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "compartment_id" INTEGER;').catch(() => {});
          } else {
            await qi.addColumn('put', 'compartment_id', { type: db.Sequelize.INTEGER, allowNull: true }).catch(() => {});
          }
        }
        if (!putCols.handling_unit_id) {
          if (db.sequelize.getDialect() === 'postgres') {
            await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "handling_unit_id" INTEGER;').catch(() => {});
          } else {
            await qi.addColumn('put', 'handling_unit_id', { type: db.Sequelize.INTEGER, allowNull: true }).catch(() => {});
          }
        }
      }

      // Safe non-blocking index creation to prevent CPU spikes & full-table scan crashes
      if (db.sequelize.getDialect() === 'postgres') {
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_serial ON "put" (serial_number);').catch(() => {});
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_model ON "put" (model_number);').catch(() => {});
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_pick_status ON "put" (pick_status);').catch(() => {});
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_comp_hu_id ON "compartment" (handling_unit_id);').catch(() => {});
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_comp_serial ON "compartment" (serial_number);').catch(() => {});
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_hu_huid ON "handling_unit" (hu_id);').catch(() => {});
      }
    } catch (e) {
      console.warn('Auto column sync warning:', e.message);
    }
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use by another process. Please stop the existing instance or update PORT in config.env.`.red.bold);
        process.exit(1);
      } else {
        console.error('Server listen error:', err);
      }
    });
  })
  .catch(err => console.log(err));
