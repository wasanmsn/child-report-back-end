const clientSessions = require('client-sessions');
var express = require("express");
var app = express();
const authData = require("./auth-service.js")
var cors = require('cors')

var HTTP_PORT = process.env.PORT || 8080;
var corsOptions = {
  origin: process.env.FRONT_END_URL,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  credentials: true
}

function onHttpStart() {
  console.log("Express http server listening on: " + HTTP_PORT);
}

app.use(cors(corsOptions))
app.use(express.static('public'));
app.use(clientSessions({
  cookieName: 'session',
  secret: '9731DAAC313BE43A6F44311F47511',
  duration: 30 * 60 * 1000, // 30 minutes
  activeDuration: 5 * 60 * 1000 // 5 minutes
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json())
// POST /register
app.post('/register', async (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  
  // If a picture was provided as a base64 string, convert it to a Buffer
  if (req.body.picture) {
    const base64Data = req.body.picture.split(';base64,')[1];
    const mimeType = req.body.picture.split(';base64,')[0].split(':')[1];

    console.log(mimeType)
    req.body.picture = {
      data: Buffer.from(base64Data, 'base64'),
      contentType: mimeType
    };
  }

  try {
    const data = await authData.registerUser(req.body);
    res.status(201).send({ message: 'User created',email:data.email,childId:data.childId });
  } catch (err) {
    console.log(err)
    res.status(500).send({ errorMessage: err });
  }
});



// POST /login
app.post('/login', (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  authData.checkUser(req.body).then((user) => {
    req.session.user = {
      email: user.email,
      loginHistory: user.loginHistory
    };
    res.status(200).json({message:"Login success",childId:user.childId,email:user.email})
  }).catch((err) => {
    res.status(404).json({message:"Error "+err});
  });
});

// GET /logout
app.get('/logout', (req, res) => {
  req.session.reset();
  res.status(200).send("Logged out.")
});



//check login
app.use(function (req, res, next) {
  res.locals.session = req.session;
  next();
});
function ensureLogin(req, res, next) {

  if (!req.session || !req.session.user) {
    console.log("Unauthorized")
    return res.status(401).send({message:"Unauthorized"});
  }
  next();
}
//end check login
// GET /child/{id}
app.get('/child/:childId', async (req, res) => {
  let childId = req.params.childId;
  console.log(childId)
  try {
    let user = await authData.getUser(childId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
    } else {
      // Convert picture data to a base64 string so it can be sent as JSON
      if (user.picture && user.picture.data) {
        const picture = `data:${user.picture.contentType};base64,${Buffer.from(user.picture.data).toString('base64')}`;
        user.picture = null
        user.picture = picture
        console.log(user.picture)

      }
      
      res.status(200).json(user);
    }
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});
app.put('/update/:childId',ensureLogin, async (req, res) => {
  let childId = req.params.childId;
  let updatedFields = req.body;

  // If a picture was provided as a base64 string, convert it to a Buffer
  if (updatedFields.picture) {
    const base64Data = updatedFields.picture.split(';base64,')[1];
    const mimeType = updatedFields.picture.split(';base64,')[0].split(':')[1];
    
    updatedFields.picture = {
      data: Buffer.from(base64Data, 'base64'),
      contentType: mimeType
    };
  }

  try {
    let updatedUser = await authData.updateUser(childId, updatedFields);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

authData.initialize().then(() => {
  app.listen(HTTP_PORT, onHttpStart());
}).catch(() => {
  console.log("ERROR : From starting the server");
});