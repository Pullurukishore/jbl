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
const { create } = require('xmlbuilder2');

//Request logger
const morgan = require('morgan');

const app = express();
app.use(zip());
app.use(cors({ origin: 'http://localhost:4200', exposedHeaders: ['File-Name'], }));
//Body parser
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));

app.use(express.static('public'));
app.use(express.static('./uploads'));

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
  // res.header("Access-Control-Allow-Origin", "http://10.10.118.118");
  res.header("Access-Control-Allow-Methods", "POST,GET");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-with, Content-Type, Accept,");
  res.header("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");


  if (req.method != 'POST' && req.method != 'GET') {
    res.send(405, `${req.method} Method Not Allowed`)
    res.end()
  } else {
    next();
  }

});





//Cookie parser
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(authMiddleware);
app.use('/api/put', putRoutes);
app.use('/api/pick', pickRoutes);
app.use('/api/log', logRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/file', fileRoutes);
app.use('/api/auth', authRoutes);



//Error Handler
app.use(errorHandler);


const db = require('./models');

db.sequelize.sync()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
    });
  })
  .catch(err => console.log(err));