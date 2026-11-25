// Robust Polyfill for Node 22/24+ where SlowBuffer was removed (required for buffer-equal-constant-time / jsonwebtoken)
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
  function SlowBuffer(size) {
    return Buffer.allocUnsafeSlow ? Buffer.allocUnsafeSlow(size) : Buffer.allocUnsafe(size);
  }
  SlowBuffer.prototype = Object.create(Buffer.prototype);
  buffer.SlowBuffer = SlowBuffer;
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

async function startServerWithDbRetry() {
  const maxRetries = 10;
  let attempt = 0;
  let connected = false;

  while (attempt < maxRetries && !connected) {
    try {
      attempt++;
      await db.sequelize.authenticate();
      await db.sequelize.sync();
      connected = true;
      console.log('Database connection and table schema synchronization successful.'.green);
    } catch (dbErr) {
      console.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed: ${dbErr.message}`.yellow);
      if (attempt < maxRetries) {
        console.log('[DB] Retrying connection in 3 seconds...'.gray);
        await new Promise((res) => setTimeout(res, 3000));
      } else {
        console.error('[DB FATAL] Could not connect to PostgreSQL after multiple attempts. Exiting to trigger auto-recovery.'.red.bold);
        process.exit(1);
      }
    }
  }

  try {
    const isPostgres = db.sequelize.getDialect() === 'postgres';

    if (isPostgres) {
      // 1. Safe non-destructive column sync for all tables (PostgreSQL IF NOT EXISTS)
      await db.sequelize.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "token_version" INTEGER DEFAULT 1;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT TRUE;').catch(() => {});

      await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "compartment_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "handling_unit_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "pick_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "text_file_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "po_file_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP WITH TIME ZONE;').catch(() => {});

      await db.sequelize.query('ALTER TABLE "pick" ADD COLUMN IF NOT EXISTS "text_file_id" INTEGER;').catch(() => {});

      await db.sequelize.query('ALTER TABLE "compartment" ADD COLUMN IF NOT EXISTS "handling_unit_id" INTEGER;').catch(() => {});

      await db.sequelize.query('ALTER TABLE "handling_unit" ADD COLUMN IF NOT EXISTS "bin_type_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "handling_unit" ADD COLUMN IF NOT EXISTS "put_order_seq" INTEGER DEFAULT 0;').catch(() => {});

      await db.sequelize.query('ALTER TABLE "log" ADD COLUMN IF NOT EXISTS "put_id" INTEGER;').catch(() => {});
      await db.sequelize.query('ALTER TABLE "log" ADD COLUMN IF NOT EXISTS "pick_id" INTEGER;').catch(() => {});

      // 2. Safe non-blocking index creation to prevent CPU spikes & full-table scans
      // Drop legacy shortened duplicates if they exist
      await db.sequelize.query('DROP INDEX IF EXISTS idx_put_serial;').catch(() => {});
      await db.sequelize.query('DROP INDEX IF EXISTS idx_put_model;').catch(() => {});
      await db.sequelize.query('DROP INDEX IF EXISTS idx_put_status_scanned;').catch(() => {});
      await db.sequelize.query('DROP INDEX IF EXISTS idx_put_hu_id;').catch(() => {});
      await db.sequelize.query('DROP INDEX IF EXISTS idx_put_comp_id;').catch(() => {});

      // Put table indexes matching models/put.js
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_serial_number ON "put" (serial_number);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_model_number ON "put" (model_number);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_pick_status ON "put" (pick_status);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_scanned_at ON "put" (scanned_at);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_birth_date ON "put" (birth_date);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_pick_status_scanned_at ON "put" (pick_status, scanned_at);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_model_status ON "put" (model_number, pick_status);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_handling_unit_id ON "put" (handling_unit_id);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_compartment_id ON "put" (compartment_id);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_put_pick_id ON "put" (pick_id);').catch(() => {});

      // Compartment & Handling Unit indexes
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_comp_hu_id ON "compartment" (handling_unit_id);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_comp_serial ON "compartment" (serial_number);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_hu_huid ON "handling_unit" (hu_id);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_hu_storage_status ON "handling_unit" (storage_status, hu_status);').catch(() => {});

      // Log table indexes matching models/log.js
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_log_entity_number ON "log" (entity_number);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_log_date_time ON "log" (log_date_time);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_log_type_status_time ON "log" (log_type, status, log_date_time);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_log_process_id ON "log" (process_id);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_log_put_id ON "log" (put_id);').catch(() => {});
      await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_log_pick_id ON "log" (pick_id);').catch(() => {});
    }
  } catch (e) {
    console.warn('Auto column/index sync warning:', e.message);
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
}

startServerWithDbRetry();
