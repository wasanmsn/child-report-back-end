const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();
// Replace the connection string with your MongoDB Atlas or local MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Error connecting to MongoDB', err);
});
const loginHistorySchema = new mongoose.Schema({
    dateTime: { type: Date, required: true },
    userAgent: { type: String, required: true }
});
const userSchema = new mongoose.Schema({
    childId: {
        type: String,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        unique: true
    },
    father: {
        type: String,
        required: true,
    },
    mother: {
        type: String,
        required: true
    },
    motherPhone: {
        type: String,
        required: true
    },
    fatherPhone: {
        type: String,
        required: true
    },
    picture: {
        data: { type: Buffer, required: true },
        contentType: { type: String, required: true },
    },
    nickName: {
        type: String,
        required: true
    },
    age: {
        type: Number,
        required: true
    },
    loginHistory: [loginHistorySchema]
})
let User; // to be defined on new connection 

function initialize() {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(MONGODB_URI);
        db.on('error', (err) => {
            reject(err); // reject the promise with the provided error
        });
        db.once('open', () => {
            User = db.model("users", userSchema);
            resolve();
        });
    });
};

function registerUser(userData) {
    return new Promise((resolve, reject) => {
        console.log(userData.password)
        // check if passwords match
        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
            return;
        }

        // hash password
        bcrypt.hash(userData.password, 10)
            .then(async (hash) => {
                // replace plain password with hashed password
                userData.password = hash;
                userData.password2 = hash;
                let childId = await generateNextID();

                // create new user
                const newUser = new User({
                    childId: childId,
                    name: userData.name,
                    password: userData.password,
                    email: userData.email,
                    father: userData.father,
                    mother: userData.mother,
                    motherPhone: userData.motherPhone,
                    fatherPhone: userData.fatherPhone,
                    picture: userData.picture,
                    age:userData.age,
                    nickName:userData.nickName,
                    loginHistory: [{ dateTime: new Date(), userAgent: userData.userAgent }]
                });
                // save new user to database

                try {
                    await newUser.save();
                    resolve({ email: userData.email, childId: childId })
                } catch (err) {
                    if (err.code === 11000) {
                        reject("User Name already taken");
                    } else {
                        reject(`There was an error creating the user: ${err}`);
                    }
                }

            })
            .catch((err) => {
                console.log(err);
                reject("There was an error encrypting the password");
            });
    });
}

function checkUser(userData) {
    return new Promise((resolve, reject) => {
        User.find({ email: userData.email })
            .then((users) => {
                if (users.length === 0) {
                    reject(`Unable to find user: ${userData.email}`);
                } else {
                    bcrypt.compare(userData.password, users[0].password)
                        .then((result) => {
                            if (result) {
                                const user = users[0];
                                const loginHistory = user.loginHistory || [];
                                loginHistory.push({ dateTime: new Date().toString(), userAgent: userData.userAgent });
                                user.loginHistory = loginHistory;
                                User.updateOne({ email: user.email }, { $set: { loginHistory: loginHistory } })
                                    .then(() => {
                                        resolve(user);
                                    })
                                    .catch((err) => {
                                        reject(`There was an error verifying the user: ${err}`);
                                    });
                            } else {
                                reject(`Incorrect Password for user: ${userData.email}`);
                            }
                        })
                        .catch((err) => {
                            reject(`There was an error verifying the user: ${err}`);
                        });
                }
            })
            .catch(() => {
                reject(`Unable to find user: ${userData.email}`);
            });
    });
}
//check for duplicate email
async function checkEmail(email){
    try {
        const user = await User.find({email:email})
        if(user) return false
        return true
    } catch (error) {
        throw new Error({message:error.toString(),status:500})
    }
}

async function generateNextID() {
    // Fetch the user with the latest childId from the DB
    let latestUser = await User.findOne().sort('-childId');

    let char, num;

    if (latestUser) {
        // If a user exists, separate the character and number components of their childId
        char = latestUser.childId[0];
        num = parseInt(latestUser.childId.slice(1));
    } else {
        // If no users exist yet, start with the initial childId 'a000000000'
        char = 'a';
        num = 0;
    }

    // Increment the number by 1
    num += 1;

    // If the number has reached 1_000_000_000, reset it to 0 and increment the character
    if (num === 1_000_000_000) {
        num = 0;

        // Convert the character to its ASCII code, increment it, then convert it back to a character
        char = String.fromCharCode(char.charCodeAt(0) + 1);

        // If the character has reached 'z', reset it back to 'a'
        if (char === '{') {
            char = 'a';
        }
    }

    // Combine the character and number back into an ID, padding the number with zeros to 9 digits
    let newID = char + String(num).padStart(9, '0');

    return newID;
}

// updateUser function
async function updateUser(childId, updatedFields) {
    // Find a user by childId and update
    let user = await User.findOneAndUpdate({ childId: childId }, updatedFields, { new: true });

    if (!user) {
        throw new Error(`User with childId ${childId} not found`);
    }

    return user;
}
async function getUser(childId) {
    try {
        // Find a user by childId
        let user = await User.findOne({ childId: childId });
        // if user exists, convert picture data to base64 string for easier use on the front-end
        return user;
    } catch (err) {
        console.error(err);
        throw err;
    }
}
module.exports = { checkUser, registerUser, initialize, updateUser, getUser,checkEmail }

